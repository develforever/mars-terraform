import { describe, it, expect } from "vitest";
import { getBuildingModel, BUILDING_LEVEL_MODELS, MODEL_PATHS } from "../buildingModels";
import { BUILDING_DEFINITIONS } from "../../../../domain/config/buildings";

describe("Building Visual Level Variants (getBuildingModel)", () => {
  it("should return level 1 model for default or undefined level", () => {
    expect(getBuildingModel("ice")).toBe("/models/mars/pipe_entrance.glb");
    expect(getBuildingModel("miner", 1)).toBe("/models/mars/craft_miner.glb");
    expect(getBuildingModel("lab", 1)).toBe("/models/mars/machine_wireless.glb");
    expect(getBuildingModel("solar", 1)).toBe("/models/mars/machine_generator.glb");
    expect(getBuildingModel("rtg", 1)).toBe("/models/mars/machine_generatorLarge.glb");
  });

  it("should return level 2 models for upgraded buildings", () => {
    expect(getBuildingModel("ice", 2)).toBe("/models/mars/ice_lvl2.glb");
    expect(getBuildingModel("ice_extractor", 2)).toBe("/models/mars/ice_lvl2.glb");
    expect(getBuildingModel("miner", 2)).toBe("/models/mars/miner_lvl2.glb");
    expect(getBuildingModel("lab", 2)).toBe("/models/mars/lab_lvl2.glb");
    expect(getBuildingModel("solar", 2)).toBe("/models/mars/solar_lvl2.glb");
    expect(getBuildingModel("rtg", 2)).toBe("/models/mars/rtg_lvl2.glb");
    expect(getBuildingModel("greenhouse", 2)).toBe("/models/mars/greenhouse_lvl2.glb");
    expect(getBuildingModel("o2-gen", 2)).toBe("/models/mars/o2-gen_lvl2.glb");
  });

  it("should return level 3 models for upgraded buildings", () => {
    expect(getBuildingModel("ice", 3)).toBe("/models/mars/ice_lvl3.glb");
    expect(getBuildingModel("ice_extractor", 3)).toBe("/models/mars/ice_lvl3.glb");
    expect(getBuildingModel("miner", 3)).toBe("/models/mars/miner_lvl3.glb");
    expect(getBuildingModel("lab", 3)).toBe("/models/mars/lab_lvl3.glb");
    expect(getBuildingModel("solar", 3)).toBe("/models/mars/solar_lvl3.glb");
    expect(getBuildingModel("rtg", 3)).toBe("/models/mars/rtg_lvl3.glb");
    expect(getBuildingModel("greenhouse", 3)).toBe("/models/mars/greenhouse_lvl3.glb");
    expect(getBuildingModel("o2-gen", 3)).toBe("/models/mars/o2-gen_lvl3.glb");
  });

  it("should gracefully fall back to base model for non-upgradable or unknown levels", () => {
    expect(getBuildingModel("hab", 1)).toBe(BUILDING_DEFINITIONS.hab?.modelPath);
    expect(getBuildingModel("hab", 2)).toBe(BUILDING_DEFINITIONS.hab?.modelPath);
    expect(getBuildingModel("turret", 3)).toBe(BUILDING_DEFINITIONS.turret?.modelPath);
    expect(getBuildingModel("nonexistent", 1)).toBeUndefined();
  });

  it("should include all level variants in MODEL_PATHS for preloading", () => {
    expect(MODEL_PATHS).toContain("/models/mars/ice_lvl2.glb");
    expect(MODEL_PATHS).toContain("/models/mars/ice_lvl3.glb");
    expect(MODEL_PATHS).toContain("/models/mars/miner_lvl2.glb");
    expect(MODEL_PATHS).toContain("/models/mars/miner_lvl3.glb");
    expect(MODEL_PATHS).toContain("/models/mars/lab_lvl2.glb");
    expect(MODEL_PATHS).toContain("/models/mars/lab_lvl3.glb");
    expect(MODEL_PATHS).toContain("/models/mars/solar_lvl2.glb");
    expect(MODEL_PATHS).toContain("/models/mars/solar_lvl3.glb");
    expect(MODEL_PATHS).toContain("/models/mars/rtg_lvl2.glb");
    expect(MODEL_PATHS).toContain("/models/mars/rtg_lvl3.glb");
  });

  it("should ensure all registered model paths follow standard /models/mars/ naming convention", () => {
    for (const [buildingId, levels] of Object.entries(BUILDING_LEVEL_MODELS)) {
      for (const [level, modelPath] of Object.entries(levels)) {
        expect(modelPath, `Building ${buildingId} lvl ${level} path invalid`).toMatch(/^\/models\/mars\/.+\.glb$/);
      }
    }
  });
});
