import { performance } from "perf_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { heavyRoomMessage } from "../test/roomFixture";
import { DEFAULT_ROOM_MANAGER_OPTIONS, RoomManager, type PlayerConnection } from "./RoomManager";

/**
 * Testy obciążeniowe pokoi (F9-T6): pełny serwer wg limitów D7 (20 pokoi × 4 graczy) z ciężkim stanem
 * (mapa promienia 20, 30 budynków późnej gry). Budżet: tick wszystkich pokoi + snapshoty mieszczą się
 * z dużym zapasem w okresie ticka (1 s, D4). Progi są luźne (CI), pomiar: `LOAD_TEST_REPORT=1`.
 */

const TICK_MS = 1000;
/** Tick wszystkich pokoi musi zająć mniej niż ta część okresu ticka (zapas na I/O i wolniejsze maszyny). */
const TICK_BUDGET_MS = TICK_MS / 4;
/** Snapshot jest wysyłany co tick każdemu graczowi (D4); górna granica rozmiaru jednej wiadomości. */
const SNAPSHOT_BUDGET_BYTES = 256 * 1024;

class CountingConnection implements PlayerConnection {
  bytes = 0;
  readonly messages: ServerMessage[] = [];
  private readonly keep: boolean;

  constructor(keep = false) {
    this.keep = keep;
  }

  send(data: string): void {
    this.bytes += data.length;
    if (this.keep) this.messages.push(JSON.parse(data) as ServerMessage);
  }

  close(): void {}
}

const report = (label: string, values: Record<string, number | string>): void => {
  if (process.env.LOAD_TEST_REPORT) console.info(`[load] ${label}`, values);
};

