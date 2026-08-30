import type { useGameStore } from "../../application/store/useGameStore";
import type { DifficultyLevel } from "../services/TerraformingService";
import type { GameMode } from "../services/GameModeService";

export type GameStoreInstance = typeof useGameStore;

export interface StateFixtureOptions {
  seed?: number;
  speed?: 1 | 2 | 4;
  paused?: boolean;
}

export interface StateFixture {
  id: string;
  label: string;
  description: string;
  seed: number;
  difficulty: DifficultyLevel;
  gameMode: GameMode;
  /** Executed after startNewGame on the real store */
  apply: (store: GameStoreInstance, options?: StateFixtureOptions) => void;
}

