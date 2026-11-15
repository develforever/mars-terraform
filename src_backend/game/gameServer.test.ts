import { createServer, type IncomingMessage, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { createRoomMessage } from "../test/roomFixture";
import { attachGameServer, CLOSE_POLICY_VIOLATION, isOriginAllowed, MAX_BAD_MESSAGES, type GameServer } from "./gameServer";

const request = (headers: Record<string, string>): IncomingMessage => ({ headers }) as unknown as IncomingMessage;

describe("isOriginAllowed", () => {
  it.each([
    ["ten sam host", { origin: "http://localhost:3000", host: "localhost:3000" }, true],
    ["host bez rozróżniania wielkości liter", { origin: "https://Abc.trycloudflare.com", host: "abc.trycloudflare.com" }, true],
    ["tunel z X-Forwarded-Host", { origin: "https://abc.trycloudflare.com", host: "localhost:3000", "x-forwarded-host": "abc.trycloudflare.com" }, true],
    ["obca strona", { origin: "https://evil.example", host: "localhost:3000" }, false],
    ["brak Origin", { host: "localhost:3000" }, false],
    ["zły Origin", { origin: "not a url", host: "localhost:3000" }, false],
    ["inny port", { origin: "http://localhost:5173", host: "localhost:3000" }, false],
  ])("%s", (_label, headers, expected) => {
    expect(isOriginAllowed(request(headers), [])).toBe(expected);
  });

  it("origin z listy (np. Vite w dev)", () => {
    expect(isOriginAllowed(request({ origin: "http://localhost:5173", host: "localhost:3000" }), ["http://localhost:5173"])).toBe(true);
  });
});

describe("serwer gry WebSocket (F9-T4)", () => {
  let server: Server;
  let game: GameServer;
  let port: number;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    server = createServer((_req, res) => res.writeHead(404).end());
    game = attachGameServer(server, { allowedOrigins: [], tickIntervalMs: 20, heartbeatIntervalMs: 60_000 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const ws of sockets) ws.terminate();
    sockets.length = 0;
    await game.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  const connect = (options: { path?: string; origin?: string | null } = {}): WebSocket => {
    const { path = "/ws", origin = `http://127.0.0.1:${port}` } = options;
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, origin ? { origin } : {});
    ws.on("error", () => {});
    sockets.push(ws);
    return ws;
  };

  const opened = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const rejectedWith = (ws: WebSocket) => new Promise<number>((resolve) => {
    ws.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
  });

  /** Czeka na pierwszą wiadomość danego typu (opcjonalnie spełniającą warunek). */
  const next = <T extends ServerMessage["type"]>(
    ws: WebSocket,
    type: T,
    accept: (message: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ) =>
    new Promise<Extract<ServerMessage, { type: T }>>((resolve) => {
      const onMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString()) as ServerMessage;
        if (message.type === type && accept(message as Extract<ServerMessage, { type: T }>)) {
          ws.off("message", onMessage);
          resolve(message as Extract<ServerMessage, { type: T }>);
        }
      };
      ws.on("message", onMessage);
    });

  it("odrzuca upgrade z obcego originu (403) i bez originu (403)", async () => {
    expect(await rejectedWith(connect({ origin: "https://evil.example" }))).toBe(403);
    expect(await rejectedWith(connect({ origin: null }))).toBe(403);
  });

  it("odrzuca inne ścieżki (404)", async () => {
    expect(await rejectedWith(connect({ path: "/other" }))).toBe(404);
  });

  it("dwóch graczy: utworzenie pokoju, dołączenie, komenda i tick", async () => {
    const host = connect();
    await opened(host);
    const hostJoined = next(host, "room_joined");
    host.send(JSON.stringify(createRoomMessage()));
    const { code } = await hostJoined;

    const guest = connect();
    await opened(guest);
    const guestJoined = next(guest, "room_joined");
    const hostSeesGuest = next(host, "players");
    guest.send(JSON.stringify({ type: "join_room", code: code.toLowerCase(), nickname: "Ania" }));
    expect((await guestJoined).players).toHaveLength(2);
    expect((await hostSeesGuest).players.map((p) => p.nickname)).toEqual(["Host", "Ania"]);

    const hostSnapshot = next(host, "snapshot");
    guest.send(JSON.stringify({ type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } }));
    expect((await hostSnapshot).state.placed[0].disabled).toBe(true);

    const ticked = await next(guest, "snapshot", (m) => m.state.tick >= 1);
    expect(ticked.state.tick).toBeGreaterThanOrEqual(1);
  });

  it("odpowiada bad_message na złe wiadomości i zamyka połączenie po limicie", async () => {
    const ws = connect();
    await opened(ws);
    const firstError = next(ws, "error");
    const closed = new Promise<number>((resolve) => ws.once("close", (code) => resolve(code)));
    for (let i = 0; i < MAX_BAD_MESSAGES; i++) ws.send(i % 2 ? "{not json" : JSON.stringify({ type: "kick_player" }));
    expect((await firstError).error).toBe("bad_message");
    expect(await closed).toBe(CLOSE_POLICY_VIOLATION);
  });

  it("rozłączenie ostatniego gracza usuwa pokój", async () => {
    const ws = connect();
    await opened(ws);
    const joined = next(ws, "room_joined");
    ws.send(JSON.stringify(createRoomMessage()));
    await joined;
    expect(game.rooms.roomCount).toBe(1);
    ws.close();
    await vi.waitFor(() => expect(game.rooms.roomCount).toBe(0));
  });
});
