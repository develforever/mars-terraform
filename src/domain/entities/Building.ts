import type { BuildingCategory } from "../config/buildings";
import type { ResourceCost, ResourceProduction, ResourceCapacity } from "./Resources";

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
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
  condition: number; // 0-100%
}
