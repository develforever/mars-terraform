import type { DifficultyLevel } from "../services/TerraformingService";

export interface GameAnalyticsSnapshot {
  tick: number;
  sol: number;
  resources: {
    energy: number;
    water: number;
    o2: number;
    minerals: number;
    biomass: number;
  };
  terraforming: {
    o2: number;
    temp: number;
    waterLevel: number;
    progress: number;
  };
  buildingsCount: number;
  aliensDefeated: number;
}

export type ColonyRank = "bronze" | "silver" | "gold" | "platinum";

export interface ColonyScoreBreakdown {
  totalScore: number;
  rank: ColonyRank;
  terraformingScore: number;
  survivalScore: number;
  resourceScore: number;
  alienScore: number;
  questScore: number;
  buildingScore: number;
  difficultyMultiplier: number;
}

export interface ColonyScoreInput {
  tick: number;
  sol: number;
  terraforming: number;
  o2Accumulated: number;
  waterLevel: number;
  resources: {
    power: number;
    water: number;
    o2: number;
    biomass: number;
  };
  placedCount: number;
  aliensDefeated: number;
  alienWave: number;
  completedQuestsCount: number;
  totalQuestsCount: number;
  difficulty: DifficultyLevel;
  won: boolean;
}

export interface ColonySummaryStats {
  survivedSols: number;
  survivedTicks: number;
  terraformingProgress: number;
  currentTemperature: number;
  waterLevel: number;
  totalResources: number;
  aliensDefeated: number;
  alienWavesCleared: number;
  completedQuests: number;
  totalQuests: number;
  buildingsCount: number;
  score: ColonyScoreBreakdown;
}
