import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import type { WeatherState } from "../entities/Weather";

export const crisisFixture: StateFixture = {
  id: "crisis",
  label: "Kryzys",
  description: "Energia i woda bliskie zeru, aktywny bufor podtrzymywania życia, alarm, burza pyłowa w toku",
  seed: 42,
  difficulty: "hard",
  gameMode: "survival",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Kryzys", "hard", "survival", null, seed);

    const initialHab = store.getState().placed.find((b) => b.id === "colony-center-hab");
    const damagedHab = initialHab ? [{ ...initialHab, condition: 55 }] : [];

    const { placed, occupied, capacity } = placeDeterministicBuildings(
      store,
      [
        { definitionId: "greenhouse", condition: 45 },
        { definitionId: "solar", condition: 35 },
        { definitionId: "ice", condition: 40 },
        { definitionId: "miner", condition: 50 },
      ],
      damagedHab
    );

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, count: 6, capacity: habCapacity };

    const weather: WeatherState = {
      type: "dust_storm",
      intensity: 0.85,
      remainingTicks: 45,
      cooldownTicks: 0,
    };

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      weather,
      morale: {
        health: 45,
        happiness: 30,
        productivity: 0.5,
        unmetNeeds: ["power", "water"],
      },
      resources: {
        o2: 3.5,
        power: 0.8,
        water: 1.2,
        biomass: 2.0,
        minerals: 15,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

