import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkGameServerAvailable, GameSocketClient, gameSocketUrl, inviteLink, type GameSocketHandlers } from "../networkClient";
import { fakeSocketFactory } from "./fakeSocket";

const handlers = () => ({
  onOpen: vi.fn<GameSocketHandlers["onOpen"]>(),
  onMessage: vi.fn<GameSocketHandlers["onMessage"]>(),
  onReconnecting: vi.fn<GameSocketHandlers["onReconnecting"]>(),
  onConnectionLost: vi.fn<GameSocketHandlers["onConnectionLost"]>(),
});

describe("GameSocketClient (F9-T5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("kolejkuje wiadomości do otwarcia połączenia", () => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    const client = new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket });
    client.connect();
    client.send({ type: "leave_room" });
    expect(sockets.last().sent).toEqual([]);
    sockets.last().open();
    expect(h.onOpen).toHaveBeenCalledWith(false);
    expect(sockets.last().sent).toEqual([{ type: "leave_room" }]);
  });

  it("przekazuje wiadomości serwera i pomija uszkodzone", () => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket }).connect();
    sockets.last().open();
    sockets.last().receive("{zepsute");
    sockets.last().receive(JSON.stringify({ no: "type" }));
    sockets.last().receive({ type: "players", players: [] });
    expect(h.onMessage).toHaveBeenCalledTimes(1);
    expect(h.onMessage).toHaveBeenCalledWith({ type: "players", players: [] });
  });

  it("po zerwaniu łączy się ponownie z odstępem i zgłasza ponowne otwarcie", () => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket, retryDelaysMs: [100, 200] }).connect();
    sockets.last().open();
    sockets.last().drop();
    expect(h.onReconnecting).toHaveBeenCalledWith(1);
    expect(sockets.sockets).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(sockets.sockets).toHaveLength(2);
    sockets.last().open();
    expect(h.onOpen).toHaveBeenLastCalledWith(true);
  });

  it("poddaje się po wyczerpaniu prób", () => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket, retryDelaysMs: [100] }).connect();
    sockets.last().drop();
    vi.advanceTimersByTime(100);
    sockets.last().drop();
    expect(h.onConnectionLost).toHaveBeenCalledTimes(1);
  });

  it.each([1008, 4001])("nie łączy się ponownie po zamknięciu %i (odrzucenie przez serwer)", (code) => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket }).connect();
    sockets.last().open();
    sockets.last().drop(code);
    expect(h.onReconnecting).not.toHaveBeenCalled();
    expect(h.onConnectionLost).toHaveBeenCalledTimes(1);
  });

  it("close() z inicjatywy gracza nie wznawia połączenia", () => {
    const sockets = fakeSocketFactory();
    const h = handlers();
    const client = new GameSocketClient("ws://host/ws", h, { createSocket: sockets.createSocket });
    client.connect();
    sockets.last().open();
    client.close();
    expect(sockets.last().closedWith).toBe(1000);
    vi.advanceTimersByTime(60_000);
    expect(sockets.sockets).toHaveLength(1);
    expect(h.onConnectionLost).not.toHaveBeenCalled();
  });
});

describe("adresy gry sieciowej", () => {
  it("ws na http, wss na https (np. tunel)", () => {
    expect(gameSocketUrl({ protocol: "http:", host: "192.168.1.5:3000" })).toBe("ws://192.168.1.5:3000/ws");
    expect(gameSocketUrl({ protocol: "https:", host: "abc.trycloudflare.com" })).toBe("wss://abc.trycloudflare.com/ws");
  });

  it("link zaproszenia prowadzi na stronę startową z kodem", () => {
    expect(inviteLink("https://abc.trycloudflare.com", "MARS-4K7Q")).toBe("https://abc.trycloudflare.com/?join=MARS-4K7Q");
  });
});

describe("checkGameServerAvailable", () => {
  const respond = (init: { ok: boolean; json?: () => Promise<unknown> }) =>
    vi.fn(async () => ({ ok: init.ok, json: init.json ?? (async () => ({})) }) as unknown as Response);

  it("serwer gry: JSON status ok", async () => {
    expect(await checkGameServerAvailable(respond({ ok: true, json: async () => ({ status: "ok", version: "1" }) }))).toBe(true);
  });

  it("statyczny hosting: 404 albo strona HTML zamiast JSON", async () => {
    expect(await checkGameServerAvailable(respond({ ok: false }))).toBe(false);
    expect(await checkGameServerAvailable(respond({ ok: true, json: async () => { throw new SyntaxError("html"); } }))).toBe(false);
  });

  it("brak sieci", async () => {
    expect(await checkGameServerAvailable(vi.fn(async () => { throw new TypeError("offline"); }))).toBe(false);
  });
});
