import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { createRoomMessage } from "../test/roomFixture";
import { CLOSE_TOO_MANY_ATTEMPTS, generateRoomCode, RoomManager, type PlayerConnection } from "./RoomManager";

class FakeConnection implements PlayerConnection {
  readonly messages: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }
  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }
  last(): ServerMessage | undefined {
    return this.messages.at(-1);
  }
  ofType<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
}

describe("RoomManager (F9-T4)", () => {
  let now: number;
  let codes: string[];
  let manager: RoomManager;

  const create = (options: ConstructorParameters<typeof RoomManager>[0] = {}) =>
    new RoomManager({ now: () => now, generateCode: () => codes.shift() ?? "MARS-ZZZZ", ...options });

  const host = (m: RoomManager = manager): FakeConnection => {
    const connection = new FakeConnection();
    m.handleMessage(connection, createRoomMessage());
    return connection;
  };

  beforeEach(() => {
    now = 1_000_000;
    codes = ["MARS-AAAA", "MARS-BBBB", "MARS-CCCC"];
    manager = create();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("tworzy pokój z kodem i wysyła gospodarzowi stan, siatkę i listę graczy", () => {
    const connection = host();
    const joined = connection.ofType("room_joined")[0];
    expect(joined.code).toBe("MARS-AAAA");
    expect(joined.players).toEqual([{ id: joined.playerId, nickname: "Host" }]);
    expect(joined.hexGrid.radius).toBe(3);
    expect(joined.state).not.toHaveProperty("hexGrid");
    expect(joined.state.placed).toHaveLength(1);
    expect(manager.roomCount).toBe(1);
  });

  it("dołączenie po kodzie: nowy gracz dostaje stan, pozostali nową listę graczy", () => {
    const a = host();
    const b = new FakeConnection();
    manager.handleMessage(b, { type: "join_room", code: "MARS-AAAA", nickname: "Ania" });
    expect(b.ofType("room_joined")[0].players.map((p) => p.nickname)).toEqual(["Host", "Ania"]);
    expect(a.last()).toEqual({ type: "players", players: expect.arrayContaining([expect.objectContaining({ nickname: "Ania" })]) });
  });

  it("odrzuca dołączenie do pełnego pokoju (D7: max 4 graczy)", () => {
    host();
    for (let i = 0; i < 3; i++) manager.handleMessage(new FakeConnection(), { type: "join_room", code: "MARS-AAAA", nickname: `P${i}` });
    const fifth = new FakeConnection();
    manager.handleMessage(fifth, { type: "join_room", code: "MARS-AAAA", nickname: "P5" });
    expect(fifth.last()).toEqual({ type: "error", error: "room_full" });
  });

  it("limit pokoi w procesie", () => {
    manager = create({ maxRooms: 1 });
    host();
    const second = host();
    expect(second.last()).toEqual({ type: "error", error: "server_full" });
    expect(manager.roomCount).toBe(1);
  });

  it("nie pozwala być w dwóch pokojach naraz", () => {
    const a = host();
    manager.handleMessage(a, createRoomMessage());
    expect(a.last()).toEqual({ type: "error", error: "already_in_room" });
  });

  it("zamyka połączenie po zbyt wielu nieudanych próbach dołączenia (ochrona kodów)", () => {
    host();
    const guesser = new FakeConnection();
    for (let i = 0; i < 5; i++) manager.handleMessage(guesser, { type: "join_room", code: "MARS-ZZZZ", nickname: "X" });
    expect(guesser.ofType("error").map((e) => e.error)).toEqual([...Array(5).fill("room_not_found"), "too_many_attempts"]);
    expect(guesser.closed?.code).toBe(CLOSE_TOO_MANY_ATTEMPTS);
  });

  it("komenda gracza zmienia wspólny stan i trafia do wszystkich (D8: równe prawa)", () => {
    const a = host();
    const b = new FakeConnection();
    manager.handleMessage(b, { type: "join_room", code: "MARS-AAAA", nickname: "Ania" });
    manager.handleMessage(b, { type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } });
    expect(a.ofType("snapshot").at(-1)?.state.placed[0].disabled).toBe(true);
    expect(b.ofType("snapshot").at(-1)?.state.placed[0].disabled).toBe(true);
  });

  it("odmowa komendy trafia tylko do nadawcy", () => {
    const a = host();
    const b = new FakeConnection();
    manager.handleMessage(b, { type: "join_room", code: "MARS-AAAA", nickname: "Ania" });
    const before = a.messages.length;
    manager.handleMessage(b, { type: "command", command: { type: "upgrade_building", buildingId: "nope" } });
    expect(b.last()).toEqual({ type: "command_rejected", reason: "Building not found" });
    expect(a.messages.length).toBe(before);
  });

  it("komenda poza pokojem jest odrzucana", () => {
    const lone = new FakeConnection();
    manager.handleMessage(lone, { type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } });
    expect(lone.last()).toEqual({ type: "error", error: "not_in_room" });
  });

  it("limit komend na sekundę (token bucket) i odnawianie w czasie", () => {
    manager = create({ commandsPerSecond: 2, commandBurst: 3 });
    const a = host();
    const toggle = { type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } } as const;
    for (let i = 0; i < 4; i++) manager.handleMessage(a, toggle);
    expect(a.ofType("error").map((e) => e.error)).toEqual(["rate_limited"]);
    now += 500;
    manager.handleMessage(a, toggle);
    expect(a.ofType("error")).toHaveLength(1);
  });

  it("tick liczy symulację i rozsyła snapshot", () => {
    const a = host();
    manager.tickAll();
    manager.tickAll();
    const snapshots = a.ofType("snapshot");
    expect(snapshots.map((s) => s.state.tick)).toEqual([1, 2]);
  });

  it("zamyka pokój po czasie bezczynności (D7: 30 min)", () => {
    const a = host();
    now += 30 * 60 * 1000 + 1;
    manager.tickAll();
    expect(a.last()).toEqual({ type: "room_closed", reason: "idle" });
    expect(manager.roomCount).toBe(0);
    manager.handleMessage(a, { type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } });
    expect(a.last()).toEqual({ type: "error", error: "not_in_room" });
  });

  it("błąd w ticku zamyka tylko ten pokój", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = new FakeConnection();
    const message = createRoomMessage();
    manager.handleMessage(broken, { ...message, state: { ...message.state, population: {} } });
    const healthy = host();
    manager.tickAll();
    expect(broken.last()).toEqual({ type: "room_closed", reason: "error" });
    expect(healthy.last()?.type).toBe("snapshot");
    expect(manager.roomCount).toBe(1);
    expect(errorLog).toHaveBeenCalledWith("[game] room tick failed:", expect.any(String));
  });

  it("pokój znika, gdy wyjdzie ostatni gracz (D5: bez zapisu)", () => {
    const a = host();
    const b = new FakeConnection();
    manager.handleMessage(b, { type: "join_room", code: "MARS-AAAA", nickname: "Ania" });
    manager.disconnect(b);
    expect(a.last()).toEqual({ type: "players", players: [expect.objectContaining({ nickname: "Host" })] });
    manager.handleMessage(a, { type: "leave_room" });
    expect(manager.roomCount).toBe(0);
  });

  it("closeAll powiadamia graczy o zamknięciu serwera", () => {
    const a = host();
    manager.closeAll();
    expect(a.last()).toEqual({ type: "room_closed", reason: "shutdown" });
    expect(manager.roomCount).toBe(0);
  });

  it("log nie zawiera pseudonimów ani kodów pokoi", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const a = host();
    manager.handleMessage(a, { type: "leave_room" });
    const output = log.mock.calls.flat().join("\n");
    expect(output).not.toContain("Host");
    expect(output).not.toContain("MARS-AAAA");
  });
});

describe("generateRoomCode", () => {
  it("generuje kody w formacie MARS-XXXX z bezpiecznego alfabetu", () => {
    for (let i = 0; i < 50; i++) expect(generateRoomCode()).toMatch(/^MARS-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
  });
});
