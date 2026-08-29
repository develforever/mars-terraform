import type { StateFixture } from "./types";
import { placeDeterministicBuildings } from "./fixtureUtils";
import { ColonistService } from "../services/ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { TECH_IDS } from "../config/technologies";
import { UNIT_IDS } from "../config/units";
import type { PlacedUnit } from "../entities/Unit";
import type { AlienState } from "../entities/Alien";

export const perfStressFixture: StateFixture = {
  id: "perf-stress",
  label: "Obciążenie",
  description: "Maksymalna sensowna liczba budynków, jednostek i dekoracji w kadrze",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Obciążenie", "normal", "exploration", null, seed);

    const initialHab = store.getState().placed.find((b) => b.id === "colony-center-hab");
    const upgradedHab = initialHab ? [{ ...initialHab, level: 3 }] : [];

    const { placed, occupied, capacity } = placeDeterministicBuildings(
      store,
      [
        { definitionId: "biosphere_dome", level: 3 },
        { definitionId: "atmosphere_factory", level: 3 },
        { definitionId: "fusion_reactor", level: 3 },
        { definitionId: "rtg", level: 3 },
        { definitionId: "rtg", level: 3 },
        { definitionId: "rtg", level: 2 },
        { definitionId: "greenhouse", level: 3 },
        { definitionId: "greenhouse", level: 3 },
        { definitionId: "greenhouse", level: 2 },
        { definitionId: "lab", level: 3 },
        { definitionId: "lab", level: 3 },
        { definitionId: "lab", level: 2 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "turret", level: 1 },
        { definitionId: "solar", level: 3 },
        { definitionId: "solar", level: 3 },
        { definitionId: "solar", level: 2 },
        { definitionId: "ice", level: 3 },
        { definitionId: "ice", level: 2 },
        { definitionId: "miner", level: 3 },
        { definitionId: "miner", level: 2 },
        { definitionId: "battery", level: 1 },
        { definitionId: "watertank", level: 1 },
        { definitionId: "silo", level: 1 },
      ],
      upgradedHab
    );

    const habCapacity = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
    const population = { ...store.getState().population, count: 70, capacity: habCapacity };

    const centerHab = placed.find((b) => b.id === "colony-center-hab") || placed[0];
    const spawnX = centerHab.position.x;
    const spawnY = centerHab.position.y ?? 0;
    const spawnZ = centerHab.position.z;

    const units: PlacedUnit[] = [];
    const unitConfigs = [
      { def: UNIT_IDS.ROVER_COMBAT, count: 6, hp: 250 },
      { def: UNIT_IDS.ROVER, count: 4, hp: 100 },
      { def: UNIT_IDS.DRONE_REPAIR, count: 3, hp: 80 },
      { def: UNIT_IDS.CRAFT_MINER, count: 3, hp: 100 },
      { def: UNIT_IDS.CRAFT_HAULER, count: 2, hp: 120 },
    ];

    let uIdx = 0;
    for (const cfg of unitConfigs) {
      for (let i = 0; i < cfg.count; i++) {
        const angle = (uIdx / 18) * Math.PI * 2;
        const radius = 3.0 + (uIdx % 4) * 1.5;
        units.push({
          id: `fixture-perf-unit-${uIdx + 1}`,
          definitionId: cfg.def,
          position: {
            x: spawnX + Math.cos(angle) * radius,
            y: spawnY,
            z: spawnZ + Math.sin(angle) * radius,
          },
          heading: angle,
          currentHealth: cfg.hp,
          status: "idle",
        });
        uIdx++;
      }
    }

    const alienState: AlienState = {
      wave: 2,
      nextShipSpawnIn: 60,
      nextGroundSpawnIn: 60,
      ships: [
        {
          id: "fixture-perf-alien-ship-1",
          position: { x: spawnX + 18.0, y: spawnY + 12.0, z: spawnZ + 15.0 },
          targetBuildingId: "colony-center-hab",
          phase: "approaching",
          phaseProgress: 0.5,
          active: true,
        },
        {
          id: "fixture-perf-alien-ship-2",
          position: { x: spawnX - 16.0, y: spawnY + 10.0, z: spawnZ - 14.0 },
          targetBuildingId: "colony-center-hab",
          phase: "approaching",
          phaseProgress: 0.3,
          active: true,
        },
      ],
      groundUnits: [
        {
          id: "fixture-perf-alien-g-1",
          position: { x: spawnX + 12.0, y: spawnY, z: spawnZ + 8.0 },
          targetBuildingId: "colony-center-hab",
          attackCooldown: 1.0,
          active: true,
        },
        {
          id: "fixture-perf-alien-g-2",
          position: { x: spawnX - 10.0, y: spawnY, z: spawnZ + 10.0 },
          targetBuildingId: "colony-center-hab",
          attackCooldown: 1.0,
          active: true,
        },
      ],
    };

    const unlockedTechs = Object.values(TECH_IDS);

    store.setState({
      placed,
      occupied,
      capacity,
      population,
      units,
      alienState,
      unlockedTechs,
      researchPoints: 200,
      terraforming: 30.0,
      resources: {
        o2: 100,
        power: 150,
        water: 120,
        biomass: 100,
        minerals: 500,
      },
      gameSpeed: options?.speed ?? store.getState().gameSpeed,
      isPaused: options?.paused !== undefined ? options.paused : store.getState().isPaused,
    });
  },
};

