import type { PlacedBuilding } from "../entities/Building";
import type { Resources } from "../entities/Resources";
import type {
  QuestDefinition,
  QuestObjectiveProgress,
  QuestReward,
  QuestState,
} from "../entities/Quest";
import { CAMPAIGN_QUESTS, QUEST_DEFINITIONS } from "../config/quests";

export interface QuestEvaluationContext {
  placed: PlacedBuilding[];
  resources: Resources;
  unlockedTechs: string[];
  terraforming: number;
  o2Accumulated: number;
  waterLevel?: number;
  alienWave?: number;
}

export interface ClaimRewardResult {
  success: boolean;
  newQuests: QuestState[];
  newResources: Resources;
  newRP: number;
  reward?: QuestReward;
}

export interface DetailedObjectiveProgress extends QuestObjectiveProgress {
  id: string;
  descriptionKey: string;
  type: string;
}

export interface QuestProgressSummary {
  questId: string;
  percent: number;
  isCompleted: boolean;
  objectives: DetailedObjectiveProgress[];
}

export class QuestService {
  /**
   * Generates initial state for all campaign quests.
   * Quests without prerequisites start as 'active', others start as 'locked'.
   */
  public static getInitialQuestStates(): QuestState[] {
    return CAMPAIGN_QUESTS.map((quest) => ({
      id: quest.id,
      status: quest.prerequisites.length === 0 ? "active" : "locked",
      progress: {},
    }));
  }

  /**
   * Pure evaluation function that checks progress against current game context.
   * Returns a new array of QuestState objects.
   */
  public static evaluateQuests(
    context: QuestEvaluationContext,
    currentQuests: QuestState[]
  ): QuestState[] {
    const questMap = new Map<string, QuestState>();
    for (const q of currentQuests) {
      questMap.set(q.id, { ...q, progress: { ...q.progress } });
    }

    // Ensure all defined campaign quests exist in map
    for (const def of CAMPAIGN_QUESTS) {
      if (!questMap.has(def.id)) {
        questMap.set(def.id, {
          id: def.id,
          status: def.prerequisites.length === 0 ? "active" : "locked",
          progress: {},
        });
      }
    }

    // Evaluate objectives and unlock dependent quests iteratively
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 5) {
      changed = false;
      iterations++;

      // Pass 1: Unlock quests whose prerequisites are satisfied (completed or claimed)
      for (const def of CAMPAIGN_QUESTS) {
        const qState = questMap.get(def.id)!;
        if (qState.status === "locked") {
          const allPrereqsMet = def.prerequisites.every((prereqId) => {
            const prereqState = questMap.get(prereqId);
            return (
              prereqState &&
              (prereqState.status === "completed" || prereqState.status === "claimed")
            );
          });
          if (allPrereqsMet) {
            qState.status = "active";
            changed = true;
          }
        }
      }

      // Pass 2: Evaluate objectives for active and completed quests
      for (const def of CAMPAIGN_QUESTS) {
        const qState = questMap.get(def.id)!;
        if (qState.status === "claimed" || qState.status === "locked") {
          continue;
        }

        let allObjectivesDone = true;
        const updatedProgress: Record<string, number> = {};

        for (const obj of def.objectives) {
          let currentVal = 0;

          switch (obj.type) {
            case "build_count": {
              if (obj.buildingType) {
                currentVal = context.placed.filter(
                  (b) => b.definitionId === obj.buildingType
                ).length;
              }
              break;
            }
            case "resource_amount": {
              if (obj.resource) {
                currentVal = Math.floor(context.resources[obj.resource] ?? 0);
              }
              break;
            }
            case "tech_unlocked": {
              if (obj.techId) {
                currentVal = context.unlockedTechs.includes(obj.techId) ? 1 : 0;
              }
              break;
            }
            case "terraforming_stat": {
              if (obj.stat === "terraforming") {
                currentVal = Math.floor(context.terraforming ?? 0);
              } else if (obj.stat === "o2Accumulated") {
                currentVal = Math.floor(context.o2Accumulated ?? 0);
              } else if (obj.stat === "waterLevel") {
                currentVal = Math.floor(context.waterLevel ?? 0);
              }
              break;
            }
            case "survive_wave": {
              const currentWave = context.alienWave ?? 0;
              currentVal = currentWave >= (obj.wave ?? 1) ? 1 : 0;
              break;
            }
          }

          updatedProgress[obj.id] = currentVal;
          if (currentVal < obj.target) {
            allObjectivesDone = false;
          }
        }

        qState.progress = updatedProgress;

        if (qState.status === "active" && allObjectivesDone) {
          qState.status = "completed";
          qState.completedAt = qState.completedAt ?? Date.now();
          changed = true;
        } else if (qState.status === "completed" && !allObjectivesDone) {
          // In case required buildings were demolished or resources dropped
          qState.status = "active";
          changed = true;
        }
      }
    }

