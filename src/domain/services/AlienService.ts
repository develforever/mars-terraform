import type { AlienShip, AlienGroundUnit, AlienState } from "../entities/Alien";
import type { PlacedBuilding } from "../entities/Building";
import type { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { worldToHex, hexToWorld, hexRing } from "../../presentation/generator/hex/HexMath";
import { HexPathfindingService } from "./HexPathfindingService";

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
    hexGrid?: HexGrid,
    waterLevel?: number,
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
          if (ship.phase === "targeting")   return { ...next, phase: "charging" as const,  phaseProgress: 0 };
          if (ship.phase === "charging")    return { ...next, phase: "firing" as const,    phaseProgress: 0 };
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
        groundUnits = [...groundUnits, this.spawnGroundUnit(hexGrid)];
        nextGroundSpawnIn = GROUND_SPAWN_INTERVAL;
      }

      // Move & attack
      groundUnits = groundUnits.map((unit) => {
        if (damagedBuildings.length === 0) {
          return { ...unit, targetBuildingId: null, path: undefined, currentPathIndex: undefined };
        }

        const target = this.findClosestBuilding(unit.position, damagedBuildings);
        if (!target) {
          return { ...unit, targetBuildingId: null, path: undefined, currentPathIndex: undefined };
        }

        const dx = target.position.x - unit.position.x;
        const dz = target.position.z - unit.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= GROUND_ATTACK_RANGE) {
          // Attack target building
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

        // Hex pathfinding movement if hexGrid is available
        if (hexGrid) {
          const unitHex = worldToHex(unit.position.x, unit.position.z);
          const targetHex = worldToHex(target.position.x, target.position.z);

          let currentPath = unit.path;
          let currentPathIndex = unit.currentPathIndex;
          let currentTarget = target;

          const needsNewPath =
            unit.targetBuildingId !== target.id ||
            !currentPath ||
            currentPath.length === 0 ||
            currentPathIndex === undefined ||
            currentPathIndex >= currentPath.length;

          if (needsNewPath) {
            const calculatedPath = HexPathfindingService.findPath(hexGrid, unitHex, targetHex, { maxClimb: 0.85, waterLevel });
            if (calculatedPath && calculatedPath.length > 0) {
              currentPath = calculatedPath;
              if (
                currentPath[0][0] === unitHex[0] &&
                currentPath[0][1] === unitHex[1] &&
                currentPath.length > 1
              ) {
                currentPathIndex = 1;
              } else {
                currentPathIndex = 0;
              }
            } else {
              // Try finding reachable building if closest is unreachable due to cliffs or water
              const sortedBuildings = [...damagedBuildings].sort((a, b) => {
                const da = Math.hypot(a.position.x - unit.position.x, a.position.z - unit.position.z);
                const db = Math.hypot(b.position.x - unit.position.x, b.position.z - unit.position.z);
                return da - db;
              });

              let altPath: [number, number][] | null = null;
              let altTarget: PlacedBuilding | null = null;

              for (const candidate of sortedBuildings) {
                if (candidate.id === target.id) continue;
                const candidateHex = worldToHex(candidate.position.x, candidate.position.z);
                const p = HexPathfindingService.findPath(hexGrid, unitHex, candidateHex, { maxClimb: 0.85, waterLevel });
                if (p && p.length > 0) {
                  altPath = p;
                  altTarget = candidate;
                  break;
                }
              }

              if (altPath && altTarget) {
                currentTarget = altTarget;
                currentPath = altPath;
                currentPathIndex =
                  altPath.length > 1 && altPath[0][0] === unitHex[0] && altPath[0][1] === unitHex[1] ? 1 : 0;
              } else {
                currentPath = undefined;
                currentPathIndex = undefined;
              }
            }
          }

          if (currentPath && currentPathIndex !== undefined && currentPathIndex < currentPath.length) {
            let waypointHex = currentPath[currentPathIndex];
            let [wx, wz] = hexToWorld(waypointHex[0], waypointHex[1]);
            let wdx = wx - unit.position.x;
            let wdz = wz - unit.position.z;
            let wDist = Math.sqrt(wdx * wdx + wdz * wdz);

            if (wDist <= 0.2) {
              if (currentPathIndex + 1 < currentPath.length) {
                currentPathIndex++;
                waypointHex = currentPath[currentPathIndex];
                [wx, wz] = hexToWorld(waypointHex[0], waypointHex[1]);
                wdx = wx - unit.position.x;
                wdz = wz - unit.position.z;
                wDist = Math.sqrt(wdx * wdx + wdz * wdz);
              }
            }

            const speed = Math.min(GROUND_SPEED, wDist > 0 ? wDist : GROUND_SPEED);
            const moveX = wDist > 0.001 ? unit.position.x + (wdx / wDist) * speed : unit.position.x;
            const moveZ = wDist > 0.001 ? unit.position.z + (wdz / wDist) * speed : unit.position.z;

            const [curQ, curR] = worldToHex(moveX, moveZ);
            const curCell = hexGrid.getCell(curQ, curR);
            const newY = curCell ? curCell.worldY : (unit.position.y ?? 0);

            return {
              ...unit,
              targetBuildingId: currentTarget.id,
              attackCooldown: Math.max(0, unit.attackCooldown - 1),
              position: { x: moveX, y: newY, z: moveZ },
              path: currentPath,
              currentPathIndex,
            };
          }

          // If path cannot be found because cliffs block the way, remain in place and wait
          return {
            ...unit,
            targetBuildingId: currentTarget.id,
            attackCooldown: Math.max(0, unit.attackCooldown - 1),
            path: undefined,
            currentPathIndex: undefined,
          };
        }

        // Fallback straight line movement if hexGrid is not present
        const speed = Math.min(GROUND_SPEED, dist);
        const newX = unit.position.x + (dx / dist) * speed;
        const newZ = unit.position.z + (dz / dist) * speed;
        const newY = unit.position.y ?? 0;

        return {
          ...unit,
          targetBuildingId: target.id,
          attackCooldown: Math.max(0, unit.attackCooldown - 1),
          position: {
            x: newX,
            y: newY,
            z: newZ,
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

  static spawnShip(buildings: PlacedBuilding[]): AlienShip {
    const target = buildings[Math.floor(Math.random() * buildings.length)];
    const angle = Math.random() * Math.PI * 2;
    return {
      id: `ship-${crypto.randomUUID()}`,
      position: {
        x: Math.cos(angle) * SHIP_ORBIT_X,
        y: SHIP_SPAWN_HEIGHT + Math.random() * SHIP_SPAWN_HEIGHT_VAR,
        z: Math.sin(angle) * SHIP_ORBIT_Z,
      },
      targetBuildingId: target?.id ?? null,
      phase: "approaching",
      phaseProgress: 0,
      active: true,
    };
  }

  static spawnGroundUnit(hexGrid?: HexGrid): AlienGroundUnit {
    if (hexGrid) {
      const radius = Math.max(1, hexGrid.radius);
      const ring = hexRing(0, 0, radius);
      const validCells = ring
        .map(([q, r]) => hexGrid.getCell(q, r))
        .filter((cell): cell is NonNullable<typeof cell> => cell !== undefined);

      if (validCells.length > 0) {
        const chosen = validCells[Math.floor(Math.random() * validCells.length)];
        const [x, z] = hexToWorld(chosen.q, chosen.r);
        return {
          id: `ground-${crypto.randomUUID()}`,
          position: { x, y: chosen.worldY, z },
          targetBuildingId: null,
          attackCooldown: 0,
          active: true,
        };
      }
    }

    const side = Math.floor(Math.random() * 4);
    let x = 0, z = 0;
    if (side === 0) { x = -TERRAIN_HALF_X; z = (Math.random() * 2 - 1) * TERRAIN_HALF_Z; }
    if (side === 1) { x =  TERRAIN_HALF_X; z = (Math.random() * 2 - 1) * TERRAIN_HALF_Z; }
    if (side === 2) { x = (Math.random() * 2 - 1) * TERRAIN_HALF_X; z = -TERRAIN_HALF_Z; }
    if (side === 3) { x = (Math.random() * 2 - 1) * TERRAIN_HALF_X; z =  TERRAIN_HALF_Z; }

    let y = 0;
    if (hexGrid) {
      const [q, r] = worldToHex(x, z);
      const cell = hexGrid.getCell(q, r);
      if (cell) y = cell.worldY;
    }

    return {
      id: `ground-${crypto.randomUUID()}`,
      position: { x, y, z },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };
  }

  static findClosestBuilding(
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
