import { z } from "zod";
import type { PlacedBuilding } from "../entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta, ResourceKey } from "../entities/Resources";
import type { AlienState } from "../entities/Alien";
import type { PlacedUnit } from "../entities/Unit";
import type { QuestState } from "../entities/Quest";
import type { ColonyPopulation } from "../entities/Colonist";
import type { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { BuildingService } from "../services/BuildingService";
import { EconomyService } from "../services/EconomyService";
import { ColonistService } from "../services/ColonistService";
import { RTSCommandService } from "../services/RTSCommandService";
import { ResearchService } from "../services/ResearchService";
import { QuestService } from "../services/QuestService";

/**
 * Komendy gracza (Faza 9, F9-T3). Każda zmiana stanu gry wywołana przez gracza to komenda:
 * w grze solo wykonuje ją store, w grze sieciowej serwer (po walidacji `playerCommandSchema`).
 * D1 + decyzja 2026-10-01: w kooperacji wszyscy gracze mają RÓWNE prawa do wszystkich komend.
 * Logika przeniesiona 1:1 z akcji `useGameStore`.
 */

const MAX_ID = 128;
const MAX_UNITS_PER_ORDER = 200;
/** Granica współrzędnych świata (mapa hexRadius 60 to ok. ±110 jednostek); chroni przed absurdalnymi wartościami. */
const MAX_COORD = 1000;

const coord = z.number().finite().min(-MAX_COORD).max(MAX_COORD);
const id = z.string().min(1).max(MAX_ID);
const position = z.object({ x: coord, y: coord, z: coord });

export const playerCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place_building"), cell: z.object({ x: coord, z: coord }), heightY: coord, definitionId: id }),
  z.object({ type: z.literal("demolish_building"), cell: z.object({ x: coord, z: coord }) }),
  z.object({ type: z.literal("upgrade_building"), buildingId: id }),
  z.object({ type: z.literal("toggle_building_power"), buildingId: id }),
  z.object({
    type: z.literal("issue_order"),
    unitIds: z.array(id).min(1).max(MAX_UNITS_PER_ORDER),
    order: z.object({
      type: z.enum(["MOVE", "ATTACK", "REPAIR", "STOP"]),
      targetPosition: position.optional(),
      targetEntityId: id.optional(),
      targetType: z.enum(["alien", "building", "ground"]).optional(),
    }),
  }),
  z.object({
    type: z.literal("assign_colonist_role"),
    role: z.enum(["unassigned", "engineer", "scientist", "farmer", "miner"]),
    delta: z.number().int().min(-100).max(100),
  }),
  z.object({ type: z.literal("purchase_tech"), techId: id }),
  z.object({ type: z.literal("claim_quest_reward"), questId: id }),
]);

export type PlayerCommand = z.infer<typeof playerCommandSchema>;

/** Stan potrzebny do wykonania komend (podzbiór `GameState`). */
export interface CommandState {
  resources: Resources;
  capacity: ResourceCapacity;
  placed: PlacedBuilding[];
  occupied: Record<string, string>;
  units: PlacedUnit[];
  population: ColonyPopulation;
  hexGrid: HexGrid;
  waterLevel: number;
  terraforming: number;
  o2Accumulated: number;
  alienState: AlienState;
  researchPoints: number;
  unlockedTechs: string[];
  activeQuests: QuestState[];
}

export type CommandUpdate = Partial<
  Pick<CommandState, "resources" | "capacity" | "placed" | "occupied" | "units" | "population" | "researchPoints" | "unlockedTechs" | "activeQuests">
>;

export type CommandResult = { ok: true; update: CommandUpdate } | { ok: false; reason: string };

export const applyResourceDelta = (resources: Resources, delta: ResourceDelta): Resources => {
  const result = { ...resources };
  for (const [key, value] of Object.entries(delta)) {
    result[key as ResourceKey] += value ?? 0;
  }
  return result;
};

export const applyCapacityDelta = (current: ResourceCapacity, delta: Partial<ResourceCapacity>): ResourceCapacity => ({
  power: current.power + (delta.power ?? 0),
  water: current.water + (delta.water ?? 0),
  biomass: current.biomass + (delta.biomass ?? 0),
  minerals: current.minerals + (delta.minerals ?? 0),
});

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const cellKey = (x: number, z: number): string => `${Math.round(x)},${Math.round(z)}`;

const evaluateQuests = (state: CommandState, overrides: { resources?: Resources; unlockedTechs?: string[]; quests?: QuestState[] }) =>
  QuestService.evaluateQuests(
    {
      placed: state.placed,
      resources: overrides.resources ?? state.resources,
      unlockedTechs: overrides.unlockedTechs ?? state.unlockedTechs,
      terraforming: state.terraforming,
      o2Accumulated: state.o2Accumulated,
      waterLevel: state.waterLevel,
      alienWave: state.alienState.wave,
    },
    overrides.quests ?? state.activeQuests,
  );

