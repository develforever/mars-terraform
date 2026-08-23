import { describe, it, expect } from "vitest";
import { TerraformingService, MIN_WATER_LEVEL, MAX_WATER_LEVEL, DIFFICULTY_TARGETS } from "../TerraformingService";
import { TERRAIN_HEIGHT } from "../../../presentation/generator/hex/HexGrid";

describe("TerraformingService - Dynamic Water Bodies", () => {
  it("should calculate minimum water level when water resources and terraforming progress are zero", () => {
    const level = TerraformingService.calculateWaterLevel(0, 0, "normal");
    expect(level).toBeCloseTo(MIN_WATER_LEVEL, 3);
    expect(level).toBeCloseTo(-0.5, 3);
  });

  it("should calculate maximum water level when water resources reach target and progress is 100%", () => {
    const targetWater = DIFFICULTY_TARGETS.normal.water;
    const level = TerraformingService.calculateWaterLevel(targetWater, 100, "normal");
    expect(level).toBeCloseTo(MAX_WATER_LEVEL, 3);
    expect(level).toBeCloseTo(1.3, 3);
  });

  it("should scale water level proportionally across difficulties", () => {
    const easyLevel = TerraformingService.calculateWaterLevel(80, 50, "easy");
    const hardLevel = TerraformingService.calculateWaterLevel(400, 50, "hard");

    // Both reach 100% of their respective water target and 50% terraforming
    expect(easyLevel).toBeCloseTo(hardLevel, 3);
    expect(easyLevel).toBeGreaterThan(MIN_WATER_LEVEL);
    expect(easyLevel).toBeLessThan(MAX_WATER_LEVEL);
  });

  it("should correctly identify submerged cells for various terrain heights", () => {
    // Terrain heights:
    // deep_crater: 0.0
    // lowland:     0.6
    // plains:      1.2
    // highland:    2.0
    // peak:        4.0

    // At dry level (-0.5), no cells are submerged
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.deep_crater, -0.5)).toBe(false);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.lowland, -0.5)).toBe(false);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.plains, -0.5)).toBe(false);

    // At water level 0.2 (crater filling), deep_crater is submerged
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.deep_crater, 0.2)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.lowland, 0.2)).toBe(false);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.plains, 0.2)).toBe(false);

    // At water level 0.8 (lowlands filling), deep_crater and lowland are submerged
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.deep_crater, 0.8)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.lowland, 0.8)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.plains, 0.8)).toBe(false);

    // At maximum water level 1.3, deep_crater, lowland and plains are submerged, but highland and peak remain dry
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.deep_crater, 1.3)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.lowland, 1.3)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.plains, 1.3)).toBe(true);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.highland, 1.3)).toBe(false);
    expect(TerraformingService.isSubmerged(TERRAIN_HEIGHT.peak, 1.3)).toBe(false);
  });
});
