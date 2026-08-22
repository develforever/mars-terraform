import type { BuildingCategory } from "../config/buildings";
import type { ResourceCost, ResourceProduction, ResourceCapacity } from "./Resources";

export interface NeighborBonus {
  neighborId: string;
  bonusPercent: number;
  description: string;
}

export type ConnectionType = "power" | "water" | "biomass" | "data";

export interface BuildingUpgrade {
  level: number;
  cost: ResourceCost;
  productionMultiplier: number;
  extractionRadius?: number;
  unlockedUnit?: "rover" | "drone";
  description?: string;
}

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
  /** Resource deposit type extracted by this building (receives neighbor bonus) */
  extractsDeposit?: import("../mapEditorTypes").ResourceType;
  /** Upgrade paths (levels 2 and 3) */
  upgrades?: BuildingUpgrade[];
}

export interface PlacedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
  condition: number; // 0-100%
  level?: number; // 1-3 (default 1)
}

