import { describe, it, expect } from "vitest";
import { ColonistService } from "./ColonistService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import type { PlacedBuilding } from "../entities/Building";
import type { ColonyPopulation } from "../entities/Colonist";

describe("ColonistService", () => {
  describe("calculateCapacity", () => {
    it("should return 0 when no habitat buildings are placed", () => {
      const placed: PlacedBuilding[] = [
        { id: "solar-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100 },
      ];
      expect(ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS)).toBe(0);
    });

    it("should return 10 for a single Level 1 habitat", () => {
      const placed: PlacedBuilding[] = [
        { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 },
      ];
      expect(ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS)).toBe(10);
    });

    it("should scale capacity for Level 2 (20) and Level 3 (35) habitats", () => {
      const placed: PlacedBuilding[] = [
        { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 2 },
        { id: "hab-2", definitionId: "hab", position: { x: 1, y: 0, z: 0 }, condition: 100, level: 3 },
      ];
      // 20 + 35 = 55
      expect(ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS)).toBe(55);
    });
  });

  describe("assignRole", () => {
    const basePopulation: ColonyPopulation = {
      total: 10,
      capacity: 20,
      roles: {
        unassigned: 4,
        engineer: 2,
        scientist: 1,
        farmer: 2,
        miner: 1,
      },
    };

    it("should assign colonists from unassigned to engineer", () => {
      const updated = ColonistService.assignRole(basePopulation, "engineer", 2);
      expect(updated.roles.unassigned).toBe(2);
      expect(updated.roles.engineer).toBe(4);
      expect(updated.total).toBe(10);
    });

    it("should cap assignment to available unassigned count", () => {
      const updated = ColonistService.assignRole(basePopulation, "scientist", 10);
      expect(updated.roles.unassigned).toBe(0);
      expect(updated.roles.scientist).toBe(5); // 1 + 4
    });

    it("should unassign colonists from a role back to unassigned", () => {
      const updated = ColonistService.assignRole(basePopulation, "farmer", -1);
      expect(updated.roles.unassigned).toBe(5);
      expect(updated.roles.farmer).toBe(1);
    });

    it("should not reduce a role below 0", () => {
      const updated = ColonistService.assignRole(basePopulation, "miner", -5);
      expect(updated.roles.unassigned).toBe(5); // 4 + 1
      expect(updated.roles.miner).toBe(0);
    });

    it("should return the exact same population if delta is 0 or role is unassigned", () => {
      expect(ColonistService.assignRole(basePopulation, "engineer", 0)).toEqual(basePopulation);
      expect(ColonistService.assignRole(basePopulation, "unassigned", 2)).toEqual(basePopulation);
    });
  });

  describe("calculateConsumption", () => {
    it("should calculate O2, water and biomass consumption for population", () => {
      const pop: ColonyPopulation = {
        total: 10,
        capacity: 10,
        roles: { unassigned: 10, engineer: 0, scientist: 0, farmer: 0, miner: 0 },
      };
      const cons = ColonistService.calculateConsumption(pop);
      expect(cons.o2).toBeCloseTo(-0.1, 4);
      expect(cons.water).toBeCloseTo(-0.1, 4);
      expect(cons.biomass).toBeCloseTo(-0.08, 4);
    });

    it("should return empty object for 0 population", () => {
      const pop: ColonyPopulation = {
        total: 0,
        capacity: 10,
        roles: { unassigned: 0, engineer: 0, scientist: 0, farmer: 0, miner: 0 },
      };
      expect(ColonistService.calculateConsumption(pop)).toEqual({});
    });
  });

  describe("calculateMorale", () => {
    it("should produce high morale (>75) and +15% productivity bonus when needs are satisfied", () => {
      const pop: ColonyPopulation = {
        total: 10,
        capacity: 10,
        roles: { unassigned: 10, engineer: 0, scientist: 0, farmer: 0, miner: 0 },
      };
      const morale = ColonistService.calculateMorale(
        { o2: 10, power: 10, water: 10, biomass: 10, minerals: 10 },
        { power: 20, water: 20, biomass: 20, minerals: 20 },
        pop
      );

      expect(morale.value).toBe(100);
      expect(morale.productivityMultiplier).toBe(1.15);
      expect(morale.factors.housingSatisfaction).toBe(100);
      expect(morale.factors.o2Satisfaction).toBe(100);
      expect(morale.factors.waterSatisfaction).toBe(100);
      expect(morale.factors.foodSatisfaction).toBe(100);
    });

    it("should produce low morale (<30) and -30% productivity penalty when vital resources are 0", () => {
      const pop: ColonyPopulation = {
        total: 10,
        capacity: 5, // Overcrowded
        roles: { unassigned: 10, engineer: 0, scientist: 0, farmer: 0, miner: 0 },
      };
      const morale = ColonistService.calculateMorale(
        { o2: 0, power: 10, water: 0, biomass: 0, minerals: 0 },
        { power: 20, water: 20, biomass: 20, minerals: 20 },
        pop
      );

      expect(morale.value).toBeLessThan(30);
      expect(morale.productivityMultiplier).toBe(0.7);
    });
  });

  describe("calculateRoleBonuses", () => {
    it("should compute bonuses correctly per profession", () => {
      const roles = {
        unassigned: 0,
        engineer: 3, // +9% power
        scientist: 2, // +0.2 RP
        farmer: 4, // +16% greenhouse
        miner: 2, // +10% mining
      };
      const bonuses = ColonistService.calculateRoleBonuses(roles);
      expect(bonuses.engineerPowerMultiplier).toBeCloseTo(1.09, 4);
      expect(bonuses.scientistRPDelta).toBeCloseTo(0.2, 4);
      expect(bonuses.farmerBonusMultiplier).toBeCloseTo(1.16, 4);
      expect(bonuses.minerBonusMultiplier).toBeCloseTo(1.10, 4);
    });
  });

  describe("processShuttleArrival", () => {
    const popWithSpace: ColonyPopulation = {
      total: 5,
      capacity: 10,
      roles: { unassigned: 1, engineer: 1, scientist: 1, farmer: 1, miner: 1 },
    };

    it("should bring up to 3 colonists every 30 ticks when capacity is available", () => {
      const result = ColonistService.processShuttleArrival(popWithSpace, 30);
      expect(result.arrived).toBe(3);
      expect(result.population.total).toBe(8);
      expect(result.population.roles.unassigned).toBe(4);
    });

    it("should not bring colonists on non-interval ticks", () => {
      const result = ColonistService.processShuttleArrival(popWithSpace, 29);
      expect(result.arrived).toBe(0);
      expect(result.population.total).toBe(5);
    });

    it("should respect maximum habitat capacity constraint", () => {
      const almostFullPop: ColonyPopulation = {
        total: 9,
        capacity: 10,
        roles: { unassigned: 9, engineer: 0, scientist: 0, farmer: 0, miner: 0 },
      };
      const result = ColonistService.processShuttleArrival(almostFullPop, 60);
      expect(result.arrived).toBe(1); // Only 1 spot available
      expect(result.population.total).toBe(10);
    });
  });
});
