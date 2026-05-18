import type { ResourceCost, ResourceProduction, ResourceCapacity } from "./Resources";

export interface BuildingDefinition {
  id: string;
  name: string;
  category: "living" | "production" | "storage" | "infrastructure" | "defense";
  color?: string;
  cost: ResourceCost;
  production?: ResourceProduction;
  tags?: string[];
  capacity?: Partial<ResourceCapacity>;
  modelPath?: string;
  dependsOn?: string[];
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
}
