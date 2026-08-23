import type { PlacedBuilding, BuildingDefinition } from "../entities/Building";
import { TECHNOLOGIES } from "../config/technologies";

// constants
/** RP produced per Laboratorium per level (index = level-1) */
export const RP_PER_LAB_LEVEL = [0.5, 0.75, 1.1] as const;

// types
export interface ResearchResult {
  success: boolean;
  rpCost: number;
  newUnlockedTechs: string[];
  newResearchPoints: number;
}

// main logic
export class ResearchService {
  /**
   * Returns total RP produced per economy tick from all lab buildings.
   * Only buildings with definitionId === "lab" contribute RP.
   */
  static calculateRPProduction(
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>
  ): number {
    void definitions; // intentionally unused — reserved for future per-building RP bonuses
    let total = 0;
    for (const b of buildings) {
      if (b.definitionId !== "lab") continue;
      const level = b.level ?? 1;
      const idx = Math.min(level - 1, RP_PER_LAB_LEVEL.length - 1);
      const condFactor = Math.max(0, (b.condition ?? 100) / 100);
      total += RP_PER_LAB_LEVEL[idx] * condFactor;
    }
    return total;
  }

  /**
   * Checks whether a technology can be researched.
   * Returns the failure reason or null if allowed.
   */
  static canResearch(
    techId: string,
    researchPoints: number,
    unlockedTechs: readonly string[]
  ): { allowed: boolean; reason: "insufficient_rp" | "missing_prereq" | "already_researched" | null } {
    const tech = TECHNOLOGIES[techId];
    if (!tech) return { allowed: false, reason: null };

    if (unlockedTechs.includes(techId)) {
      return { allowed: false, reason: "already_researched" };
    }

    for (const prereq of tech.prereqs) {
      if (!unlockedTechs.includes(prereq)) {
        return { allowed: false, reason: "missing_prereq" };
      }
    }

    if (researchPoints < tech.costRP) {
      return { allowed: false, reason: "insufficient_rp" };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Applies the research purchase.
   * Returns a result object; does NOT mutate input arrays.
   */
  static startResearch(
    techId: string,
    researchPoints: number,
    unlockedTechs: readonly string[]
  ): ResearchResult {
    const check = this.canResearch(techId, researchPoints, unlockedTechs);
    if (!check.allowed) {
      return {
        success: false,
        rpCost: 0,
        newUnlockedTechs: [...unlockedTechs],
        newResearchPoints: researchPoints,
      };
    }

    const tech = TECHNOLOGIES[techId];
    return {
      success: true,
      rpCost: tech.costRP,
      newUnlockedTechs: [...unlockedTechs, techId],
      newResearchPoints: researchPoints - tech.costRP,
    };
  }

  /**
   * Determines whether a building is accessible given current research state.
   * Buildings without `requiredTech` are always unlocked.
   */
  static isBuildingUnlocked(
    definitionId: string,
    definitions: Record<string, BuildingDefinition>,
    unlockedTechs: readonly string[]
  ): boolean {
    const def = definitions[definitionId];
    if (!def) return false;
    if (!def.requiredTech) return true;
    return unlockedTechs.includes(def.requiredTech);
  }

  /**
   * Returns the set of building IDs that are currently unlocked by researched techs.
   */
  static getUnlockedBuildingIds(unlockedTechs: readonly string[]): Set<string> {
    const result = new Set<string>();
    for (const techId of unlockedTechs) {
      const tech = TECHNOLOGIES[techId];
      if (!tech) continue;
      for (const buildingId of tech.unlocksBuildings) {
        result.add(buildingId);
      }
    }
    return result;
  }
}
