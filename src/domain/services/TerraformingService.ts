import type { Resources, ResourceDelta } from "../entities/Resources";

export type DifficultyLevel = "easy" | "normal" | "hard";

export interface TerraformingTargets {
  o2Accumulated: number;
  biomass: number;
  water: number;
}

/**
 * Per-difficulty targets.
 *
 * Score formula (max 100 pts):
 *   O₂ accumulated → 50 pts
 *   Biomass current → 30 pts
 *   Water current   → 20 pts
 */
export const DIFFICULTY_TARGETS: Record<DifficultyLevel, TerraformingTargets> = {
  easy:   { o2Accumulated: 400,  biomass: 150, water: 80  },
  normal: { o2Accumulated: 800,  biomass: 300, water: 150 },
  hard:   { o2Accumulated: 2000, biomass: 800, water: 400 },
};


export const MIN_WATER_LEVEL = -0.5;
export const MAX_WATER_LEVEL = 1.3;

export class TerraformingService {
  static calculateProgress(
    o2Accumulated: number,
    resources: Resources,
    difficulty: DifficultyLevel = "normal"
  ): number {
    const t = DIFFICULTY_TARGETS[difficulty];
    const o2Score      = Math.min(1, o2Accumulated   / t.o2Accumulated) * 50;
    const biomassScore = Math.min(1, resources.biomass / t.biomass)      * 30;
    const waterScore   = Math.min(1, resources.water   / t.water)        * 20;
    return Math.min(100, o2Score + biomassScore + waterScore);
  }

  static accumulateO2(current: number, delta: ResourceDelta): number {
    const produced = delta.o2 ?? 0;
    if (produced <= 0) return current;
    return current + produced;
  }

  static isComplete(progress: number): boolean {
    return progress >= 100;
  }

  /**
   * Calculates global 3D water level Y based on current water resource and terraforming progress.
   * Range: [MIN_WATER_LEVEL (-0.5), MAX_WATER_LEVEL (1.3)]
   */
  static calculateWaterLevel(
    waterCurrent: number,
    terraformingProgress: number,
    difficulty: DifficultyLevel = "normal"
  ): number {
    const t = DIFFICULTY_TARGETS[difficulty];
    const waterRatio = Math.max(0, Math.min(1, waterCurrent / t.water));
    const tfRatio = Math.max(0, Math.min(1, terraformingProgress / 100));
    const combined = waterRatio * 0.7 + tfRatio * 0.3;
    return MIN_WATER_LEVEL + combined * (MAX_WATER_LEVEL - MIN_WATER_LEVEL);
  }

  /**
   * Determines if a cell or height is submerged under the current water level.
   */
  static isSubmerged(worldY: number, waterLevel: number): boolean {
    return worldY <= waterLevel + 1e-4;
  }

  /**
   * Calculates global Mars surface temperature in °C based on terraforming progress and active Atmosphere Factories.
   * Progress 0% -> -60.0°C (barren Martian frost)
   * Progress 100% -> +15.0°C (temperate climate)
   * Each active Atmosphere Factory adds +2.5°C thermal greenhouse acceleration.
   */
  static calculateTemperature(
    terraformingProgress: number,
    atmosphereFactoriesCount: number = 0
  ): number {
    const progressRatio = Math.max(0, Math.min(1, terraformingProgress / 100));
    const baseTemp = -60 + progressRatio * 75;
    const factoryBoost = atmosphereFactoriesCount * 2.5;
    return Math.min(25.0, baseTemp + factoryBoost);
  }

  /**
   * Calculates global atmospheric pressure in kPa based on terraforming progress and active Atmosphere Factories.
   * Base Mars pressure: 0.6 kPa (barren vacuum-like atmosphere)
   * Target Earth-like pressure: 101.3 kPa
   * Each active Atmosphere Factory adds +3.0 kPa pressure acceleration.
   */
  static calculateAtmosphericPressure(
    terraformingProgress: number,
    atmosphereFactoriesCount: number = 0
  ): number {
    const progressRatio = Math.max(0, Math.min(1, terraformingProgress / 100));
    const basePressure = 0.6 + progressRatio * (101.3 - 0.6);
    const factoryBoost = atmosphereFactoriesCount * 3.0;
    return Math.min(120.0, basePressure + factoryBoost);
  }