/** Wykonuje komendę gracza. Nie modyfikuje `state`; zwraca zmiany do scalenia albo powód odmowy. */
export const applyCommand = (state: CommandState, command: PlayerCommand): CommandResult => {
  switch (command.type) {
    case "place_building": {
      const definition = BUILDING_DEFINITIONS[command.definitionId];
      if (!definition) return fail("Unknown building");
      const result = BuildingService.placeBuilding(definition, command.cell, command.heightY, state.resources, state.occupied, state.placed, state.waterLevel);
      if (!result.success || !result.building) return fail("Cannot place building here");
      const newPlaced = [...state.placed, result.building];
      const habCapacity = ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS);
      return {
        ok: true,
        update: {
          resources: result.costDelta ? applyResourceDelta(state.resources, result.costDelta) : { ...state.resources },
          placed: newPlaced,
          occupied: { ...state.occupied, [cellKey(command.cell.x, command.cell.z)]: result.building.id },
          capacity: applyCapacityDelta(state.capacity, EconomyService.calculateCapacityDelta(definition, true)),
          population: { ...state.population, capacity: habCapacity || state.population.capacity },
        },
      };
    }

    case "demolish_building": {
      const building = BuildingService.findBuildingAtCell(command.cell, state.placed, state.occupied);
      if (!building) return fail("No building at this cell");
      const definition = BUILDING_DEFINITIONS[building.definitionId];
      if (!definition) return fail("Unknown building");
      const result = BuildingService.demolishBuilding(definition);
      if (!result.success) return fail("Cannot demolish building");
      const newOccupied = { ...state.occupied };
      delete newOccupied[cellKey(building.position.x, building.position.z)];
      const newPlaced = state.placed.filter((b) => b.id !== building.id);
      return {
        ok: true,
        update: {
          resources: result.refundDelta ? applyResourceDelta(state.resources, result.refundDelta) : { ...state.resources },
          placed: newPlaced,
          occupied: newOccupied,
          capacity: applyCapacityDelta(state.capacity, EconomyService.calculateCapacityDelta(definition, false)),
          population: { ...state.population, capacity: ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS) },
        },
      };
    }

    case "upgrade_building": {
      const building = state.placed.find((b) => b.id === command.buildingId);
      if (!building) return fail("Building not found");
      const definition = BUILDING_DEFINITIONS[building.definitionId];
      if (!definition) return fail("Unknown building");
      const result = BuildingService.upgradeBuilding(building, definition, state.resources);
      if (!result.success || !result.building) return fail("Cannot upgrade building");
      const upgraded = result.building;
      const newPlaced = state.placed.map((b) => (b.id === command.buildingId ? upgraded : b));
      const habCapacity = ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS);
      return {
        ok: true,
        update: {
          resources: result.costDelta ? applyResourceDelta(state.resources, result.costDelta) : { ...state.resources },
          placed: newPlaced,
          population: { ...state.population, capacity: habCapacity || state.population.capacity },
        },
      };
    }

    case "toggle_building_power": {
      if (!state.placed.some((b) => b.id === command.buildingId)) return fail("Building not found");
      return {
        ok: true,
        update: { placed: state.placed.map((b) => (b.id === command.buildingId ? { ...b, disabled: !b.disabled } : b)) },
      };
    }

    case "issue_order": {
      const context = { hexGrid: state.hexGrid, waterLevel: state.waterLevel, aliens: state.alienState, buildings: state.placed };
      return {
        ok: true,
        update: {
          units: state.units.map((unit) => (command.unitIds.includes(unit.id) ? RTSCommandService.applyOrder(unit, command.order, context) : unit)),
        },
      };
    }

    case "assign_colonist_role":
      return { ok: true, update: { population: ColonistService.assignRole(state.population, command.role, command.delta) } };

    case "purchase_tech": {
      const result = ResearchService.startResearch(command.techId, state.researchPoints, state.unlockedTechs);
      if (!result.success) return fail("Cannot research this technology");
      return {
        ok: true,
        update: {
          researchPoints: result.newResearchPoints,
          unlockedTechs: result.newUnlockedTechs,
          activeQuests: evaluateQuests(state, { unlockedTechs: result.newUnlockedTechs }),
        },
      };
    }

    case "claim_quest_reward": {
      const result = QuestService.claimQuestReward(command.questId, state.activeQuests, state.resources, state.researchPoints);
      if (!result.success) return fail("Cannot claim this reward");
      return {
        ok: true,
        update: {
          resources: result.newResources,
          researchPoints: result.newRP,
          activeQuests: evaluateQuests(state, { resources: result.newResources, quests: result.newQuests }),
        },
      };
    }
  }
};
