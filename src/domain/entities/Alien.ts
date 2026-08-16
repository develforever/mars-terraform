export interface AlienShip {
  id: string;
  position: { x: number; y: number; z: number };
  targetBuildingId: string | null;
  phase: "approaching" | "targeting" | "charging" | "firing" | "retreating";
  phaseProgress: number; // 0–1
  active: boolean;
}

export interface AlienGroundUnit {
  id: string;
  position: { x: number; y?: number; z: number };
  targetBuildingId: string | null;
  attackCooldown: number;
  active: boolean;
  path?: [number, number][];
  currentPathIndex?: number;
}

export interface AlienState {
  wave: 0 | 1 | 2;
  ships: AlienShip[];
  groundUnits: AlienGroundUnit[];
  nextShipSpawnIn: number;
  nextGroundSpawnIn: number;
}
