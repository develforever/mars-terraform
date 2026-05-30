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
}
