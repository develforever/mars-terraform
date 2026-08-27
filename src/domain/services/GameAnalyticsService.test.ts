import { describe, it, expect } from "vitest";
import { GameAnalyticsService } from "./GameAnalyticsService";
import type { ColonyScoreInput, GameAnalyticsSnapshot } from "../entities/GameStats";

describe("GameAnalyticsService", () => {
    describe("tickToSol", () => {
        it("should return Sol 1 for tick 0", () => {
            expect(GameAnalyticsService.tickToSol(0)).toBe(1);
        });

        it("should return Sol 1 for ticks within TICKS_PER_SOL - 1", () => {
            expect(GameAnalyticsService.tickToSol(59)).toBe(1);
        });

        it("should advance Sol every 60 ticks", () => {
            expect(GameAnalyticsService.tickToSol(60)).toBe(2);
            expect(GameAnalyticsService.tickToSol(120)).toBe(3);
            expect(GameAnalyticsService.tickToSol(359)).toBe(6);
        });

        it("should handle negative tick values safely", () => {
            expect(GameAnalyticsService.tickToSol(-10)).toBe(1);
        });
    });

    describe("createSnapshot", () => {
        it("should generate a complete analytics snapshot", () => {
            const snapshot = GameAnalyticsService.createSnapshot({
                tick: 125,
                resources: {
                    power: 12.345,
                    water: 8.91,
                    o2: 15.5,
                    biomass: 4.2,
                },
                mineralsCount: 3,
                terraforming: 45.67,
                o2Accumulated: 250.8,
                waterLevel: 0.15,
                buildingsCount: 6,
                aliensDefeated: 2,
            });

            expect(snapshot.tick).toBe(125);
            expect(snapshot.sol).toBe(3);
            expect(snapshot.resources.energy).toBe(12.3);
            expect(snapshot.resources.water).toBe(8.9);
            expect(snapshot.resources.o2).toBe(15.5);
            expect(snapshot.resources.minerals).toBe(3);
            expect(snapshot.resources.biomass).toBe(4.2);
            expect(snapshot.terraforming.progress).toBe(45.7);
            expect(snapshot.terraforming.o2).toBe(250.8);
            expect(snapshot.terraforming.temp).toBeDefined();
            expect(snapshot.buildingsCount).toBe(6);
            expect(snapshot.aliensDefeated).toBe(2);
        });
    });

    describe("recordSnapshot", () => {
        it("should append snapshots to buffer", () => {
            const buffer: GameAnalyticsSnapshot[] = [];
            const snap1 = GameAnalyticsService.createSnapshot({
                tick: 0,
                resources: { power: 5, water: 5, o2: 5, biomass: 1 },
                terraforming: 0,
                o2Accumulated: 0,
                waterLevel: -0.5,
                buildingsCount: 1,
                aliensDefeated: 0,
            });
            const snap2 = GameAnalyticsService.createSnapshot({
                tick: 10,
                resources: { power: 6, water: 6, o2: 6, biomass: 2 },
                terraforming: 2,
                o2Accumulated: 10,
                waterLevel: -0.48,
                buildingsCount: 2,
                aliensDefeated: 0,
            });

            const buf1 = GameAnalyticsService.recordSnapshot(buffer, snap1);
            expect(buf1.length).toBe(1);

            const buf2 = GameAnalyticsService.recordSnapshot(buf1, snap2);
            expect(buf2.length).toBe(2);
        });

        it("should maintain sliding window buffer when exceeding MAX_ANALYTICS_SNAPSHOTS", () => {
            let buffer: GameAnalyticsSnapshot[] = [];
            const maxSize = 5;
            for (let i = 0; i < 10; i++) {
                const snap = GameAnalyticsService.createSnapshot({
                    tick: i * 10,
                    resources: { power: i, water: i, o2: i, biomass: i },
                    terraforming: i,
                    o2Accumulated: i,
                    waterLevel: 0,
                    buildingsCount: 1,
                    aliensDefeated: 0,
                });
                buffer = GameAnalyticsService.recordSnapshot(buffer, snap, maxSize);
            }

            expect(buffer.length).toBe(5);
            expect(buffer[0].tick).toBe(50);
            expect(buffer[4].tick).toBe(90);
        });
    });

    describe("calculateColonyScore and getRank", () => {
        it("should assign bronze rank for early game failure (< 2500 pts)", () => {
            const input: ColonyScoreInput = {
                tick: 20,
                sol: 1,
                terraforming: 5,
                o2Accumulated: 20,
                waterLevel: -0.5,
                resources: { power: 2, water: 1, o2: 0, biomass: 0 },
                placedCount: 2,
                aliensDefeated: 0,
                alienWave: 0,
                completedQuestsCount: 0,
                totalQuestsCount: 10,
                difficulty: "normal",
                won: false,
            };

            const score = GameAnalyticsService.calculateColonyScore(input);
            expect(score.totalScore).toBeLessThan(2500);
            expect(score.rank).toBe("bronze");
        });

        it("should assign silver rank for mid-tier colony (2500 - 5000 pts)", () => {
            const input: ColonyScoreInput = {
                tick: 200,
                sol: 4,
                terraforming: 35,
                o2Accumulated: 250,
                waterLevel: 0.1,
                resources: { power: 50, water: 40, o2: 60, biomass: 20 },
                placedCount: 8,
                aliensDefeated: 1,
                alienWave: 1,
                completedQuestsCount: 3,
                totalQuestsCount: 10,
                difficulty: "normal",
                won: false,
            };

            const score = GameAnalyticsService.calculateColonyScore(input);
            expect(score.totalScore).toBeGreaterThanOrEqual(2500);
            expect(score.totalScore).toBeLessThan(5000);
            expect(score.rank).toBe("silver");
        });

        it("should assign gold rank for advanced colony (5000 - 10000 pts)", () => {
            const input: ColonyScoreInput = {
                tick: 600,
                sol: 11,
                terraforming: 80,
                o2Accumulated: 700,
                waterLevel: 0.8,
                resources: { power: 120, water: 100, o2: 150, biomass: 80 },
                placedCount: 14,
                aliensDefeated: 4,
                alienWave: 2,
                completedQuestsCount: 7,
                totalQuestsCount: 10,
                difficulty: "normal",
                won: false,
            };

            const score = GameAnalyticsService.calculateColonyScore(input);
            expect(score.totalScore).toBeGreaterThanOrEqual(5000);
            expect(score.totalScore).toBeLessThanOrEqual(10000);
            expect(score.rank).toBe("gold");
        });

        it("should assign platinum rank for outstanding terraforming completion (> 10000 pts)", () => {
            const input: ColonyScoreInput = {
                tick: 1200,
                sol: 21,
                terraforming: 100,
                o2Accumulated: 1500,
                waterLevel: 1.2,
                resources: { power: 300, water: 250, o2: 400, biomass: 200 },
                placedCount: 22,
                aliensDefeated: 12,
                alienWave: 2,
                completedQuestsCount: 10,
                totalQuestsCount: 10,
                difficulty: "hard",
                won: true,
            };

            const score = GameAnalyticsService.calculateColonyScore(input);
            expect(score.totalScore).toBeGreaterThan(10000);
            expect(score.rank).toBe("platinum");
        });

        it("should apply difficulty multipliers correctly", () => {
            const baseInput: ColonyScoreInput = {
                tick: 300,
                sol: 6,
                terraforming: 50,
                o2Accumulated: 400,
                waterLevel: 0.3,
                resources: { power: 80, water: 60, o2: 80, biomass: 40 },
                placedCount: 10,
                aliensDefeated: 2,
                alienWave: 1,
                completedQuestsCount: 4,
                totalQuestsCount: 10,
                difficulty: "normal",
                won: false,
            };

            const normalScore = GameAnalyticsService.calculateColonyScore({ ...baseInput, difficulty: "normal" });
            const easyScore = GameAnalyticsService.calculateColonyScore({ ...baseInput, difficulty: "easy" });
            const hardScore = GameAnalyticsService.calculateColonyScore({ ...baseInput, difficulty: "hard" });

            expect(easyScore.difficultyMultiplier).toBe(0.85);
            expect(normalScore.difficultyMultiplier).toBe(1.0);
            expect(hardScore.difficultyMultiplier).toBe(1.35);
            expect(hardScore.totalScore).toBeGreaterThan(normalScore.totalScore);
            expect(normalScore.totalScore).toBeGreaterThan(easyScore.totalScore);
        });
    });

    describe("getSummaryStats", () => {
        it("should aggregate all summary stats accurately", () => {
            const input: ColonyScoreInput = {
                tick: 300,
                sol: 6,
                terraforming: 65.43,
                o2Accumulated: 450,
                waterLevel: 0.52,
                resources: { power: 100, water: 80, o2: 120, biomass: 50 },
                placedCount: 12,
                aliensDefeated: 5,
                alienWave: 2,
                completedQuestsCount: 6,
                totalQuestsCount: 10,
                difficulty: "normal",
                won: false,
            };

            const summary = GameAnalyticsService.getSummaryStats(input);
            expect(summary.survivedSols).toBe(6);
            expect(summary.survivedTicks).toBe(300);
            expect(summary.terraformingProgress).toBe(65.4);
            expect(summary.totalResources).toBe(350);
            expect(summary.aliensDefeated).toBe(5);
            expect(summary.alienWavesCleared).toBe(2);
            expect(summary.completedQuests).toBe(6);
            expect(summary.totalQuests).toBe(10);
            expect(summary.buildingsCount).toBe(12);
            expect(summary.score).toBeDefined();
        });
    });
});
