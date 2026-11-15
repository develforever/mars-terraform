import { HexGrid } from "../../src/presentation/generator/hex/HexGrid";
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
