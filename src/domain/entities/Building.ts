import type { ResourceCost, ResourceProduction, ResourceCapacity } from "./Resources";

export interface BuildingDefinition {
  id: string;
  name: string;
  color?: string;
  cost: ResourceCost;
  production?: ResourceProduction;
  tags?: string[];
  capacity?: Partial<ResourceCapacity>;
  modelPath?: string;
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
}
