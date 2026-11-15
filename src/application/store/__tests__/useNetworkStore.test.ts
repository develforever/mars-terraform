import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../useGameStore";
import { networkConfig, useNetworkStore } from "../useNetworkStore";
import { createRoomState, toRoomStart, toSnapshot } from "../../../domain/network/RoomState";
import { hexGridWireSchema, initialRoomStateSchema, type ServerMessage } from "../../../domain/network/NetworkProtocol";
import { fakeSocketFactory } from "../../service/__tests__/fakeSocket";

/** F9-T5: przebieg gry sieciowej po stronie klienta na gnieździe testowym (bez serwera). */
describe("useNetworkStore (F9-T5)", () => {
  let sockets: ReturnType<typeof fakeSocketFactory>;

  const startColony = () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().startNewGame("Baza", "normal", "exploration");
  };

  /** Snapshot tak, jak zbuduje go serwer: stan kolonii przez JSON, walidację i `createRoomState`. */
  const serverSnapshot = (overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) => {
    const start = JSON.parse(JSON.stringify(toRoomStart({ ...useGameStore.getState(), ...overrides })));
    const hexGrid = hexGridWireSchema.parse(start.hexGrid);
    return { hexGrid, state: toSnapshot(createRoomState(initialRoomStateSchema.parse(start.state), hexGrid)) };
  };

  /** Odpowiedź serwera na wejście do pokoju, zbudowana ze stanu kolonii gospodarza. */
  const roomJoined = (playerId = "p1", nicknames = ["Host"]): ServerMessage => ({
    type: "room_joined",
    code: "MARS-4K7Q",
    playerId,
    players: nicknames.map((nickname, i) => ({ id: `p${i + 1}`, nickname })),
    ...serverSnapshot(),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = fakeSocketFactory();
    networkConfig.socketUrl = () => "ws://test/ws";
    networkConfig.socketOptions = { createSocket: sockets.createSocket, retryDelaysMs: [100] };
    networkConfig.checkAvailable = async () => true;
    startColony();
  });

  afterEach(() => {
    useNetworkStore.getState().leaveRoom();
    useNetworkStore.setState({ issue: null, serverAvailable: null });
    vi.useRealTimers();
  });

  it("gospodarz: create_room wysyła stan kolonii bez pól UI", () => {
    useNetworkStore.getState().createRoom("Host");
    expect(useNetworkStore.getState().phase).toBe("connecting");
    sockets.last().open();
    const [message] = sockets.last().sent;
    expect(message.type).toBe("create_room");
    if (message.type !== "create_room") return;
    expect(message.nickname).toBe("Host");
    expect(message.state.placed).toEqual(useGameStore.getState().placed);
    expect(message.state).not.toHaveProperty("isPaused");
  });

  it("w pokoju: komendy idą do serwera, lokalny stan i tick czekają na snapshot", () => {
    const grid = useGameStore.getState().hexGrid;
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());

    expect(useNetworkStore.getState()).toMatchObject({ phase: "in_room", roomCode: "MARS-4K7Q", playerId: "p1", isHost: true });
    expect(useGameStore.getState().hexGrid).toBe(grid);

    const hab = useGameStore.getState().placed[0];
    expect(useGameStore.getState().toggleBuildingPower(hab.id)).toBe(true);
    expect(sockets.last().sent.at(-1)).toEqual({ type: "command", command: { type: "toggle_building_power", buildingId: hab.id } });
    expect(useGameStore.getState().placed[0].disabled).toBe(hab.disabled);

    const tickBefore = useGameStore.getState().tick;
    useGameStore.getState().applyEconomyTick();
    expect(useGameStore.getState().tick).toBe(tickBefore);

    const { state: snapshot } = serverSnapshot({ tick: 41, placed: [{ ...hab, disabled: true }] });
    expect(snapshot).not.toHaveProperty("colonyName");
    sockets.last().receive({ type: "snapshot", state: snapshot });
    expect(useGameStore.getState().tick).toBe(41);
    expect(useGameStore.getState().placed[0].disabled).toBe(true);
  });

  it("komenda niemożliwa lokalnie nie trafia do serwera", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    const sent = sockets.last().sent.length;
    expect(useGameStore.getState().upgradeBuilding("nie-ma")).toBe(false);
    expect(sockets.last().sent).toHaveLength(sent);
  });

  it("gość: buduje świat z danych serwera i nazywa kolonię kodem pokoju", () => {
    const joined = roomJoined("p2", ["Host", "Ania"]);
    useGameStore.getState().resetGame();
    useNetworkStore.getState().joinRoom(" mars-4k7q ", "Ania");
    sockets.last().open();
    expect(sockets.last().sent[0]).toEqual({ type: "join_room", code: "MARS-4K7Q", nickname: "Ania" });
    sockets.last().receive(joined);

    const game = useGameStore.getState();
    expect(useNetworkStore.getState().isHost).toBe(false);
    expect(game.colonyName).toBe("MARS-4K7Q");
    expect(game.remoteCommandSink).not.toBeNull();
    expect(game.hexGrid.getAllCells()).toHaveLength(joined.type === "room_joined" ? joined.hexGrid.hexes.length : 0);
  });

  it("błąd przy dołączaniu kończy sesję z komunikatem", () => {
    useNetworkStore.getState().joinRoom("MARS-ZZZZ", "Ania");
    sockets.last().open();
    sockets.last().receive({ type: "error", error: "room_not_found" });
    expect(useNetworkStore.getState()).toMatchObject({ phase: "idle", issue: "room_not_found" });
    expect(useGameStore.getState().remoteCommandSink).toBeNull();
  });

  it("limit komend w pokoju to tylko informacja", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    sockets.last().receive({ type: "error", error: "rate_limited" });
    expect(useNetworkStore.getState()).toMatchObject({ phase: "in_room", issue: "rate_limited" });
  });

  it("zamknięcie pokoju: gra zostaje i działa dalej jako solo", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    sockets.last().receive({ type: "room_closed", reason: "idle" });
    expect(useNetworkStore.getState()).toMatchObject({ phase: "idle", issue: "idle", roomCode: null });
    const tick = useGameStore.getState().tick;
    useGameStore.getState().applyEconomyTick();
    expect(useGameStore.getState().tick).toBe(tick + 1);
  });

  it("po zerwaniu łączy się ponownie i dołącza do tego samego pokoju", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    sockets.last().drop();
    expect(useNetworkStore.getState().phase).toBe("reconnecting");
    vi.advanceTimersByTime(100);
    sockets.last().open();
    expect(sockets.last().sent).toEqual([{ type: "join_room", code: "MARS-4K7Q", nickname: "Host" }]);
    sockets.last().receive(roomJoined("p9"));
    expect(useNetworkStore.getState()).toMatchObject({ phase: "in_room", playerId: "p9", isHost: true });
  });

  it("utrata połączenia na stałe kończy sesję", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    sockets.last().drop();
    vi.advanceTimersByTime(100);
    sockets.last().drop();
    expect(useNetworkStore.getState()).toMatchObject({ phase: "idle", issue: "connection_lost" });
  });

  it("wyjście z gry (resetGame) opuszcza pokój", () => {
    useNetworkStore.getState().createRoom("Host");
    sockets.last().open();
    sockets.last().receive(roomJoined());
    const socket = sockets.last();
    useGameStore.getState().resetGame();
    expect(socket.sent.at(-1)).toEqual({ type: "leave_room" });
    expect(socket.closedWith).toBe(1000);
    expect(useNetworkStore.getState().phase).toBe("idle");
  });

  it("checkServer zapisuje dostępność serwera gry", async () => {
    networkConfig.checkAvailable = async () => false;
    await useNetworkStore.getState().checkServer();
    expect(useNetworkStore.getState().serverAvailable).toBe(false);
  });
});
