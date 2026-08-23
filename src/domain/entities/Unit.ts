// types/interfaces
export type UnitCategory = "ground" | "air";

export type UnitRole = "logistics" | "combat" | "repair" | "mining" | "transport";

export interface UnitStats {
  health: number;
  maxHealth: number;
  speed: number;
  powerConsumption: number;
  cargoCapacity?: number;
  attackRange?: number;
  attackDamage?: number;
  attackCooldown?: number;
  repairRate?: number;
  repairRange?: number;
}

export interface UnitDefinition {
  id: string;
  name: string;
  role: UnitRole;
  category: UnitCategory;
  description: string;
  stats: UnitStats;
  modelPath: string;
  iconPath: string;
  modelScale: number;
  color?: string;
  requiredTech?: string;
}

export interface PlacedUnit {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
  heading: number; // yaw angle in radians
  currentHealth: number;
  status: "idle" | "moving" | "working" | "combat" | "repairing";
  assignedBuildingId?: string;
  targetPosition?: { x: number; y: number; z: number };
}
