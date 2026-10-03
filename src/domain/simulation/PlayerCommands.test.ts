import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand, playerCommandSchema, type CommandState, type PlayerCommand } from "./PlayerCommands";
import { useGameStore } from "../../application/store/useGameStore";

/** F9-T3: komendy gracza bez store (tak jak wykona je serwer) + walidacja wejścia z sieci. */
const freshState = (): CommandState => {
  useGameStore.getState().resetGame();
  useGameStore.getState().startNewGame("Cmd", "normal", "exploration");
  return useGameStore.getState();
};

const findFreeCell = (state: CommandState): { x: number; z: number; y: number } => {
  for (let x = -10; x <= 10; x += 1) {
    for (let z = -10; z <= 10; z += 1) {
      const result = applyCommand(state, { type: "place_building", cell: { x, z }, heightY: 0, definitionId: "solar" });
      if (result.ok) return { x, z, y: 0 };
    }
  }
  throw new Error("brak wolnej komórki");
};

describe("playerCommandSchema (walidacja komend z sieci)", () => {
  it("przyjmuje poprawne komendy", () => {
    const commands: PlayerCommand[] = [
      { type: "place_building", cell: { x: 1, z: 2 }, heightY: 1.2, definitionId: "solar" },
      { type: "demolish_building", cell: { x: 1, z: 2 } },
      { type: "upgrade_building", buildingId: "b-1" },
      { type: "toggle_building_power", buildingId: "b-1" },
      { type: "issue_order", unitIds: ["u-1"], order: { type: "MOVE", targetPosition: { x: 1, y: 0, z: 1 } } },
      { type: "assign_colonist_role", role: "miner", delta: 2 },
      { type: "purchase_tech", techId: "t" },
      { type: "claim_quest_reward", questId: "q" },
    ];
    for (const command of commands) expect(playerCommandSchema.safeParse(command).success, command.type).toBe(true);
  });

  it.each([
    ["nieznany typ", { type: "delete_everything" }],
    ["współrzędne poza mapą", { type: "demolish_building", cell: { x: 1e9, z: 0 } }],
    ["NaN", { type: "demolish_building", cell: { x: Number.NaN, z: 0 } }],
    ["pusta lista jednostek", { type: "issue_order", unitIds: [], order: { type: "STOP" } }],
    ["za długie id", { type: "upgrade_building", buildingId: "x".repeat(200) }],
    ["niecałkowita zmiana kolonistów", { type: "assign_colonist_role", role: "miner", delta: 1.5 }],
    ["nieznana rola", { type: "assign_colonist_role", role: "king", delta: 1 }],
    ["nieznany rozkaz", { type: "issue_order", unitIds: ["u"], order: { type: "NUKE" } }],
  ])("odrzuca: %s", (_label, command) => {
    expect(playerCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe("applyCommand (bez store)", () => {
  let state: CommandState;

  beforeEach(() => {
    state = freshState();
  });

  it("budowa: pobiera koszt, dodaje budynek i zajmuje komórkę; nie modyfikuje wejścia", () => {
    const cell = findFreeCell(state);
    const before = JSON.stringify({ r: state.resources, p: state.placed.length, o: state.occupied });
    const result = applyCommand(state, { type: "place_building", cell: { x: cell.x, z: cell.z }, heightY: 0, definitionId: "solar" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.update.placed).toHaveLength(state.placed.length + 1);
    expect(Object.keys(result.update.occupied ?? {})).toHaveLength(Object.keys(state.occupied).length + 1);
    expect(JSON.stringify({ r: state.resources, p: state.placed.length, o: state.occupied })).toBe(before);
  });

  it("budowa nieznanego budynku i na zajętej komórce = odmowa z powodem", () => {
    expect(applyCommand(state, { type: "place_building", cell: { x: 0, z: 0 }, heightY: 0, definitionId: "nie-ma" })).toEqual({ ok: false, reason: "Unknown building" });
    const cell = findFreeCell(state);
    const first = applyCommand(state, { type: "place_building", cell: { x: cell.x, z: cell.z }, heightY: 0, definitionId: "solar" });
    if (!first.ok) throw new Error("budowa nieudana");
    const after = { ...state, ...first.update };
    expect(applyCommand(after, { type: "place_building", cell: { x: cell.x, z: cell.z }, heightY: 0, definitionId: "solar" }).ok).toBe(false);
  });

  it("rozbiórka zwraca budynek i zwalnia komórkę", () => {
    const cell = findFreeCell(state);
    const built = applyCommand(state, { type: "place_building", cell: { x: cell.x, z: cell.z }, heightY: 0, definitionId: "solar" });
    if (!built.ok) throw new Error("budowa nieudana");
    const after = { ...state, ...built.update };
    const demolished = applyCommand(after, { type: "demolish_building", cell: { x: cell.x, z: cell.z } });
    expect(demolished.ok).toBe(true);
    if (!demolished.ok) return;
    expect(demolished.update.placed).toHaveLength(state.placed.length);
    expect(applyCommand(state, { type: "demolish_building", cell: { x: 999, z: 999 } }).ok).toBe(false);
  });

  it("przełączenie zasilania nieistniejącego budynku = odmowa", () => {
    expect(applyCommand(state, { type: "toggle_building_power", buildingId: "brak" })).toEqual({ ok: false, reason: "Building not found" });
  });

  it("wynik komendy jest taki sam jak akcji store (gra solo)", () => {
    const cell = findFreeCell(state);
    const result = applyCommand(state, { type: "place_building", cell: { x: cell.x, z: cell.z }, heightY: 0, definitionId: "solar" });
    expect(useGameStore.getState().placeBuilding({ x: cell.x, z: cell.z }, 0, "solar")).toBe(true);
    if (!result.ok) throw new Error("budowa nieudana");
    expect(useGameStore.getState().resources).toEqual(result.update.resources);
    expect(useGameStore.getState().placed.map((b) => b.definitionId)).toEqual(result.update.placed?.map((b) => b.definitionId));
  });
});
