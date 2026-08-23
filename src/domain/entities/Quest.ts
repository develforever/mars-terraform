import type { ResourceKey, Resources } from "./Resources";

export type QuestCategory = "colony_start" | "self_sufficiency" | "defense" | "green_mars";

export type QuestStatus = "locked" | "active" | "completed" | "claimed";

export type QuestObjectiveType =
  | "build_count"
  | "resource_amount"
  | "tech_unlocked"
  | "terraforming_stat"
  | "survive_wave";

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  target: number;
  descriptionKey: string;
  buildingType?: string;
  resource?: ResourceKey;
  techId?: string;
  stat?: "terraforming" | "waterLevel" | "o2Accumulated";
  wave?: number;
}

export interface QuestReward {
  resources?: Partial<Resources>;
  researchPoints?: number;
}

export interface QuestDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  category: QuestCategory;
  stage: number;
  prerequisites: string[];
  objectives: QuestObjective[];
  reward: QuestReward;
  isMainQuest?: boolean;
}

export interface QuestObjectiveProgress {
  current: number;
  target: number;
  completed: boolean;
}

export interface QuestState {
  id: string;
  status: QuestStatus;
  progress: Record<string, number>;
  completedAt?: number;
  claimedAt?: number;
}
