import { describe, it, expect } from "vitest";
import { INITIAL_COLONY_STATE } from "../../entities/Colony";
import type { ColonyState } from "../../entities/Colony";
import type { PlacedBuilding } from "../../entities/Building";
import { BUILDING_DEFINITIONS } from "../../config/buildings";
import { INITIAL_POPULATION } from "../../entities/Colonist";
import { EconomyService } from "../EconomyService";
import { BuildingService } from "../BuildingService";

describe("EconomyDeadlock verification", () => {
  const startHab: PlacedBuilding = {
    id: "colony-center-hab",
    definitionId: "hab",
    position: { x: 0, y: 0, z: 0 },
    condition: 100,
    level: 1,
  };

  it("nie istnieje stan, w którym gracz nie może nic zbudować", () => {
    let colony: ColonyState = {
      ...INITIAL_COLONY_STATE,
      resources: { ...INITIAL_COLONY_STATE.resources },
      capacity: { ...INITIAL_COLONY_STATE.capacity },
    };

    const initialBuildings = [startHab];

    for (let tick = 1; tick <= 1200; tick++) {
      // Simulate variable sun cycle (0.2 to 1.0)
      const sunFactor = 0.6 + 0.4 * Math.sin((tick / 60) * Math.PI);
      colony.sun = Math.max(0.2, Math.min(1.0, sunFactor));

      const tickResult = EconomyService.tick(
        colony,
        initialBuildings,
        BUILDING_DEFINITIONS,
        1,
        [],
        0,
        "clear",
        INITIAL_POPULATION
      );

      colony = {
        ...colony,
        resources: {
          o2: colony.resources.o2 + (tickResult.delta.o2 ?? 0),
          power: colony.resources.power + (tickResult.delta.power ?? 0),
          water: colony.resources.water + (tickResult.delta.water ?? 0),
          biomass: colony.resources.biomass + (tickResult.delta.biomass ?? 0),
          minerals: colony.resources.minerals + (tickResult.delta.minerals ?? 0),
        },
        alive: !tickResult.gameOver,
      };

      // Filter definitions that do not require research AND whose dependsOn is satisfied
      const availableNow = Object.values(BUILDING_DEFINITIONS).filter(
        (def) => !def.requiredTech && BuildingService.hasRequirements(def, initialBuildings)
      );

      expect(availableNow.length).toBeGreaterThan(0);

      // Assert: in every tick, player can afford at least one early building definition
      const canAffordAtLeastOne = availableNow.some((def) =>
        BuildingService.canAfford(def.cost, colony.resources)
      );

      expect(canAffordAtLeastOne).toBe(true);
    }
  });

  it("minerały rosną przy samym habitacie", () => {
    let colony: ColonyState = {
      ...INITIAL_COLONY_STATE,
      resources: { ...INITIAL_COLONY_STATE.resources },
      capacity: { ...INITIAL_COLONY_STATE.capacity },
    };

    const initialMinerals = colony.resources.minerals;
    const initialBuildings = [startHab];

    for (let tick = 1; tick <= 600; tick++) {
      const tickResult = EconomyService.tick(
        colony,
        initialBuildings,
        BUILDING_DEFINITIONS,
        1,
        [],
        0,
        "clear",
        INITIAL_POPULATION
      );

      colony = {
        ...colony,
        resources: {
          o2: colony.resources.o2 + (tickResult.delta.o2 ?? 0),
          power: colony.resources.power + (tickResult.delta.power ?? 0),
          water: colony.resources.water + (tickResult.delta.water ?? 0),
          biomass: colony.resources.biomass + (tickResult.delta.biomass ?? 0),
          minerals: colony.resources.minerals + (tickResult.delta.minerals ?? 0),
        },
      };
    }

    expect(colony.resources.minerals).toBeGreaterThan(initialMinerals);
  });

  it("brak minerałów nie zabija kolonii", () => {
    let colony: ColonyState = {
      ...INITIAL_COLONY_STATE,
      resources: {
        o2: 10,
        power: 10,
        water: 10,
        biomass: 10,
        minerals: 0,
      },
      capacity: {
        power: 20,
        water: 20,
        biomass: 20,
        minerals: 200,
      },
      alive: true,
    };

    // Stable setup with hab, greenhouse, solar and ice extractor
    const buildings: PlacedBuilding[] = [
      startHab,
      { id: "b-solar", definitionId: "solar", position: { x: 1, y: 0, z: 0 }, condition: 100, level: 1 },
      { id: "b-ice", definitionId: "ice", position: { x: 2, y: 0, z: 0 }, condition: 100, level: 1 },
      { id: "b-gh", definitionId: "greenhouse", position: { x: 3, y: 0, z: 0 }, condition: 100, level: 1 },
    ];

    for (let tick = 1; tick <= 300; tick++) {
      const tickResult = EconomyService.tick(
        colony,
        buildings,
        BUILDING_DEFINITIONS,
        1,
        [],
        0,
        "clear",
        INITIAL_POPULATION
      );

      colony = {
        ...colony,
        resources: {
          o2: colony.resources.o2 + (tickResult.delta.o2 ?? 0),
          power: colony.resources.power + (tickResult.delta.power ?? 0),
          water: colony.resources.water + (tickResult.delta.water ?? 0),
          biomass: colony.resources.biomass + (tickResult.delta.biomass ?? 0),
          minerals: colony.resources.minerals + (tickResult.delta.minerals ?? 0),
        },
        alive: !tickResult.gameOver,
      };

      expect(colony.alive).toBe(true);
    }
  });

  it("stary scenariusz deadlocku nie wraca", () => {
    let colony: ColonyState = {
      ...INITIAL_COLONY_STATE,
      resources: { ...INITIAL_COLONY_STATE.resources },
      capacity: { ...INITIAL_COLONY_STATE.capacity },
    };

    const initialBuildings = [startHab];

    for (let tick = 1; tick <= 300; tick++) {
      const tickResult = EconomyService.tick(
        colony,
        initialBuildings,
        BUILDING_DEFINITIONS,
        1,
        [],
        0,
        "clear",
        INITIAL_POPULATION
      );

      colony = {
        ...colony,
        resources: {
          o2: colony.resources.o2 + (tickResult.delta.o2 ?? 0),
          power: colony.resources.power + (tickResult.delta.power ?? 0),
          water: colony.resources.water + (tickResult.delta.water ?? 0),
          biomass: colony.resources.biomass + (tickResult.delta.biomass ?? 0),
          minerals: colony.resources.minerals + (tickResult.delta.minerals ?? 0),
        },
        alive: !tickResult.gameOver,
      };

      // In every tick, solar panel must remain affordable
      const canAffordSolar = BuildingService.canAfford(
        BUILDING_DEFINITIONS.solar.cost,
        colony.resources
      );
      expect(canAffordSolar).toBe(true);
    }
  });
});