import { describe, it, expect } from "vitest";
import { BUILDING_DEFINITIONS, BUILDING_SEED } from "../../config/buildings";
import { TECH_IDS, TECHNOLOGIES } from "../../config/technologies";
import { ResearchService } from "../ResearchService";
import { EconomyService } from "../EconomyService";
import { TerraformingService } from "../TerraformingService";
import { ColonistService } from "../ColonistService";
import { getBuildingModel } from "../../../presentation/components/game/buildingModels";
import type { PlacedBuilding } from "../../entities/Building";
import type { ColonyState } from "../../entities/Colony";

describe("Megastructures Domain & Economy Engine (Phase 7.2)", () => {
  describe("Building Definitions & Config", () => {
    it("should correctly configure biosphere_dome megastructure", () => {
      const def = BUILDING_DEFINITIONS.biosphere_dome;
      expect(def).toBeDefined();
      expect(def.cost).toEqual({ biomass: 200, water: 100 });
      expect(def.production?.power).toBe(-20);
      expect(def.production?.o2).toBe(2.0);
      expect(def.production?.biomass).toBe(1.5);
      expect(def.colonistCapacity).toBe(50);
      expect(def.requiredTech).toBe("biodome");
      expect(def.dependsOn).toContain("greenhouse");
      expect(def.modelPath).toBe("/models/mars/hangar_roundGlass.glb");
    });

    it("should correctly configure atmosphere_factory megastructure", () => {
      const def = BUILDING_DEFINITIONS.atmosphere_factory;
      expect(def).toBeDefined();
      expect(def.cost).toEqual({ biomass: 300, power: 50 });
      expect(def.production?.biomass).toBe(-0.2);
      expect(def.production?.power).toBe(-5);
      expect(def.production?.o2).toBe(1.2);
      expect(def.requiredTech).toBe("atmosphere_terraforming");
      expect(def.dependsOn).toContain("o2-gen");
      expect(def.modelPath).toBe("/models/mars/rocket_baseA.glb");
    });

    it("should correctly configure fusion_reactor megastructure", () => {
      const def = BUILDING_DEFINITIONS.fusion_reactor;
      expect(def).toBeDefined();
      expect(def.cost).toEqual({ biomass: 400 });
      expect(def.production?.power).toBe(150);
      expect(def.production?.water).toBe(-0.1);
      expect(def.requiredTech).toBe("fusion_power");
      expect(def.dependsOn).toContain("rtg");
      expect(def.modelPath).toBe("/models/mars/machine_generatorLarge.glb");
    });

    it("should include all 3 megastructures in BUILDING_SEED", () => {
      const seedIds = BUILDING_SEED.map((b) => b.id);
      expect(seedIds).toContain("biosphere_dome");
      expect(seedIds).toContain("atmosphere_factory");
      expect(seedIds).toContain("fusion_reactor");
    });
  });

  describe("Technology Tree Integration", () => {
    it("should link biosphere_dome to BIODOME technology", () => {
      const biodomeTech = TECHNOLOGIES[TECH_IDS.BIODOME];
      expect(biodomeTech).toBeDefined();
      expect(biodomeTech.unlocksBuildings).toContain("biosphere_dome");
    });

    it("should define ATMOSPHERE_TERRAFORMING tech unlocking atmosphere_factory", () => {
      const tech = TECHNOLOGIES[TECH_IDS.ATMOSPHERE_TERRAFORMING];
      expect(tech).toBeDefined();
      expect(tech.category).toBe("terraforming");
      expect(tech.costRP).toBe(140);
      expect(tech.prereqs).toContain(TECH_IDS.O2_SYNTHESIS);
      expect(tech.unlocksBuildings).toContain("atmosphere_factory");
    });

    it("should define FUSION_POWER tech unlocking fusion_reactor", () => {
      const tech = TECHNOLOGIES[TECH_IDS.FUSION_POWER];
      expect(tech).toBeDefined();
      expect(tech.category).toBe("energy");
      expect(tech.costRP).toBe(160);
      expect(tech.prereqs).toContain(TECH_IDS.NUCLEAR_POWER);
      expect(tech.unlocksBuildings).toContain("fusion_reactor");
    });

    it("should verify building accessibility through ResearchService", () => {
      // Locked initially
      expect(ResearchService.isBuildingUnlocked("fusion_reactor", BUILDING_DEFINITIONS, [])).toBe(false);
      expect(ResearchService.isBuildingUnlocked("atmosphere_factory", BUILDING_DEFINITIONS, [])).toBe(false);
      expect(ResearchService.isBuildingUnlocked("biosphere_dome", BUILDING_DEFINITIONS, [])).toBe(false);

      // Unlocked when tech researched
      expect(
        ResearchService.isBuildingUnlocked("fusion_reactor", BUILDING_DEFINITIONS, [TECH_IDS.FUSION_POWER])
      ).toBe(true);
      expect(
        ResearchService.isBuildingUnlocked("atmosphere_factory", BUILDING_DEFINITIONS, [TECH_IDS.ATMOSPHERE_TERRAFORMING])
      ).toBe(true);
      expect(
        ResearchService.isBuildingUnlocked("biosphere_dome", BUILDING_DEFINITIONS, [TECH_IDS.BIODOME])
      ).toBe(true);
    });
  });

  describe("Economy Simulation & Resource Profiles", () => {
    it("should generate massive power (+150 kW) from Fusion Reactor while consuming water (-0.1)", () => {
      const placed: PlacedBuilding[] = [
        { id: "fusion-1", definitionId: "fusion_reactor", position: { x: 0, y: 0, z: 0 }, condition: 100 },
      ];

      const prod = EconomyService.calculateProduction(placed, BUILDING_DEFINITIONS, 1.0);
      expect(prod.power).toBe(150);
      expect(prod.water).toBe(-0.1);
    });

    it("should scale Fusion Reactor power with Engineer role bonuses", () => {
      const placed: PlacedBuilding[] = [
        { id: "fusion-1", definitionId: "fusion_reactor", position: { x: 0, y: 0, z: 0 }, condition: 100 },
      ];

      const prod = EconomyService.calculateProduction(
        placed,
        BUILDING_DEFINITIONS,
        1.0,
        1.0,
        [],
        "clear",
        {
          engineerPowerMultiplier: 1.15,
          farmerBonusMultiplier: 1.0,
          minerBonusMultiplier: 1.0,
          scientistRPDelta: 0,
        }
      );

      expect(prod.power).toBeCloseTo(172.5, 2);
    });

    it("should calculate large colonist housing capacity for Biosphere Dome", () => {
      const placed: PlacedBuilding[] = [
        { id: "bio-1", definitionId: "biosphere_dome", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 },
      ];

      const capLvl1 = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
      expect(capLvl1).toBe(50);

      // Level 2 upgrade -> 100 capacity
      placed[0].level = 2;
      const capLvl2 = ColonistService.calculateCapacity(placed, BUILDING_DEFINITIONS);
      expect(capLvl2).toBe(100);
    });

    it("should run economy tick with active megastructures", () => {
      const colony: ColonyState = {
        resources: { o2: 100, power: 50, water: 50, biomass: 50 },
        capacity: { power: 500, water: 500, biomass: 500 },
        sun: 1.0,
        alive: true,
      };

      const placed: PlacedBuilding[] = [
        { id: "fusion-1", definitionId: "fusion_reactor", position: { x: 0, y: 0, z: 0 }, condition: 100 },
        { id: "atmo-1", definitionId: "atmosphere_factory", position: { x: 5, y: 0, z: 5 }, condition: 100 },
      ];

      const result = EconomyService.tick(colony, placed, BUILDING_DEFINITIONS);
      expect(result.gameOver).toBe(false);
      // Net power: +150 (fusion) - 5 (atmo) = +145
      expect(result.delta.power).toBeCloseTo(145, 2);
      // Net water: -0.1 (fusion)
      expect(result.delta.water).toBeCloseTo(-0.1, 2);
      // Net biomass: -0.2 (atmo)
      expect(result.delta.biomass).toBeCloseTo(-0.2, 2);
      // Net O2: +1.2 (atmo) - 2 * 0.05 (2 buildings base consumption) = +1.1
      expect(result.delta.o2).toBeCloseTo(1.1, 2);
    });
  });

  describe("Terraforming Acceleration & Atmospheric Heating", () => {
    it("should accelerate temperature increase with active Atmosphere Factories", () => {
      // 50% terraforming progress base temp = -22.5°C
      const baseTemp = TerraformingService.calculateTemperature(50, 0);
      expect(baseTemp).toBeCloseTo(-22.5, 2);

      // 1 factory -> +2.5°C boost
      const temp1 = TerraformingService.calculateTemperature(50, 1);
      expect(temp1).toBeCloseTo(-20.0, 2);

      // 3 factories -> +7.5°C boost
      const temp3 = TerraformingService.calculateTemperature(50, 3);
      expect(temp3).toBeCloseTo(-15.0, 2);
    });

    it("should calculate atmospheric pressure and boost from Atmosphere Factories", () => {
      // 0% progress, 0 factories -> 0.6 kPa
      const startPressure = TerraformingService.calculateAtmosphericPressure(0, 0);
      expect(startPressure).toBeCloseTo(0.6, 2);

      // 100% progress, 0 factories -> 101.3 kPa
      const fullPressure = TerraformingService.calculateAtmosphericPressure(100, 0);
      expect(fullPressure).toBeCloseTo(101.3, 2);

      // 2 factories at 20% progress
      const boostedPressure = TerraformingService.calculateAtmosphericPressure(20, 2);
      const expectedBase = 0.6 + 0.2 * (101.3 - 0.6); // 20.74 kPa
      expect(boostedPressure).toBeCloseTo(expectedBase + 6.0, 2);
    });
  });

  describe("Visual Model Resolution", () => {
    it("should resolve GLB models for all megastructures", () => {
      expect(getBuildingModel("biosphere_dome")).toBe("/models/mars/hangar_roundGlass.glb");
      expect(getBuildingModel("atmosphere_factory")).toBe("/models/mars/rocket_baseA.glb");
      expect(getBuildingModel("fusion_reactor")).toBe("/models/mars/machine_generatorLarge.glb");
    });
  });
});