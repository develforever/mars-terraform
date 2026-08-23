import { describe, it, expect } from "vitest";
import { UNIT_DEFINITIONS, UNIT_IDS, UNIT_LIST, getUnitDefinition } from "./units";
import { UNIT_MODEL_PATHS, getUnitModelPath } from "../../presentation/components/game/unitModels";
import assetManifest from "./assetManifest.json";

describe("Unit Definitions & Configurations", () => {
  it("should have all 5 key unit types configured", () => {
    expect(UNIT_LIST.length).toBe(5);
    expect(UNIT_DEFINITIONS[UNIT_IDS.ROVER]).toBeDefined();
    expect(UNIT_DEFINITIONS[UNIT_IDS.ROVER_COMBAT]).toBeDefined();
    expect(UNIT_DEFINITIONS[UNIT_IDS.CRAFT_MINER]).toBeDefined();
    expect(UNIT_DEFINITIONS[UNIT_IDS.DRONE_REPAIR]).toBeDefined();
    expect(UNIT_DEFINITIONS[UNIT_IDS.CRAFT_HAULER]).toBeDefined();
  });

  it("should have valid stats for each unit definition", () => {
    for (const unit of UNIT_LIST) {
      expect(unit.id).toBeTruthy();
      expect(unit.name).toBeTruthy();
      expect(unit.description).toBeTruthy();
      expect(unit.stats.health).toBeGreaterThan(0);
      expect(unit.stats.maxHealth).toBeGreaterThan(0);
      expect(unit.stats.speed).toBeGreaterThan(0);
      expect(unit.stats.powerConsumption).toBeGreaterThanOrEqual(0);
      expect(unit.modelPath.endsWith(".glb")).toBe(true);
      expect(unit.iconPath.endsWith(".webp")).toBe(true);
    }
  });

  it("should correctly configure specific unit roles and specialized stats", () => {
    const combatRover = getUnitDefinition(UNIT_IDS.ROVER_COMBAT);
    expect(combatRover).toBeDefined();
    expect(combatRover?.role).toBe("combat");
    expect(combatRover?.category).toBe("ground");
    expect(combatRover?.stats.attackDamage).toBeGreaterThan(0);
    expect(combatRover?.stats.attackRange).toBeGreaterThan(0);

    const repairDrone = getUnitDefinition(UNIT_IDS.DRONE_REPAIR);
    expect(repairDrone).toBeDefined();
    expect(repairDrone?.role).toBe("repair");
    expect(repairDrone?.category).toBe("air");
    expect(repairDrone?.stats.repairRate).toBeGreaterThan(0);

    const heavyHauler = getUnitDefinition(UNIT_IDS.CRAFT_HAULER);
    expect(heavyHauler).toBeDefined();
    expect(heavyHauler?.role).toBe("transport");
    expect(heavyHauler?.category).toBe("air");
    expect(heavyHauler?.stats.cargoCapacity).toBeGreaterThanOrEqual(50);
  });

  it("should match all unit models with assetManifest.json entries", () => {
    const manifestPaths = new Set(assetManifest.assets.map((a) => a.path));
    for (const unit of UNIT_LIST) {
      expect(
        manifestPaths.has(unit.modelPath),
        `Model ${unit.modelPath} for unit ${unit.id} is missing from assetManifest.json`
      ).toBe(true);
    }
  });

  it("should resolve unit model paths correctly via unitModels utility", () => {
    expect(getUnitModelPath(UNIT_IDS.ROVER_COMBAT)).toBe("/models/mars/rover_combat.glb");
    expect(getUnitModelPath(UNIT_IDS.DRONE_REPAIR)).toBe("/models/mars/drone_repair.glb");
    expect(getUnitModelPath(UNIT_IDS.CRAFT_HAULER)).toBe("/models/mars/craft_hauler.glb");
    expect(UNIT_MODEL_PATHS.length).toBeGreaterThanOrEqual(5);
  });
});
