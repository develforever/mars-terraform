import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { TECH_IDS } from "../config/technologies";
import { UNIT_IDS } from "../config/units";
import type { PlacedUnit } from "../entities/Unit";
import type { AlienState } from "../entities/Alien";

export const combatFixture: StateFixture = {
  id: "combat",
  label: "Walka",
  description: "Fala obcych 2 aktywna, wieżyczki, kilka łazików bojowych i dron naprawczy",
  seed: 42,
  difficulty: "normal",
  gameMode: "survival",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Walka", "normal", "survival", null, seed);

    const { placed, occupied, capacity } = placeDeterministicBuildings(store, [
      { definitionId: "solar", level: 2 },
      { definitionId: "solar", level: 2 },
      { definitionId: "ice", level: 1 },
      { definitionId: "miner", level: 1 },
      { definitionId: "lab", level: 1 },
      { definitionId: "turret", level: 1 },
      { definitionId: "turret", level: 1 },
      { definitionId: "turret", level: 1 },
    ]);

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, count: 12, capacity: habCapacity };

    const centerHab = placed.find((b) => b.id === "colony-center-hab") || placed[0];
    const spawnX = centerHab.position.x;
    const spawnY = centerHab.position.y ?? 0;
    const spawnZ = centerHab.position.z;

    const units: PlacedUnit[] = [
      {
        id: "fixture-combat-unit-1",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX + 3.0, y: spawnY, z: spawnZ + 2.0 },
        heading: 0,
        currentHealth: 250,
        status: "idle",
      },
      {
        id: "fixture-combat-unit-2",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX + 2.0, y: spawnY, z: spawnZ - 2.0 },
        heading: Math.PI / 4,
        currentHealth: 250,
        status: "idle",
      },
      {
        id: "fixture-combat-unit-3",
        definitionId: UNIT_IDS.ROVER_COMBAT,
        position: { x: spawnX - 2.0, y: spawnY, z: spawnZ + 3.0 },
        heading: Math.PI,
        currentHealth: 220,
        status: "idle",
      },
      {
        id: "fixture-combat-drone-1",
        definitionId: UNIT_IDS.DRONE_REPAIR,
        position: { x: spawnX, y: spawnY + 2.0, z: spawnZ + 1.0 },
        heading: 0,
        currentHealth: 80,
        status: "idle",
      },
      {
        id: "fixture-combat-rover-1",
        definitionId: UNIT_IDS.ROVER,
        position: { x: spawnX - 1.0, y: spawnY, z: spawnZ - 2.0 },
        heading: -Math.PI / 2,
        currentHealth: 100,
        status: "idle",
      },
    ];

    const alienState: AlienState = {
      wave: 2,
      timeUntilNextWave: 45,
      ships: [
        {
          id: "fixture-alien-ship-1",
          position: { x: spawnX + 15.0, y: spawnY + 8.0, z: spawnZ + 12.0 },
          target: { x: spawnX, y: spawnY, z: spawnZ },
          currentHealth: 180,
          maxHealth: 200,
          heading: -Math.PI / 3,
          speed: 2.0,
          attackRange: 12.0,
          attackDamage: 12,
          attackCooldown: 1.5,
          lastAttackTime: 0,
        },
      ],
      groundUnits: [
        {
          id: "fixture-alien-ground-1",
          position: { x: spawnX + 10.0, y: spawnY, z: spawnZ + 6.0 },
          target: { x: spawnX, y: spawnY, z: spawnZ },
          currentHealth: 120,
          maxHealth: 120,
          heading: -Math.PI / 2,
          speed: 1.5,
          attackRange: 4.0,
          attackDamage: 15,
          attackCooldown: 1.0,
          lastAttackTime: 0,
        },
        {
          id: "fixture-alien-ground-2",
          position: { x: spawnX + 12.0, y: spawnY, z: spawnZ - 4.0 },
          target: { x: spawnX, y: spawnY, z: spawnZ },
          currentHealth: 120,
          maxHealth: 120,
          heading: -Math.PI * 0.75,
          speed: 1.5,
          attackRange: 4.0,
          attackDamage: 15,
          attackCooldown: 1.0,
          lastAttackTime: 0,
        },
      ],
      hiveMinds: [],
    };

    const unlockedTechs = [
      TECH_IDS.BASIC_STRUCTURES,
      TECH_IDS.SOLAR_ARRAY,
      TECH_IDS.PERIMETER_DEFENSE,
    ];

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      units,
      alienState,
      unlockedTechs,
      researchPoints: 15,
      resources: {
        o2: 25,
        power: 35,
        water: 25,
        biomass: 20,
        minerals: 90,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