describe("obciążenie pokoi (F9-T6)", () => {
  let clock: number;
  let rooms: RoomManager;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    clock = 0;
    rooms = new RoomManager({ now: () => clock });
  });

  afterEach(() => {
    rooms.closeAll();
    vi.restoreAllMocks();
  });

  const fillServer = () => {
    const players: CountingConnection[][] = [];
    for (let r = 0; r < DEFAULT_ROOM_MANAGER_OPTIONS.maxRooms; r++) {
      const host = new CountingConnection(true);
      rooms.handleMessage(host, heavyRoomMessage(`Host ${r}`));
      const joined = host.messages.find((m) => m.type === "room_joined");
      if (joined?.type !== "room_joined") throw new Error("room not created");
      const room = [host];
      for (let p = 1; p < DEFAULT_ROOM_MANAGER_OPTIONS.maxPlayersPerRoom; p++) {
        const guest = new CountingConnection();
        rooms.handleMessage(guest, { type: "join_room", code: joined.code, nickname: `Gracz ${p}` });
        room.push(guest);
      }
      players.push(room);
    }
    return players;
  };

  it("pełny serwer (20 pokoi × 4 graczy, minuta gry z komendami) mieści się w budżecie ticka", () => {
    const players = fillServer();
    expect(rooms.roomCount).toBe(DEFAULT_ROOM_MANAGER_OPTIONS.maxRooms);

    const ticks = 60;
    const tickTimes: number[] = [];
    for (let t = 0; t < ticks; t++) {
      clock += TICK_MS;
      // Każdy gracz wysyła komendę co tick (w limicie 5/s): przełączenie zasilania budynku.
      for (const room of players) {
        room.forEach((connection, index) => {
          rooms.handleMessage(connection, {
            type: "command",
            command: { type: "toggle_building_power", buildingId: `heavy-${index + 2}` },
          });
        });
      }
      const start = performance.now();
      rooms.tickAll();
      tickTimes.push(performance.now() - start);
    }

    const host = players[0][0];
    const snapshots = host.messages.filter((m) => m.type === "snapshot");
    const lastSnapshot = snapshots[snapshots.length - 1];
    if (lastSnapshot?.type !== "snapshot") throw new Error("no snapshot");
    const snapshotBytes = JSON.stringify(lastSnapshot).length;
    const sorted = [...tickTimes].sort((a, b) => a - b);
    const average = tickTimes.reduce((sum, v) => sum + v, 0) / ticks;
    const p95 = sorted[Math.floor(ticks * 0.95)];
    const bytesPerPlayerPerSecond = players[0][1].bytes / ticks;

    report("full server", {
      rooms: rooms.roomCount,
      avgTickMs: average.toFixed(1),
      p95TickMs: p95.toFixed(1),
      snapshotKB: (snapshotBytes / 1024).toFixed(1),
      perPlayerKBps: (bytesPerPlayerPerSecond / 1024).toFixed(1),
    });

    expect(lastSnapshot.state.tick).toBeGreaterThanOrEqual(ticks);
    expect(lastSnapshot.state.alive).toBe(true);
    // Każda komenda w limicie przyjęta: host dostał snapshot po każdej komendzie każdego gracza i po każdym ticku.
    expect(host.messages.some((m) => m.type === "error")).toBe(false);
    expect(snapshots.length).toBe(ticks * (DEFAULT_ROOM_MANAGER_OPTIONS.maxPlayersPerRoom + 1));
    expect(p95).toBeLessThan(TICK_BUDGET_MS);
    expect(snapshotBytes).toBeLessThan(SNAPSHOT_BUDGET_BYTES);
  });

  it("zalew komendami jednego gracza jest ucinany limitem i nie blokuje innych", () => {
    const [[host, guest]] = fillServer();
    const before = guest.bytes;
    const flooder = host;
    const errorsBefore = flooder.messages.filter((m) => m.type === "error").length;

    const floodSize = 200;
    const start = performance.now();
    for (let i = 0; i < floodSize; i++) {
      rooms.handleMessage(flooder, { type: "command", command: { type: "toggle_building_power", buildingId: "heavy-2" } });
    }
    const floodMs = performance.now() - start;

    const limited = flooder.messages.filter((m) => m.type === "error" && m.error === "rate_limited").length;
    report("flood", { commands: floodSize, rateLimited: limited, floodMs: floodMs.toFixed(1) });
    // Zapas (burst) przyjęty, reszta odrzucona bez symulacji i bez rozsyłania snapshotów.
    expect(limited - errorsBefore).toBe(floodSize - DEFAULT_ROOM_MANAGER_OPTIONS.commandBurst);
    // Pozostali gracze dostali tylko snapshoty przyjętych komend (burst), nie 200.
    const afterFlood = guest.bytes;
    expect(afterFlood).toBeGreaterThan(before);

    // Inny gracz w tym samym pokoju nadal ma swój limit: jego komenda przechodzi i rozsyła snapshot.
    const hostBytes = flooder.bytes;
    rooms.handleMessage(guest, { type: "command", command: { type: "toggle_building_power", buildingId: "heavy-3" } });
    expect(flooder.bytes).toBeGreaterThan(hostBytes);

    // Po sekundzie limit odnawia się (5/s).
    clock += TICK_MS;
    const limitedBefore = limited;
    rooms.handleMessage(flooder, { type: "command", command: { type: "toggle_building_power", buildingId: "heavy-2" } });
    expect(flooder.messages.filter((m) => m.type === "error" && m.error === "rate_limited").length).toBe(limitedBefore);
  });

  it("21. pokój i 5. gracz są odrzucane bez wpływu na istniejące pokoje", () => {
    const players = fillServer();
    const extraHost = new CountingConnection(true);
    rooms.handleMessage(extraHost, heavyRoomMessage("Nadmiar"));
    expect(extraHost.messages).toContainEqual({ type: "error", error: "server_full" });

    const joined = players[0][0].messages.find((m) => m.type === "room_joined");
    if (joined?.type !== "room_joined") throw new Error("room not created");
    const fifth = new CountingConnection(true);
    rooms.handleMessage(fifth, { type: "join_room", code: joined.code, nickname: "Piąty" });
    expect(fifth.messages).toContainEqual({ type: "error", error: "room_full" });
    expect(rooms.roomCount).toBe(DEFAULT_ROOM_MANAGER_OPTIONS.maxRooms);
  });
});
