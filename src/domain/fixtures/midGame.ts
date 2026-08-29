import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { TECH_IDS } from "../config/technologies";
import { UNIT_IDS } from "../config/units";
import type { PlacedUnit } from "../entities/Unit";

export const midGameFixture: StateFixture = {
  id: "mid-game",
  label: "Środek gry",
  description: "10–12 budynków w tym lab i szklarnia, część lvl 2, 4 technologie, ~150 minerałów, dodatni bilans",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Środek gry", "normal", "exploration", null, seed);

    const initialHab = store.getState().placed.find((b) => b.id === "colony-center-hab");
    const upgradedHab = initialHab ? [{ ...initialHab, level: 2 }] : [];

    const { placed, occupied, capacity } = placeDeterministicBuildings(
      store,
      [
        { definitionId: "greenhouse", level: 2 },
        { definitionId: "solar", level: 2 },
        { definitionId: "solar", level: 2 },
        { definitionId: "ice", level: 2 },
        { definitionId: "miner", level: 1 },
        { definitionId: "miner", level: 1 },
        { definitionId: "lab", level: 2 },
        { definitionId: "battery", level: 1 },
        { definitionId: "watertank", level: 1 },
        { definitionId: "silo", level: 1 },
      ],
      upgradedHab
    );

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, count: 18, capacity: habCapacity };

    const centerHab = placed.find((b) => b.id === "colony-center-hab") || placed[0];
    const spawnX = centerHab.position.x;
    const spawnY = centerHab.position.y ?? 0;
    const spawnZ = centerHab.position.z;

    const units: PlacedUnit[] = [
      {
        id: "fixture-unit-rover-1",
        definitionId: UNIT_IDS.ROVER,
        position: { x: spawnX + 3.0, y: spawnY, z: spawnZ + 1.5 },
        heading: 0,
        currentHealth: 100,
        status: "idle",
      },
      {
        id: "fixture-unit-rover-2",
        definitionId: UNIT_IDS.ROVER,
        position: { x: spawnX - 2.5, y: spawnY, z: spawnZ + 2.0 },
        heading: Math.PI / 3,
        currentHealth: 100,
        status: "idle",
      },
      {
        id: "fixture-unit-combat-1",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX + 1.0, y: spawnY, z: spawnZ - 3.0 },
        heading: Math.PI,
        currentHealth: 250,
        status: "idle",
      },
    ];

    const unlockedTechs = [
      TECH_IDS.BASIC_STRUCTURES,
      TECH_IDS.GREENHOUSE_TECH,
      TECH_IDS.SOLAR_ARRAY,
      TECH_IDS.PERIMETER_DEFENSE,
    ];

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      units,
      unlockedTechs,
      researchPoints: 25,
      terraforming: 8.5,
      o2Accumulated: 45,
      resources: {
        o2: 35,
        power: 45,
        water: 40,
        biomass: 30,
        minerals: 150,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

