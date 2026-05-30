import type { AlienShip, AlienGroundUnit, AlienState } from "../entities/Alien";
import type { PlacedBuilding } from "../entities/Building";

const SHIP_DAMAGE   = 50;
const GROUND_DAMAGE = 15;
const GROUND_ATTACK_COOLDOWN = 5;
const GROUND_SPEED  = 1.2; // units/tick
const GROUND_ATTACK_RANGE = 2.5;
const TURRET_RANGE  = 15;
const SHIP_SPAWN_INTERVAL  = 120; // ticks
const GROUND_SPAWN_INTERVAL = 80;
const TERRAIN_HALF_X = 48;
const TERRAIN_HALF_Z = 22;
const SHIP_PHASE_STEP   = 0.1; // phase progress per tick
const SHIP_ORBIT_X     = 60;  // spawn orbit radius X
const SHIP_ORBIT_Z     = 40;  // spawn orbit radius Z
const SHIP_SPAWN_HEIGHT     = 70;  // base spawn height
const SHIP_SPAWN_HEIGHT_VAR = 20;  // height randomness

export const INITIAL_ALIEN_STATE: AlienState = {
  wave: 0,
  ships: [],
  groundUnits: [],
  nextShipSpawnIn: SHIP_SPAWN_INTERVAL,
  nextGroundSpawnIn: GROUND_SPAWN_INTERVAL,
};

export class AlienService {
  /** Determine which wave should be active based on terraforming progress */
  static resolveWave(terraforming: number): 0 | 1 | 2 {
    if (terraforming >= 60) return 2;
    if (terraforming >= 25) return 1;
    return 0;
  }

  /** Full tick: spawn, move, attack, turret kills */
  static tick(
    state: AlienState,
    buildings: PlacedBuilding[],
    terraforming: number,
  ): { alienState: AlienState; damagedBuildings: PlacedBuilding[] } {
    // Wave can only increase organically; never downgrade a debug-forced wave
    const wave = Math.max(this.resolveWave(terraforming), state.wave) as 0 | 1 | 2;
    let { ships, groundUnits, nextShipSpawnIn, nextGroundSpawnIn } = state;
    let damagedBuildings = [...buildings];

    const FIRST_SPAWN_DELAY = 10;

    // Reset spawn timers when wave first activates so first attack comes quickly
    if (wave >= 1 && state.wave < 1) nextShipSpawnIn = FIRST_SPAWN_DELAY;
    if (wave >= 2 && state.wave < 2) nextGroundSpawnIn = FIRST_SPAWN_DELAY;

    // ── Wave 1+: orbital ships ──────────────────────────────────────────
    if (wave >= 1) {
      nextShipSpawnIn--;
      if (nextShipSpawnIn <= 0 && buildings.length > 0) {
        ships = [...ships, this.spawnShip(buildings)];
        nextShipSpawnIn = SHIP_SPAWN_INTERVAL;
      }

      // Advance ship phases
      ships = ships.map((ship) => {
        const next = { ...ship, phaseProgress: ship.phaseProgress + SHIP_PHASE_STEP };
        if (next.phaseProgress >= 1) {
          if (ship.phase === "approaching") return { ...next, phase: "targeting" as const, phaseProgress: 0 };
          if (ship.phase === "targeting")   return { ...next, phase: "firing" as const,    phaseProgress: 0 };
          if (ship.phase === "firing") {
            // Apply damage to target building
            damagedBuildings = damagedBuildings.map((b) =>
              b.id === ship.targetBuildingId
                ? { ...b, condition: Math.max(0, b.condition - SHIP_DAMAGE) }
                : b,
            );
            return { ...next, phase: "retreating" as const, phaseProgress: 0 };
          }
          if (ship.phase === "retreating") return { ...next, active: false };
        }
        return next;
      }).filter((s) => s.active);
    }

    // ── Wave 2+: ground units ───────────────────────────────────────────
    if (wave >= 2) {
      nextGroundSpawnIn--;
      if (nextGroundSpawnIn <= 0 && buildings.length > 0) {
        groundUnits = [...groundUnits, this.spawnGroundUnit()];
        nextGroundSpawnIn = GROUND_SPAWN_INTERVAL;
      }

      // Move & attack
      groundUnits = groundUnits.map((unit) => {
        const target = this.findClosestBuilding(unit.position, damagedBuildings);
        if (!target) return { ...unit, targetBuildingId: null };

        const dx = target.position.x - unit.position.x;
        const dz = target.position.z - unit.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= GROUND_ATTACK_RANGE) {
          // Attack
          const cooldown = unit.attackCooldown - 1;
          if (cooldown <= 0) {
            damagedBuildings = damagedBuildings.map((b) =>
              b.id === target.id
                ? { ...b, condition: Math.max(0, b.condition - GROUND_DAMAGE) }
                : b,
            );
            return { ...unit, targetBuildingId: target.id, attackCooldown: GROUND_ATTACK_COOLDOWN };
          }
          return { ...unit, targetBuildingId: target.id, attackCooldown: cooldown };
        }

        // Move toward target
        const speed = Math.min(GROUND_SPEED, dist);
        return {
          ...unit,
          targetBuildingId: target.id,
          attackCooldown: Math.max(0, unit.attackCooldown - 1),
          position: {
            x: unit.position.x + (dx / dist) * speed,
            z: unit.position.z + (dz / dist) * speed,
          },
        };
      });

      // Turrets eliminate nearby ground units
      const turrets = damagedBuildings.filter((b) => b.definitionId === "turret");
      groundUnits = groundUnits.filter((unit) =>
        !turrets.some((t) => {
          const dx = t.position.x - unit.position.x;
          const dz = t.position.z - unit.position.z;
          return Math.sqrt(dx * dx + dz * dz) <= TURRET_RANGE;
        }),
      );
    }

