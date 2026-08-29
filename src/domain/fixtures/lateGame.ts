import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { TerraformingService } from "../services/TerraformingService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { TECH_IDS } from "../config/technologies";
import { UNIT_IDS } from "../config/units";
import type { PlacedUnit } from "../entities/Unit";

export const lateGameFixture: StateFixture = {
  id: "late-game",
  label: "Późna gra",
  description: "Megastruktura, terraformacja ~45%, widoczna woda w kraterach i wegetacja, wysoka populacja",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Późna gra", "normal", "exploration", null, seed);

    const initialHab = store.getState().placed.find((b) => b.id === "colony-center-hab");
    const upgradedHab = initialHab ? [{ ...initialHab, level: 3 }] : [];

    const { placed, occupied, capacity } = placeDeterministicBuildings(
      store,
      [
        { definitionId: "biosphere_dome", level: 2 },
        { definitionId: "atmosphere_factory", level: 2 },
        { definitionId: "fusion_reactor", level: 2 },
        { definitionId: "rtg", level: 2 },
        { definitionId: "rtg", level: 2 },
        { definitionId: "greenhouse", level: 3 },
        { definitionId: "greenhouse", level: 3 },
        { definitionId: "lab", level: 3 },
        { definitionId: "lab", level: 3 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "battery", level: 1 },
        { definitionId: "watertank", level: 1 },
        { definitionId: "silo", level: 1 },
      ],
      upgradedHab
    );

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, count: 55, capacity: habCapacity };

    const centerHab = placed.find((b) => b.id === "colony-center-hab") || placed[0];
    const spawnX = centerHab.position.x;
    const spawnY = centerHab.position.y ?? 0;
    const spawnZ = centerHab.position.z;

    const units: PlacedUnit[] = [
      {
        id: "fixture-late-combat-1",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX + 4.0, y: spawnY, z: spawnZ + 2.0 },
        heading: 0,
        currentHealth: 250,
        status: "idle",
      },
      {
        id: "fixture-late-combat-2",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX - 4.0, y: spawnY, z: spawnZ - 2.0 },
        heading: Math.PI,
        currentHealth: 250,
        status: "idle",
      },
      {
        id: "fixture-late-drone-1",
        definitionId: UNIT_IDS.DRONE_REPAIR,
        position: { x: spawnX + 1.0, y: spawnY + 2.0, z: spawnZ + 3.0 },
        heading: Math.PI / 2,
        currentHealth: 80,
        status: "idle",
      },
      {
        id: "fixture-late-miner-1",
        definitionId: UNIT_IDS.CRAFT_MINER,
        position: { x: spawnX - 3.0, y: spawnY + 1.5, z: spawnZ + 4.0 },
        heading: Math.PI / 4,
        currentHealth: 100,
        status: "idle",
      },
    ];

    const unlockedTechs = Object.values(TECH_IDS);
    const terraforming = 45.0;
    const water = 150;
    const waterLevel = TerraformingService.calculateWaterLevel(water, terraforming, "normal");

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      units,
      unlockedTechs,
      researchPoints: 120,
      terraforming,
      waterLevel,
      o2Accumulated: 380,
      resources: {
        o2: 150,
        power: 180,
        water,
        biomass: 120,
        minerals: 600,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

