import { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { stepSimulation } from "../simulation/GameSimulation";
import { applyCommand, type PlayerCommand } from "../simulation/PlayerCommands";
import type { Rng } from "../random/Rng";
import { initialRoomStateSchema, type HexGridWire, type InitialRoomState, type NetworkSnapshot, type RoomGameState } from "./NetworkProtocol";

/**
 * Stan gry pokoju sieciowego (F9-T4): budowa z danych gospodarza, tick i komendy.
 * Te same czyste funkcje co w grze solo (`stepSimulation`, `applyCommand`).
 */

/**
 * Buduje stan pokoju ze zwalidowanego stanu początkowego. Encje przeszły tylko kontrolę kształtu
 * (`initialRoomStateSchema`); ich typy domenowe przyjmujemy od zaufanego gospodarza (D3).
 */
export const createRoomState = (initial: InitialRoomState, hexGrid: HexGridWire): RoomGameState => ({
  ...(initial as unknown as Omit<RoomGameState, "hexGrid">),
  hexGrid: HexGrid.fromJSON(hexGrid),
});

/**
 * Dane `create_room` z bieżącego stanu gry gospodarza: tylko pola stanu pokoju (bez UI) i siatka heksów.
 * Serwer waliduje je `initialRoomStateSchema` i `hexGridWireSchema`.
 */
export const toRoomStart = (state: RoomGameState): { hexGrid: HexGridWire; state: Record<string, unknown> } => {
  const source = state as unknown as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(initialRoomStateSchema.shape)) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return { hexGrid: state.hexGrid.toJSON() as HexGridWire, state: picked };
};

/** Jeden tick symulacji; gra zakończona (`alive=false`) stoi, jak w trybie solo. */
export const stepRoomState = (state: RoomGameState, rng: Rng): RoomGameState =>
  state.alive ? { ...state, ...stepSimulation(state, { rng }) } : state;

export type RoomCommandResult = { ok: true; state: RoomGameState } | { ok: false; reason: string };

export const applyRoomCommand = (state: RoomGameState, command: PlayerCommand): RoomCommandResult => {
  const result = applyCommand(state, command);
  return result.ok ? { ok: true, state: { ...state, ...result.update } } : result;
};

export const toSnapshot = (state: RoomGameState): NetworkSnapshot => {
  const snapshot: Partial<RoomGameState> = { ...state };
  delete snapshot.hexGrid;
  return snapshot as NetworkSnapshot;
};