    return {
      alienState: { wave, ships, groundUnits, nextShipSpawnIn, nextGroundSpawnIn },
      damagedBuildings,
    };
  }

  private static spawnShip(buildings: PlacedBuilding[]): AlienShip {
    const target = buildings[Math.floor(Math.random() * buildings.length)];
    const angle = Math.random() * Math.PI * 2;
    return {
      id: `ship-${crypto.randomUUID()}`,
      position: {
        x: Math.cos(angle) * SHIP_ORBIT_X,
        y: SHIP_SPAWN_HEIGHT + Math.random() * SHIP_SPAWN_HEIGHT_VAR,
        z: Math.sin(angle) * SHIP_ORBIT_Z,
      },
      targetBuildingId: target.id,
      phase: "approaching",
      phaseProgress: 0,
      active: true,
    };
  }

  private static spawnGroundUnit(): AlienGroundUnit {
    const side = Math.floor(Math.random() * 4);
    let x = 0, z = 0;
    if (side === 0) { x = -TERRAIN_HALF_X; z = (Math.random() * 2 - 1) * TERRAIN_HALF_Z; }
    if (side === 1) { x =  TERRAIN_HALF_X; z = (Math.random() * 2 - 1) * TERRAIN_HALF_Z; }
    if (side === 2) { x = (Math.random() * 2 - 1) * TERRAIN_HALF_X; z = -TERRAIN_HALF_Z; }
    if (side === 3) { x = (Math.random() * 2 - 1) * TERRAIN_HALF_X; z =  TERRAIN_HALF_Z; }
    return {
      id: `ground-${crypto.randomUUID()}`,
      position: { x, z },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };
  }

  private static findClosestBuilding(
    pos: { x: number; z: number },
    buildings: PlacedBuilding[],
  ): PlacedBuilding | null {
    let closest: PlacedBuilding | null = null;
    let minDist = Infinity;
    for (const b of buildings) {
      const dx = b.position.x - pos.x;
      const dz = b.position.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < minDist) { minDist = d; closest = b; }
    }
    return closest;
  }
}
