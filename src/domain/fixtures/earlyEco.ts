import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { TECH_IDS } from "../config/technologies";

export const earlyEcoFixture: StateFixture = {
  id: "early-eco",
  label: "Wczesna ekonomia",
  description: "5 budynków (Hab, Solar ×2, Szklarnia, Ekstraktor, Kopalnia), 2 technologie, dodatni bilans",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Wczesna ekonomia", "normal", "exploration", null, seed);

    const { placed, occupied, capacity } = placeDeterministicBuildings(store, [
      { definitionId: "solar" },
      { definitionId: "solar" },
      { definitionId: "greenhouse" },
      { definitionId: "ice" },
      { definitionId: "miner" },
    ]);

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, total: 6, capacity: habCapacity };

    const unlockedTechs = [
      TECH_IDS.BASIC_STRUCTURES,
      TECH_IDS.GREENHOUSE_TECH,
    ];

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      unlockedTechs,
      units: [],
      resources: {
        o2: 15,
        power: 20,
        water: 18,
        biomass: 15,
        minerals: 90,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

