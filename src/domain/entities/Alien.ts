export interface AlienShip {
  id: string;
  position: { x: number; y: number; z: number };
  targetBuildingId: string | null;
  phase: "approaching" | "targeting" | "firing" | "retreating";
  phaseProgress: number; // 0–1
  active: boolean;
}

export interface AlienGroundUnit {
  id: string;
  position: { x: number; z: number };
  targetBuildingId: string | null;
  attackCooldown: number;
  active: boolean;
}

export interface AlienState {
  wave: 0 | 1 | 2;
  ships: AlienShip[];
  groundUnits: AlienGroundUnit[];
  nextShipSpawnIn: number;
  nextGroundSpawnIn: number;
}
