import type { BuildingDefinition, PlacedBuilding } from "../entities/Building";
import type { Resources, ResourceCost, ResourceDelta } from "../entities/Resources";
import { keyFromCell } from "../entities/Position";
import { worldToHex, hexNeighbors } from "../../presentation/generator/hex/HexMath";
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
    placedBuildings: PlacedBuilding[]
  ): BuildResult {
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
   * Checks the cell itself and all 6 direct axial neighbors.
   * Multiplier is 1.0 (base 100%) + 0.5 (+50%) per active matching deposit.
   */
  static getDepositEfficiencyAtCell(
    definition: BuildingDefinition | undefined,
    cell: { x: number; z: number },
    resourceNodes: ResourceNode[] = []
  ): DepositEfficiencyResult {
    if (!definition?.extractsDeposit) {
      return { multiplier: 1.0, count: 0, matchingNodes: [] };
    }

    const [q, r] = worldToHex(cell.x, cell.z);
    const neighbors = hexNeighbors(q, r);
    const validCoords = new Set<string>([
      `${q},${r}`,
      ...neighbors.map(([nq, nr]) => `${nq},${nr}`),
    ]);

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
    return this.getDepositEfficiencyAtCell(
      definition,
      { x: building.position.x, z: building.position.z },
      resourceNodes
    ).multiplier;
  }
}
