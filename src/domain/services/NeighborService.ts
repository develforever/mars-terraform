import type { PlacedBuilding } from "../entities/Building";
import type { BuildingDefinition } from "../entities/Building";

const NEIGHBOR_RADIUS = 3; // world units

export interface ActiveBonus {
  buildingId: string;
  neighborId: string;
  bonusPercent: number;
  description: string;
}

export class NeighborService {
  static getNeighbors(
    building: PlacedBuilding,
    all: PlacedBuilding[],
  ): PlacedBuilding[] {
    return all.filter((b) => {
      if (b.id === building.id) return false;
      const dx = b.position.x - building.position.x;
      const dz = b.position.z - building.position.z;
      return Math.sqrt(dx * dx + dz * dz) <= NEIGHBOR_RADIUS;
    });
  }

  /** Returns the production multiplier (1.0 = no bonus) for this building */
  static getProductionMultiplier(
    building: PlacedBuilding,
    def: BuildingDefinition,
    all: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
  ): number {
    if (!def.bonusNeighbors?.length) return 1.0;

    const neighbors = this.getNeighbors(building, all);
    const neighborDefIds = new Set(neighbors.map((n) => definitions[n.definitionId]?.id));

    let maxBonus = 0;
    for (const bonus of def.bonusNeighbors) {
      if (neighborDefIds.has(bonus.neighborId)) {
        maxBonus = Math.max(maxBonus, bonus.bonusPercent);
      }
    }

    return 1.0 + maxBonus / 100;
  }

  /** Returns all active bonuses for all placed buildings (for UI display) */
  static getAllActiveBonuses(
    all: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
  ): ActiveBonus[] {
    const bonuses: ActiveBonus[] = [];
    for (const building of all) {
      const def = definitions[building.definitionId];
      if (!def?.bonusNeighbors?.length) continue;

      const neighbors = this.getNeighbors(building, all);
      const neighborDefIds = new Set(neighbors.map((n) => definitions[n.definitionId]?.id));

      for (const bonus of def.bonusNeighbors) {
        if (neighborDefIds.has(bonus.neighborId)) {
          bonuses.push({
            buildingId: building.id,
            neighborId: bonus.neighborId,
            bonusPercent: bonus.bonusPercent,
            description: bonus.description,
          });
        }
      }
    }
    return bonuses;
  }

  /** Returns pairs of building IDs that should be connected visually */
  static getConnectionPairs(
    all: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
  ): Array<[PlacedBuilding, PlacedBuilding]> {
    const pairs: Array<[PlacedBuilding, PlacedBuilding]> = [];
    const seen = new Set<string>();

    for (const building of all) {
      const def = definitions[building.definitionId];
      if (!def?.connectionType) continue;

      const neighbors = this.getNeighbors(building, all);
      for (const neighbor of neighbors) {
        const nDef = definitions[neighbor.definitionId];
        if (!nDef?.connectionType) continue;

        const key = [building.id, neighbor.id].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([building, neighbor]);
        }
      }
    }
    return pairs;
  }
}