  /**
   * Calculates plant growth suitability based on global temperature.
   * Below -15°C: 0.0 (frozen tundra, no growth)
   * Between -15°C and +5°C: linear interpolation (germination / lichen)
   * Above +5°C: 1.0 (optimal plant growth)
   */
  static calculateTemperatureSuitability(temperature: number): number {
    if (temperature <= -15) return 0;
    if (temperature >= 5) return 1;
    return (temperature - (-15)) / (5 - (-15));
  }

  /**
   * Calculates plant growth suitability based on accumulated O2.
   */
  static calculateO2Suitability(
    o2Accumulated: number,
    difficulty: DifficultyLevel = "normal"
  ): number {
    const target = DIFFICULTY_TARGETS[difficulty].o2Accumulated;
    return Math.max(0, Math.min(1, o2Accumulated / target));
  }

  /**
   * Calculates global biosphere suitability index [0.0, 1.0] from temperature, O2, and progress.
   */
  static calculateGlobalBiosphereSuitability(
    o2Accumulated: number,
    terraformingProgress: number,
    difficulty: DifficultyLevel = "normal",
    atmosphereFactoriesCount: number = 0
  ): number {
    const temp = this.calculateTemperature(terraformingProgress, atmosphereFactoriesCount);
    const tempSuitability = this.calculateTemperatureSuitability(temp);
    const o2Suitability = this.calculateO2Suitability(o2Accumulated, difficulty);
    const progressSuitability = Math.max(0, Math.min(1, terraformingProgress / 100));

    // Weighted suitability: temperature (40%), O2 atmosphere (40%), overall progress (20%)
    const rawSuitability = tempSuitability * 0.4 + o2Suitability * 0.4 + progressSuitability * 0.2;
    return Math.max(0, Math.min(1, rawSuitability));
  }

  /**
   * Calculates local vegetation factor [0.0, 1.0] for a specific hex cell.
   *
   * @param cellWorldY Elevation of the hex top.
   * @param waterLevel Current global 3D water level.
   * @param globalSuitability Global biosphere index [0.0, 1.0].
   * @param options Optional parameters for moisture distribution.
   * @returns Vegetation factor in [0.0, 1.0] (0.0 = barren red dust, 1.0 = lush vegetation).
   */
  static calculateHexVegetationFactor(
    cellWorldY: number,
    waterLevel: number,
    globalSuitability: number,
    options: { maxMoistureHeight?: number } = {}
  ): number {
    // 1. Submerged cells cannot support surface land vegetation
    if (this.isSubmerged(cellWorldY, waterLevel)) {
      return 0.0;
    }

    if (globalSuitability <= 0.001) {
      return 0.0;
    }

    // 2. Moisture calculation based on elevation distance above water table
    const deltaHeight = Math.max(0, cellWorldY - waterLevel);
    const maxMoistureHeight = options.maxMoistureHeight ?? 3.5;

    // Exponential decay of moisture with distance from shoreline + baseline ambient humidity
    const shorelineMoisture = Math.exp(-deltaHeight * 1.2);
    const altitudeFactor = Math.max(0, 1 - deltaHeight / maxMoistureHeight);
    const localMoisture = Math.min(1, shorelineMoisture * 0.75 + altitudeFactor * 0.25);

    // 3. Combined local vegetation factor
    const vegFactor = globalSuitability * localMoisture;
    return Math.max(0, Math.min(1, vegFactor));
  }

  /**
   * Convenience method to calculate hex vegetation directly from colony parameters.
   */
  static calculateHexVegetation(
    cellWorldY: number,
    waterLevel: number,
    o2Accumulated: number,
    terraformingProgress: number,
    difficulty: DifficultyLevel = "normal"
  ): number {
    const suitability = this.calculateGlobalBiosphereSuitability(
      o2Accumulated,
      terraformingProgress,
      difficulty
    );
    return this.calculateHexVegetationFactor(cellWorldY, waterLevel, suitability);
  }
}
