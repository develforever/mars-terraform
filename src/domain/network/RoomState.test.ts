import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../../application/store/useGameStore";
import { createSeededRng } from "../random/Rng";
import { clientMessageSchema, hexGridWireSchema, initialRoomStateSchema, nicknameSchema, roomCodeSchema } from "./NetworkProtocol";
import { applyRoomCommand, createRoomState, stepRoomState, toRoomStart, toSnapshot } from "./RoomState";

/**
 * F9-T4: stan gry z przeglądarki gospodarza przechodzi przez sieć (JSON) i walidację serwera,
 * a serwer liczy na nim tick i komendy tymi samymi funkcjami co gra solo.
 */
const hostGame = () => {
  useGameStore.getState().resetGame();
  useGameStore.getState().startNewGame("Net", "normal", "exploration");
  return useGameStore.getState();
};

/** Symulacja drogi przez WebSocket: serializacja klienta + walidacja serwera. */
const overTheWire = () => {
  const start = JSON.parse(JSON.stringify(toRoomStart(hostGame())));
  const hexGrid = hexGridWireSchema.parse(start.hexGrid);
  const state = initialRoomStateSchema.parse(start.state);
  return createRoomState(state, hexGrid);
};

describe("stan pokoju sieciowego (F9-T4)", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it("stan nowej gry przechodzi walidację serwera i odtwarza siatkę heksów", () => {
    const host = hostGame();
    const room = overTheWire();
    expect(room.hexGrid.radius).toBe(host.hexGrid.radius);
    expect(room.hexGrid.getAllCells()).toEqual(host.hexGrid.getAllCells());
    expect(room.resources).toEqual(host.resources);
    expect(room.placed).toEqual(host.placed);
  });

  it("toRoomStart nie wysyła stanu UI", () => {
    const { state } = toRoomStart(hostGame());
    expect(state).not.toHaveProperty("isPaused");
    expect(state).not.toHaveProperty("colonyName");
    expect(state).not.toHaveProperty("hexGrid");
  });

  it("tick na serwerze daje ten sam wynik co rdzeń symulacji w grze solo", () => {
    const room = overTheWire();
    const a = stepRoomState(room, createSeededRng(7));
    const b = stepRoomState(overTheWire(), createSeededRng(7));
    expect(a.tick).toBe(room.tick + 1);
    expect(a.resources).toEqual(b.resources);
  });

  it("zakończona gra stoi", () => {
    const room = { ...overTheWire(), alive: false };
    expect(stepRoomState(room, createSeededRng(1))).toBe(room);
  });

  it("komenda gracza zmienia stan albo zwraca powód odmowy", () => {
    const room = overTheWire();
    const rejected = applyRoomCommand(room, { type: "upgrade_building", buildingId: "nope" });
    expect(rejected).toEqual({ ok: false, reason: "Building not found" });

    const target = room.placed[0];
    const toggled = applyRoomCommand(room, { type: "toggle_building_power", buildingId: target.id });
    expect(toggled.ok && toggled.state.placed[0].disabled).toBe(!target.disabled);
  });

  it("snapshot nie zawiera siatki heksów i jest serializowalny", () => {
    const snapshot = toSnapshot(overTheWire());
    expect(snapshot).not.toHaveProperty("hexGrid");
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });
});

describe("walidacja protokołu (F9-T4)", () => {
  it("kod pokoju: normalizacja i odrzucanie mylących znaków", () => {
    expect(roomCodeSchema.parse(" mars-4k7q ")).toBe("MARS-4K7Q");
    expect(roomCodeSchema.safeParse("MARS-O0I1").success).toBe(false);
    expect(roomCodeSchema.safeParse("MARS-4K7QX").success).toBe(false);
  });

  it.each([
    ["pusty", "   "],
    ["za długi", "x".repeat(21)],
    ["znaki sterujące", "ab\u0000c"],
    ["znaczniki", "<b>hi</b>"],
  ])("pseudonim odrzucony: %s", (_label, nickname) => {
    expect(nicknameSchema.safeParse(nickname).success).toBe(false);
  });

  it("pseudonim z polskimi znakami przechodzi", () => {
    expect(nicknameSchema.parse(" Łazik_Ania ")).toBe("Łazik_Ania");
  });

  it("odrzuca nieznane typy wiadomości i złe komendy", () => {
    expect(clientMessageSchema.safeParse({ type: "kick_player" }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "command", command: { type: "delete_everything" } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "leave_room" }).success).toBe(true);
  });

  it("odrzuca stan z liczbami spoza zakresu", () => {
    const start = JSON.parse(JSON.stringify(toRoomStart(hostGame())));
    expect(initialRoomStateSchema.safeParse({ ...start.state, tick: -1 }).success).toBe(false);
    expect(initialRoomStateSchema.safeParse({ ...start.state, placed: Array(2001).fill({}) }).success).toBe(false);
  });
});
