import type { ResourceCost, ResourceProduction } from "./Resources";

export interface ResourceCapacity {
  power?: number;
  water?: number;
  biomass?: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  color?: string;
  cost: ResourceCost;
  production?: ResourceProduction;
  tags?: string[];
  capacity?: ResourceCapacity;
  modelPath?: string;
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
}