    return Array.from(questMap.values());
  }

  /**
   * Claims reward for a completed quest.
   * Modifies quest status to 'claimed' and adds reward resources and research points.
   */
  public static claimQuestReward(
    questId: string,
    currentQuests: QuestState[],
    currentResources: Resources,
    currentRP: number
  ): ClaimRewardResult {
    const def = QUEST_DEFINITIONS[questId];
    const questState = currentQuests.find((q) => q.id === questId);

    if (!def || !questState || questState.status !== "completed") {
      return {
        success: false,
        newQuests: currentQuests,
        newResources: currentResources,
        newRP: currentRP,
      };
    }

    const updatedQuests = currentQuests.map((q) => {
      if (q.id === questId) {
        return {
          ...q,
          status: "claimed" as const,
          claimedAt: Date.now(),
        };
      }
      return q;
    });

    // Apply rewards
    const newResources: Resources = { ...currentResources };
    if (def.reward.resources) {
      for (const [key, amount] of Object.entries(def.reward.resources)) {
        const rKey = key as keyof Resources;
        newResources[rKey] = (newResources[rKey] ?? 0) + (amount ?? 0);
      }
    }

    const newRP = currentRP + (def.reward.researchPoints ?? 0);

    return {
      success: true,
      newQuests: updatedQuests,
      newResources,
      newRP,
      reward: def.reward,
    };
  }

  /**
   * Calculates progress details and summary percentage for a quest.
   */
  public static getProgressSummary(
    questDef: QuestDefinition,
    questState?: QuestState
  ): QuestProgressSummary {
    if (!questState) {
      return {
        questId: questDef.id,
        percent: 0,
        isCompleted: false,
        objectives: questDef.objectives.map((obj) => ({
          id: obj.id,
          descriptionKey: obj.descriptionKey,
          type: obj.type,
          current: 0,
          target: obj.target,
          completed: false,
        })),
      };
    }

    if (questState.status === "claimed") {
      return {
        questId: questDef.id,
        percent: 100,
        isCompleted: true,
        objectives: questDef.objectives.map((obj) => ({
          id: obj.id,
          descriptionKey: obj.descriptionKey,
          type: obj.type,
          current: obj.target,
          target: obj.target,
          completed: true,
        })),
      };
    }

    let completedCount = 0;
    const detailedObjs: DetailedObjectiveProgress[] = questDef.objectives.map((obj) => {
      const current = questState.progress[obj.id] ?? 0;
      const completed = current >= obj.target;
      if (completed) completedCount++;
      return {
        id: obj.id,
        descriptionKey: obj.descriptionKey,
        type: obj.type,
        current: Math.min(current, obj.target),
        target: obj.target,
        completed,
      };
    });

    const percent = questDef.objectives.length > 0
      ? Math.round((completedCount / questDef.objectives.length) * 100)
      : 100;

    return {
      questId: questDef.id,
      percent,
      isCompleted: questState.status === "completed",
      objectives: detailedObjs,
    };
  }

  /**
   * Returns the primary tracked quest for the HUD tracker widget.
   * Priority:
   * 1. Active or Completed Main Quest (earliest stage)
   * 2. Any Active or Completed Side Quest (earliest stage)
   * 3. First quest in the campaign
   */
  public static getTrackedQuest(
    quests: QuestState[]
  ): { questDef: QuestDefinition; state: QuestState } | null {
    const questMap = new Map(quests.map((q) => [q.id, q]));

    // Find first active or completed main quest
    for (const def of CAMPAIGN_QUESTS) {
      if (def.isMainQuest) {
        const state = questMap.get(def.id);
        if (state && (state.status === "active" || state.status === "completed")) {
          return { questDef: def, state };
        }
      }
    }

    // Find any active or completed quest
    for (const def of CAMPAIGN_QUESTS) {
      const state = questMap.get(def.id);
      if (state && (state.status === "active" || state.status === "completed")) {
        return { questDef: def, state };
      }
    }

    // Fallback: first quest
    const firstDef = CAMPAIGN_QUESTS[0];
    const firstState = questMap.get(firstDef.id) ?? {
      id: firstDef.id,
      status: "active",
      progress: {},
    };

    return { questDef: firstDef, state: firstState };
  }

  /**
   * Checks if there is any quest with status 'completed' (ready to claim).
   */
  public static hasUnclaimedRewards(quests: QuestState[]): boolean {
    return quests.some((q) => q.status === "completed");
  }
}
