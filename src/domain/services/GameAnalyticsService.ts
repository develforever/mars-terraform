import type { GameAnalyticsSnapshot, ColonyRank, ColonyScoreBreakdown, ColonyScoreInput, ColonySummaryStats } from "../entities/GameStats";
import { TerraformingService } from "./TerraformingService";

export const TICKS_PER_SOL = 60;
export const MAX_ANALYTICS_SNAPSHOTS = 500;

export class GameAnalyticsService {
  /**
   * Converts tick count to Martian Sol (1-indexed).
   */
  static tickToSol(tick: number): number {
    return Math.floor(Math.max(0, tick) / TICKS_PER_SOL) + 1;
  }

  /**
   * Creates a standardized analytics snapshot for history tracking.
   */
  static createSnapshot(params: {
    tick: number;
    resources: {
      power: number;
      water: number;
      o2: number;
      biomass: number;
    };
    mineralsCount?: number;
    terraforming: number;
    o2Accumulated: number;
    waterLevel: number;
    buildingsCount: number;
    aliensDefeated: number;
  }): GameAnalyticsSnapshot {
    const sol = this.tickToSol(params.tick);
    const temp = TerraformingService.calculateTemperature(params.terraforming);

    return {
      tick: params.tick,
      sol,
      resources: {
        energy: Math.max(0, Number(params.resources.power.toFixed(1))),
        water: Math.max(0, Number(params.resources.water.toFixed(1))),
        o2: Math.max(0, Number(params.resources.o2.toFixed(1))),
        minerals: params.mineralsCount ?? 0,
        biomass: Math.max(0, Number(params.resources.biomass.toFixed(1))),
      },
      terraforming: {
        o2: Math.max(0, Number(params.o2Accumulated.toFixed(1))),
        temp: Number(temp.toFixed(1)),
        waterLevel: Number(params.waterLevel.toFixed(2)),
        progress: Math.max(0, Math.min(100, Number(params.terraforming.toFixed(1)))),
      },
      buildingsCount: params.buildingsCount,
      aliensDefeated: params.aliensDefeated,
    };
  }

  /**
   * Appends snapshot to buffer, enforcing the maximum buffer size limit (sliding window).
   */
  static recordSnapshot(
    buffer: GameAnalyticsSnapshot[],
    snapshot: GameAnalyticsSnapshot,
    maxSize: number = MAX_ANALYTICS_SNAPSHOTS
  ): GameAnalyticsSnapshot[] {
    const updated = [...buffer, snapshot];
    if (updated.length > maxSize) {
      return updated.slice(updated.length - maxSize);
    }
    return updated;
  }

  /**
   * Determines colony rank based on total score.
   * Bronze: < 2500
   * Silver: 2500 - 5000
   * Gold: 5000 - 10000
   * Platinum: > 10000
   */
  static getRank(totalScore: number): ColonyRank {
    if (totalScore > 10000) return "platinum";
    if (totalScore >= 5000) return "gold";
    if (totalScore >= 2500) return "silver";
    return "bronze";
  }

  /**
   * Calculates comprehensive colony score breakdown and rank.
   */
  static calculateColonyScore(
    gameState: ColonyScoreInput,
    timeSeries: GameAnalyticsSnapshot[] = []
  ): ColonyScoreBreakdown {
    const diffMultiplier = gameState.difficulty === "hard" ? 1.35 : gameState.difficulty === "easy" ? 0.85 : 1.0;

    // 1. Terraforming progress (0 - 100) -> up to 3500 pts
    const terraformingScore = Math.round(gameState.terraforming * 35);

    // 2. Survival & time duration score
    const survivalSols = gameState.sol;
    const survivalScore = Math.round(survivalSols * 40 + Math.min(600, gameState.tick));

    // 3. Resource management score: current stockpile + peak historical resources
    const currentResSum = Math.max(0, gameState.resources.power) +
      Math.max(0, gameState.resources.water) +
      Math.max(0, gameState.resources.o2) +
      Math.max(0, gameState.resources.biomass);

    let peakHistoricalRes = currentResSum;
    if (timeSeries.length > 0) {
      peakHistoricalRes = Math.max(
        peakHistoricalRes,
        ...timeSeries.map((s) => s.resources.energy + s.resources.water + s.resources.o2 + s.resources.biomass)
      );
    }
    const resourceScore = Math.round(currentResSum * 0.8 + peakHistoricalRes * 0.2);

    // 4. Alien defense score
    const alienScore = Math.round(gameState.aliensDefeated * 150 + gameState.alienWave * 250);

    // 5. Quest progression score
    const questScore = Math.round(gameState.completedQuestsCount * 250);

    // 6. Colony infrastructure score
    const buildingScore = Math.round(gameState.placedCount * 60);

    // 7. Victory bonus
    const victoryBonus = gameState.won ? 1000 : 0;

    const rawTotal = terraformingScore + survivalScore + resourceScore + alienScore + questScore + buildingScore + victoryBonus;
    const totalScore = Math.max(0, Math.round(rawTotal * diffMultiplier));
    const rank = this.getRank(totalScore);

    return {
      totalScore,
      rank,
      terraformingScore,
      survivalScore,
      resourceScore,
      alienScore,
      questScore,
      buildingScore,
      difficultyMultiplier: diffMultiplier,
    };
  }

  /**
   * Aggregates summary statistics for victory / defeat evaluation.
   */
  static getSummaryStats(
    gameState: ColonyScoreInput,
    timeSeries: GameAnalyticsSnapshot[] = []
  ): ColonySummaryStats {
    const score = this.calculateColonyScore(gameState, timeSeries);
    const totalResources = Math.max(0, Math.round(
      gameState.resources.power +
      gameState.resources.water +
      gameState.resources.o2 +
      gameState.resources.biomass
    ));

    return {
      survivedSols: gameState.sol,
      survivedTicks: gameState.tick,
      terraformingProgress: Number(gameState.terraforming.toFixed(1)),
      currentTemperature: Number(TerraformingService.calculateTemperature(gameState.terraforming).toFixed(1)),
      waterLevel: Number(gameState.waterLevel.toFixed(2)),
      totalResources,
      aliensDefeated: gameState.aliensDefeated,
      alienWavesCleared: gameState.alienWave,
      completedQuests: gameState.completedQuestsCount,
      totalQuests: gameState.totalQuestsCount,
      buildingsCount: gameState.placedCount,
      score,
    };
  }
}
