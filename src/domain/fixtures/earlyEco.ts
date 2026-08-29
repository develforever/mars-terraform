import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";

export const earlyEcoFixture: StateFixture = {
  id: "early-eco",
  label: "Wczesna ekonomia",
  description: "Solar ×2, ekstraktor lodu, kopalnia; ~2 min gry; dodatni bilans",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Wczesna ekonomia", "normal", "exploration", null, seed);

    const { placed, occupied, capacity } = placeDeterministicBuildings(store, [
      { definitionId: "solar" },
      { definitionId: "solar" },
      { definitionId: "ice" },
      { definitionId: "miner" },
    ]);

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, capacity: habCapacity };

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      resources: {
        o2: 12,
        power: 18,
        water: 15,
        biomass: 10,
        minerals: 80,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

