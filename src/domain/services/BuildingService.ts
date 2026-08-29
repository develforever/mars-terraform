import type { BuildingDefinition, PlacedBuilding, BuildingUpgrade } from "../entities/Building";
import type { Resources, ResourceCost, ResourceDelta } from "../entities/Resources";
import { keyFromCell } from "../entities/Position";
import { worldToHex, hexesInRadius } from "../../presentation/generator/hex/HexMath";
import type { ResourceNode, ResourceType } from "../mapEditorTypes";

export interface DepositEfficiencyResult {
  multiplier: number;
  count: number;
  depositType?: ResourceType;
  matchingNodes: ResourceNode[];
}

export interface BuildResult {
  success: boolean;
  building?: PlacedBuilding;
  costDelta?: ResourceDelta;
  error?: string;
}

export interface DemolishResult {
  success: boolean;
  refundDelta?: ResourceDelta;
  error?: string;
}

export interface UpgradeResult {
  success: boolean;
  building?: PlacedBuilding;
  costDelta?: ResourceDelta;
  error?: string;
}

export class BuildingService {
  static canAfford(cost: ResourceCost | undefined, resources: Resources): boolean {
    if (!cost) return true;
    return Object.entries(cost).every(([key, value]) => {
      const resourceKey = key as keyof Resources;
      return resources[resourceKey] >= (value ?? 0);
    });
  }

  static hasRequirements(
    definition: BuildingDefinition,
    placed: PlacedBuilding[]
  ): boolean {
    if (!definition.dependsOn || definition.dependsOn.length === 0) return true;
    
    const placedDefIds = new Set(placed.map(b => b.definitionId));
    return definition.dependsOn.every(reqId => placedDefIds.has(reqId));
  }

  static hasReachableBuilding(
    definitions: Record<string, BuildingDefinition>,
    placed: PlacedBuilding[],
    resources: Resources,
    unlockedTechs: string[] = []
  ): boolean {
    const available = Object.values(definitions).filter((def) => {
      const techOk = !def.requiredTech || unlockedTechs.includes(def.requiredTech);
      return techOk && this.hasRequirements(def, placed);
    });
    return available.some((def) => this.canAfford(def.cost, resources));
  }

  static calculateCost(cost: ResourceCost | undefined): ResourceDelta {
    if (!cost) return {};
    const delta: ResourceDelta = {};
    for (const [key, value] of Object.entries(cost)) {
      if (value !== undefined) {
        delta[key as keyof Resources] = -value;
      }
    }
    return delta;
  }

  static calculateRefund(cost: ResourceCost | undefined, refundRate = 0.5): ResourceDelta {
    if (!cost) return {};
    const delta: ResourceDelta = {};
    for (const [key, value] of Object.entries(cost)) {
      if (value !== undefined) {
        delta[key as keyof Resources] = value * refundRate;
      }
    }
    return delta;
  }

  static placeBuilding(
    definition: BuildingDefinition,
    cell: { x: number; z: number },
    heightY: number,
    resources: Resources,
    occupied: Record<string, string>,
    placedBuildings: PlacedBuilding[],
    waterLevel?: number,
  ): BuildResult {
    if (waterLevel !== undefined && heightY <= waterLevel + 1e-4) {
      return { success: false, error: "Cannot build underwater" };
    }

    const key = keyFromCell(cell.x, cell.z);
    
    if (occupied[key]) {
      return { success: false, error: "Cell is occupied" };
    }

    if (!this.canAfford(definition.cost, resources)) {
      return { success: false, error: "Cannot afford building" };
    }

    if (!this.hasRequirements(definition, placedBuildings)) {
      const names = definition.dependsOn?.join(", ") ?? "";
      return { success: false, error: `Requires: ${names}` };
    }

    const building: PlacedBuilding = {
      id: crypto.randomUUID(),
      definitionId: definition.id,
      position: { x: cell.x, y: heightY, z: cell.z },
      condition: 100,
      level: 1,
    };

    return {
      success: true,
      building,
      costDelta: this.calculateCost(definition.cost),
    };
  }

  static findBuildingAtCell(
    cell: { x: number; z: number },
    placed: PlacedBuilding[],
    occupied: Record<string, string>
  ): PlacedBuilding | undefined {
    const key = keyFromCell(cell.x, cell.z);
    const buildingId = occupied[key];
    
    if (buildingId) {
      return placed.find(b => b.id === buildingId);
    }

    // Fallback: search by proximity
    const cx = Math.round(cell.x);
    const cz = Math.round(cell.z);
    return placed.find(p => 
      Math.abs(p.position.x - cx) < 0.51 && Math.abs(p.position.z - cz) < 0.51
    );
  }

  static demolishBuilding(
    definition: BuildingDefinition
  ): DemolishResult {
    return {
      success: true,
      refundDelta: this.calculateRefund(definition.cost),
    };
  }

  /** Returns extraction radius in hex units based on building level */
  static getExtractionRadius(building: PlacedBuilding, definition?: BuildingDefinition): number {
    const currentLevel = building.level ?? 1;
    if (definition?.upgrades) {
      const upgrade = definition.upgrades.find(u => u.level === currentLevel);
      if (upgrade?.extractionRadius !== undefined) {
        return upgrade.extractionRadius;
      }
    }
    if (currentLevel >= 3) return 4;
    if (currentLevel >= 2) return 2;
    return 1;
  }

