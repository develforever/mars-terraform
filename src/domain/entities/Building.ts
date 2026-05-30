import type { BuildingCategory } from "../config/buildings";
import type { ResourceCost, ResourceProduction, ResourceCapacity } from "./Resources";

export interface NeighborBonus {
  neighborId: string;
  bonusPercent: number;
  description: string;
}

export type ConnectionType = "power" | "water" | "biomass" | "data";

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  color?: string;
  cost: ResourceCost;
  production?: ResourceProduction;
  tags?: string[];
  capacity?: Partial<ResourceCapacity>;
  modelPath?: string;
  modelScale?: number;
  dependsOn?: string[];
  /** Bonus production multiplier when a specific neighbor is adjacent */
  bonusNeighbors?: NeighborBonus[];
  connectionType?: ConnectionType;
  /** Visual influence radius for terrain highlight (world units) */
  influenceRadius?: number;
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
  condition: number; // 0-100%
}
