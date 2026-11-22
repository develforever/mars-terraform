import { HexGrid } from "../../src/presentation/generator/hex/HexGrid";
import { hexToWorld, hexesInRadius } from "../../src/presentation/generator/hex/HexMath";
import { INITIAL_COLONY_STATE } from "../../src/domain/entities/Colony";
import { INITIAL_ALIEN_STATE } from "../../src/domain/services/AlienService";
import { INITIAL_POPULATION } from "../../src/domain/entities/Colonist";
import { QuestService } from "../../src/domain/services/QuestService";
import { EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS } from "../../src/domain/services/EconomyService";
import { WeatherService } from "../../src/domain/services/WeatherService";
import type { ClientMessage } from "../../src/domain/network/NetworkProtocol";

type CreateRoomMessage = Extract<ClientMessage, { type: "create_room" }>;

/** Wiadomość `create_room` z minimalną kolonią (jeden budynek) na małej mapie; tylko czyste moduły domeny. */
export const createRoomMessage = (nickname = "Host"): CreateRoomMessage => {
  const grid = new HexGrid(3, 1);
  grid.generate();
  return {
    type: "create_room",
    nickname,
    hexGrid: grid.toJSON() as CreateRoomMessage["hexGrid"],
    state: {
      gameMode: "exploration",
      difficulty: "normal",
      alive: true,
      won: false,
      isEndless: false,
      tick: 0,
      weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: WeatherService.INITIAL_GRACE_TICKS },
      terraforming: 0,
      o2Accumulated: 0,
      waterLevel: 0,
      sun: INITIAL_COLONY_STATE.sun,
      resources: { ...INITIAL_COLONY_STATE.resources },
      capacity: { ...INITIAL_COLONY_STATE.capacity },
      placed: [{ id: "b-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 }],
      occupied: { "0,0": "b-1" },
      units: [],
      resourceNodes: [],
      population: { ...INITIAL_POPULATION },
      emergencyLifeSupport: { active: false, secondsRemaining: EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS },
      alienState: { ...INITIAL_ALIEN_STATE },
      aliensDefeated: 0,
      researchPoints: 0,
      unlockedTechs: [],
      activeQuests: QuestService.getInitialQuestStates() as unknown as Record<string, unknown>[],
      analyticsSnapshots: [],
    },
  };
};

/** Zestaw budynków jak w fixture `perfStress` (późna gra). */
const HEAVY_BUILDINGS: readonly (readonly [string, number])[] = [
  ["hab", 3], ["biosphere_dome", 3], ["atmosphere_factory", 3], ["fusion_reactor", 3],
  ["rtg", 3], ["rtg", 3], ["rtg", 2], ["greenhouse", 3], ["greenhouse", 3], ["greenhouse", 2],
  ["lab", 3], ["lab", 3], ["lab", 2], ["turret", 1], ["turret", 1], ["turret", 1], ["turret", 1],
  ["solar", 3], ["solar", 3], ["solar", 2], ["ice", 3], ["ice", 2], ["miner", 3], ["miner", 2],
  ["battery", 1], ["watertank", 1], ["watertank", 1], ["silo", 1], ["o2-gen", 2], ["o2-gen", 1],
];

/**
 * Ciężki pokój do testów obciążeniowych (F9-T6): mapa o promieniu 20 (1261 heksów, domyślny rozmiar generatora)
 * i 30 budynków późnej gry na dostępnych heksach wokół środka.
 */
export const heavyRoomMessage = (nickname = "Host"): CreateRoomMessage => {
  const base = createRoomMessage(nickname);
  const grid = new HexGrid(20, 7);
  grid.generate();
  const placed: CreateRoomMessage["state"]["placed"] = [];
  const occupied: Record<string, string> = {};
  for (const [q, r] of hexesInRadius(0, 0, 10)) {
    if (placed.length >= HEAVY_BUILDINGS.length) break;
    const cell = grid.getCell(q, r);
    if (!cell || cell.terrainType === "peak" || cell.terrainType === "deep_crater") continue;
    const [x, z] = hexToWorld(q, r);
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (occupied[key]) continue;
    const [definitionId, level] = HEAVY_BUILDINGS[placed.length];
    const id = `heavy-${placed.length + 1}`;
    placed.push({ id, definitionId, position: { x, y: cell.worldY, z }, condition: 100, level });
    occupied[key] = id;
  }
  return {
    ...base,
    hexGrid: grid.toJSON() as CreateRoomMessage["hexGrid"],
    state: {
      ...base.state,
      resources: { ...base.state.resources, minerals: 5000, power: 500, water: 500, biomass: 500 },
      capacity: { ...base.state.capacity, minerals: 10000, power: 1000, water: 1000, biomass: 1000 },
      placed,
      occupied,
      researchPoints: 1000,
    },
  };
};
