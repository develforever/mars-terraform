import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { WebSocket } from "ws";
import type { ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { createRoomMessage } from "../test/roomFixture";
import { attachGameServer, type GameServer } from "./gameServer";

/**
 * F9-T6: limit połączeń, zalew komendami przez prawdziwe gniazda i logi bez danych graczy
 * (pseudonimów, kodów pokoi, adresów IP).
 */
describe("serwer gry: bezpieczeństwo i prywatność (F9-T6)", () => {
  let server: Server;
  let game: GameServer;
  let port: number;
  let logs: MockInstance[];
  const sockets: WebSocket[] = [];

  const start = async (maxConnections: number) => {
    server = createServer((_req, res) => res.writeHead(404).end());
    game = attachGameServer(server, { allowedOrigins: [], tickIntervalMs: 20, heartbeatIntervalMs: 60_000, maxConnections });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  };

  beforeEach(() => {
    logs = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
  });

  afterEach(async () => {
    for (const ws of sockets) ws.terminate();
    sockets.length = 0;
    await game.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  const connect = (): WebSocket => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
    ws.on("error", () => {});
    sockets.push(ws);
    return ws;
  };

  const opened = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const collect = (ws: WebSocket): ServerMessage[] => {
    const messages: ServerMessage[] = [];
    ws.on("message", (data: Buffer) => messages.push(JSON.parse(data.toString()) as ServerMessage));
    return messages;
  };

  const waitFor = async (condition: () => boolean, timeoutMs = 3000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error("timeout");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  it("odrzuca połączenia ponad limit (503), a po zamknięciu jednego przyjmuje nowe", async () => {
    await start(2);
    const first = connect();
    const second = connect();
    await Promise.all([opened(first), opened(second)]);

    const third = connect();
    const status = await new Promise<number>((resolve) => {
      third.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    });
    expect(status).toBe(503);

    first.close();
    await waitFor(() => first.readyState === WebSocket.CLOSED);
    const fourth = connect();
    await opened(fourth);
  });

  it("4 graczy zalewa serwer komendami: limit działa, tick biegnie dalej, logi bez danych graczy", async () => {
    await start(10);
    const host = connect();
    await opened(host);
    const hostMessages = collect(host);
    host.send(JSON.stringify(createRoomMessage("TajnyHost")));
    await waitFor(() => hostMessages.some((m) => m.type === "room_joined"));
    const joined = hostMessages.find((m) => m.type === "room_joined");
    if (joined?.type !== "room_joined") throw new Error("not joined");

    const guests = [connect(), connect(), connect()];
    await Promise.all(guests.map(opened));
    const guestMessages = guests.map(collect);
    guests.forEach((ws, i) => ws.send(JSON.stringify({ type: "join_room", code: joined.code, nickname: `TajnyGosc${i}` })));
    await waitFor(() => guestMessages.every((messages) => messages.some((m) => m.type === "room_joined")));

    const command = JSON.stringify({ type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } });
    for (const ws of [host, ...guests]) {
      for (let i = 0; i < 100; i++) ws.send(command);
    }
    await waitFor(() => guestMessages.every((messages) =>
      messages.filter((m) => m.type === "error" && m.error === "rate_limited").length >= 80,
    ));

    // Pokój żyje: przychodzą snapshoty z kolejnymi tickami po zalewie.
    const tickAfterFlood = Math.max(...hostMessages.flatMap((m) => (m.type === "snapshot" ? [m.state.tick] : [0])));
    await waitFor(() => hostMessages.some((m) => m.type === "snapshot" && m.state.tick > tickAfterFlood + 2));
    expect(host.readyState).toBe(WebSocket.OPEN);

    host.close();
    guests.forEach((ws) => ws.close());
    await waitFor(() => game.rooms.roomCount === 0);

    const output = logs.flatMap((spy) => spy.mock.calls.map((args) => args.map(String).join(" "))).join("\n");
    expect(output).toContain("room created");
    expect(output).toContain("room closed");
    for (const secret of ["TajnyHost", "TajnyGosc", joined.code, "127.0.0.1", String(port)]) {
      expect(output).not.toContain(secret);
    }
  });
});