  /** Returns production multiplier (e.g. 1.0, 1.5, 2.2) based on building level */
  static getLevelMultiplier(building: PlacedBuilding, definition?: BuildingDefinition): number {
    const currentLevel = building.level ?? 1;
    if (currentLevel <= 1) return 1.0;

    if (definition?.upgrades) {
      const upgrade = definition.upgrades.find(u => u.level === currentLevel);
      if (upgrade?.productionMultiplier !== undefined) {
        return upgrade.productionMultiplier;
      }
    }

    if (currentLevel === 2) return 1.5;
    if (currentLevel >= 3) return 2.2;
    return 1.0;
  }

  /** Returns the upgrade definition for the next level if available */
  static getNextUpgrade(
    building: PlacedBuilding,
    definition?: BuildingDefinition
  ): BuildingUpgrade | undefined {
    const currentLevel = building.level ?? 1;
    if (currentLevel >= 3 || !definition?.upgrades) return undefined;
    return definition.upgrades.find(u => u.level === currentLevel + 1);
  }

  /** Checks whether a building can be upgraded to the next level */
  static canUpgrade(
    building: PlacedBuilding,
    definition: BuildingDefinition | undefined,
    resources: Resources
  ): { canUpgrade: boolean; error?: string; upgrade?: BuildingUpgrade } {
    const currentLevel = building.level ?? 1;
    if (currentLevel >= 3) {
      return { canUpgrade: false, error: "Max level reached" };
    }

    const upgrade = this.getNextUpgrade(building, definition);
    if (!upgrade) {
      return { canUpgrade: false, error: "No upgrade available" };
    }

    if (!this.canAfford(upgrade.cost, resources)) {
      return { canUpgrade: false, error: "Cannot afford upgrade", upgrade };
    }

    return { canUpgrade: true, upgrade };
  }

  /** Upgrades a placed building to the next level */
  static upgradeBuilding(
    building: PlacedBuilding,
    definition: BuildingDefinition | undefined,
    resources: Resources
  ): UpgradeResult {
    const check = this.canUpgrade(building, definition, resources);
    if (!check.canUpgrade || !check.upgrade) {
      return { success: false, error: check.error ?? "Cannot upgrade building" };
    }

    const updatedBuilding: PlacedBuilding = {
      ...building,
      level: (building.level ?? 1) + 1,
    };

    return {
      success: true,
      building: updatedBuilding,
      costDelta: this.calculateCost(check.upgrade.cost),
    };
  }

  /** Returns updated buildings with condition degraded by storm.
   *  Each building loses `damagePerTick * intensity` condition per tick.
   */
  static degradeBuildings(
    buildings: PlacedBuilding[],
    stormIntensity: number,
    damagePerTick = 0.5
  ): PlacedBuilding[] {
    if (stormIntensity <= 0) return buildings;
    const damage = damagePerTick * stormIntensity;
    return buildings.map((b) => ({
      ...b,
      condition: Math.max(0, b.condition - damage),
    }));
  }

  /** Returns condition factor (0..1) used to scale building production. */
  static conditionFactor(condition: number): number {
    if (condition >= 50) return 1;
    return condition / 50;
  }

  /**
   * Calculates extraction deposit efficiency and neighbor bonus for a building at a specific hex cell.
   * Checks all hexes within the given extraction radius.
   * Multiplier is 1.0 (base 100%) + 0.5 (+50%) per active matching deposit.
   */
  static getDepositEfficiencyAtCell(
    definition: BuildingDefinition | undefined,
    cell: { x: number; z: number },
    resourceNodes: ResourceNode[] = [],
    radius: number = 1
  ): DepositEfficiencyResult {
    if (!definition?.extractsDeposit) {
      return { multiplier: 1.0, count: 0, matchingNodes: [] };
    }

    const [q, r] = worldToHex(cell.x, cell.z);
    const coords = hexesInRadius(q, r, radius);
    const validCoords = new Set<string>(
      coords.map(([cq, cr]) => `${cq},${cr}`)
    );

    const matchingNodes = resourceNodes.filter(
      (node) =>
        node.type === definition.extractsDeposit &&
        node.amount > 0 &&
        validCoords.has(`${node.pos[0]},${node.pos[1]}`)
    );

    const multiplier = 1.0 + matchingNodes.length * 0.5;

    return {
      multiplier,
      count: matchingNodes.length,
      depositType: definition.extractsDeposit,
      matchingNodes,
    };
  }

  /** Returns the deposit multiplier (1.0 = base / no matching deposit) for this placed building */
  static getDepositMultiplier(
    building: PlacedBuilding,
    definition: BuildingDefinition | undefined,
    resourceNodes: ResourceNode[] = []
  ): number {
    const radius = this.getExtractionRadius(building, definition);
    return this.getDepositEfficiencyAtCell(
      definition,
      { x: building.position.x, z: building.position.z },
      resourceNodes,
      radius
    ).multiplier;
  }
}

