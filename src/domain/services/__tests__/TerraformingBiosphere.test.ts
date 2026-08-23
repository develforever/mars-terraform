import { describe, it, expect } from "vitest";
import { TerraformingService, DIFFICULTY_TARGETS } from "../TerraformingService";
import { TERRAIN_HEIGHT } from "../../../presentation/generator/hex/HexGrid";

describe("TerraformingBiosphere - Temperature & Vegetation Factor", () => {
  it("should calculate correct Mars surface temperature across terraforming stages", () => {
    // 0% progress -> -60°C
    expect(TerraformingService.calculateTemperature(0)).toBeCloseTo(-60, 2);
    // 50% progress -> -22.5°C
    expect(TerraformingService.calculateTemperature(50)).toBeCloseTo(-22.5, 2);
    // 100% progress -> +15°C
    expect(TerraformingService.calculateTemperature(100)).toBeCloseTo(15, 2);
  });

  it("should calculate temperature suitability for vegetation growth", () => {
    // Frozen tundra (<= -15°C) -> 0 suitability
    expect(TerraformingService.calculateTemperatureSuitability(-60)).toBe(0);
    expect(TerraformingService.calculateTemperatureSuitability(-15)).toBe(0);

    // Mild thaw (-5°C) -> partial suitability
    const partialSuit = TerraformingService.calculateTemperatureSuitability(-5);
    expect(partialSuit).toBeGreaterThan(0);
    expect(partialSuit).toBeLessThan(1);
    expect(partialSuit).toBeCloseTo(0.5, 2);

    // Warm climate (>= 5°C) -> optimal suitability (1.0)
    expect(TerraformingService.calculateTemperatureSuitability(5)).toBe(1);
    expect(TerraformingService.calculateTemperatureSuitability(15)).toBe(1);
  });

  it("should calculate O2 suitability according to difficulty targets", () => {
    const targetNormal = DIFFICULTY_TARGETS.normal.o2Accumulated;
    expect(TerraformingService.calculateO2Suitability(0, "normal")).toBe(0);
    expect(TerraformingService.calculateO2Suitability(targetNormal / 2, "normal")).toBeCloseTo(0.5, 2);
    expect(TerraformingService.calculateO2Suitability(targetNormal, "normal")).toBe(1);
    expect(TerraformingService.calculateO2Suitability(targetNormal * 2, "normal")).toBe(1);
  });

  it("should calculate global biosphere suitability index", () => {
    // Barren start
    const startSuit = TerraformingService.calculateGlobalBiosphereSuitability(0, 0, "normal");
    expect(startSuit).toBe(0);

    // Halfway terraformed
    const targetO2 = DIFFICULTY_TARGETS.normal.o2Accumulated;
    const midSuit = TerraformingService.calculateGlobalBiosphereSuitability(targetO2 * 0.5, 50, "normal");
    expect(midSuit).toBeGreaterThan(0.2);
    expect(midSuit).toBeLessThan(0.8);

    // Fully terraformed
    const fullSuit = TerraformingService.calculateGlobalBiosphereSuitability(targetO2, 100, "normal");
    expect(fullSuit).toBeCloseTo(1.0, 2);
  });

  it("should return 0 vegetation factor for submerged cells", () => {
    const waterLevel = 0.5;
    const craterY = TERRAIN_HEIGHT.deep_crater; // 0.0, submerged
    const veg = TerraformingService.calculateHexVegetationFactor(craterY, waterLevel, 1.0);
    expect(veg).toBe(0);
  });

  it("should give higher vegetation factor to cells closer to the shoreline", () => {
    const waterLevel = 0.5;
    const shorelineCellY = 0.6; // lowland just above water
    const highCellY = 2.0;      // highland further away
    const peakCellY = 4.0;      // peak far above water

    const globalSuitability = 0.9;
    const vegShoreline = TerraformingService.calculateHexVegetationFactor(shorelineCellY, waterLevel, globalSuitability);
    const vegHigh = TerraformingService.calculateHexVegetationFactor(highCellY, waterLevel, globalSuitability);
    const vegPeak = TerraformingService.calculateHexVegetationFactor(peakCellY, waterLevel, globalSuitability);

    expect(vegShoreline).toBeGreaterThan(vegHigh);
    expect(vegHigh).toBeGreaterThan(vegPeak);
    expect(vegShoreline).toBeGreaterThan(0.5);
    expect(vegPeak).toBeGreaterThan(0); // non-zero baseline, but lower
  });

  it("should calculate complete hex vegetation factor with convenience helper", () => {
    const targetO2 = DIFFICULTY_TARGETS.normal.o2Accumulated;
    const vegInitial = TerraformingService.calculateHexVegetation(0.6, -0.5, 0, 0, "normal");
    expect(vegInitial).toBe(0);

    const vegAdvanced = TerraformingService.calculateHexVegetation(0.6, 0.5, targetO2, 100, "normal");
    expect(vegAdvanced).toBeGreaterThan(0.7);
    expect(vegAdvanced).toBeLessThanOrEqual(1.0);
  });
});
