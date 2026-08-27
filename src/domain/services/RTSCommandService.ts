import type { PlacedUnit } from "../entities/Unit";
import type { PlacedBuilding } from "../entities/Building";
import type { AlienShip, AlienGroundUnit } from "../entities/Alien";
import { UNIT_DEFINITIONS } from "../config/units";
import type { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { worldToHex, hexToWorld } from "../../presentation/generator/hex/HexMath";
import { HexPathfindingService } from "./HexPathfindingService";

export type RTSOrderType = "MOVE" | "ATTACK" | "REPAIR" | "STOP";

export interface RTSOrder {
  type: RTSOrderType;
  targetPosition?: { x: number; y: number; z: number };
  targetEntityId?: string;
  targetType?: "alien" | "building" | "ground";
}

export interface UnitSimulationResult {
  units: PlacedUnit[];
  aliens: {
    ships: AlienShip[];
    groundUnits: AlienGroundUnit[];
  };
  buildings: PlacedBuilding[];
  eliminatedAliens: number;
}

export class RTSCommandService {
  /**
   * Applies an RTS order to a single unit.
   */
  static applyOrder(
    unit: PlacedUnit,
    order: RTSOrder,
    context: {
      hexGrid?: HexGrid;
      waterLevel?: number;
      aliens?: { ships: AlienShip[]; groundUnits: AlienGroundUnit[] };
      buildings?: PlacedBuilding[];
    }
  ): PlacedUnit {
    switch (order.type) {
      case "STOP":
        return this.issueStopOrder(unit);

      case "MOVE":
        if (!order.targetPosition) return unit;
        return this.issueMoveOrder(unit, order.targetPosition, context.hexGrid, context.waterLevel);

      case "ATTACK":
        if (order.targetEntityId && context.aliens) {
          const target =
            context.aliens.groundUnits.find((g) => g.id === order.targetEntityId) ??
            context.aliens.ships.find((s) => s.id === order.targetEntityId);
          if (target) {
            return this.issueAttackOrder(unit, target, context.hexGrid, context.waterLevel);
          }
        }
        if (order.targetPosition) {
          return this.issueMoveOrder(unit, order.targetPosition, context.hexGrid, context.waterLevel);
        }
        return unit;

      case "REPAIR":
        if (order.targetEntityId && context.buildings) {
          const targetBuilding = context.buildings.find((b) => b.id === order.targetEntityId);
          if (targetBuilding) {
            return this.issueRepairOrder(unit, targetBuilding, context.hexGrid, context.waterLevel);
          }
        }
        if (order.targetPosition) {
          return this.issueMoveOrder(unit, order.targetPosition, context.hexGrid, context.waterLevel);
        }
        return unit;

      default:
        return unit;
    }
  }

  /**
   * Sets a MOVE order on a unit using hex-based A* pathfinding.
   */
  static issueMoveOrder(
    unit: PlacedUnit,
    targetPosition: { x: number; y: number; z: number },
    hexGrid?: HexGrid,
    waterLevel?: number
  ): PlacedUnit {
    const def = UNIT_DEFINITIONS[unit.definitionId];
    const isAir = def?.category === "air";

    let path: [number, number][] | undefined = undefined;
    let currentPathIndex: number | undefined = undefined;

    if (hexGrid && !isAir) {
      const [startQ, startR] = worldToHex(unit.position.x, unit.position.z);
      const [targetQ, targetR] = worldToHex(targetPosition.x, targetPosition.z);

      const foundPath = HexPathfindingService.findPath(
        hexGrid,
        [startQ, startR],
        [targetQ, targetR],
        { maxClimb: 0.85, waterLevel }
      );

      if (foundPath && foundPath.length > 0) {
        path = foundPath;
        currentPathIndex =
          foundPath.length > 1 && foundPath[0][0] === startQ && foundPath[0][1] === startR ? 1 : 0;
      }
    }

    return {
      ...unit,
      status: "moving",
      targetPosition,
      targetEntityId: undefined,
      targetType: "position",
      path,
      currentPathIndex,
    };
  }

  /**
   * Sets an ATTACK order targeting an alien entity.
   */
  static issueAttackOrder(
    unit: PlacedUnit,
    targetAlien: { id: string; position: { x: number; y?: number; z: number } },
    hexGrid?: HexGrid,
    waterLevel?: number
  ): PlacedUnit {
    const def = UNIT_DEFINITIONS[unit.definitionId];
    const attackRange = def?.stats.attackRange ?? 6.0;
    const dist = Math.hypot(
      targetAlien.position.x - unit.position.x,
      targetAlien.position.z - unit.position.z
    );

    let path: [number, number][] | undefined = undefined;
    let currentPathIndex: number | undefined = undefined;

    // If out of range and ground unit on grid, calculate path towards alien
    if (dist > attackRange && hexGrid && def?.category !== "air") {
      const [startQ, startR] = worldToHex(unit.position.x, unit.position.z);
      const [targetQ, targetR] = worldToHex(targetAlien.position.x, targetAlien.position.z);

      const foundPath = HexPathfindingService.findPath(
        hexGrid,
        [startQ, startR],
        [targetQ, targetR],
        { maxClimb: 0.85, waterLevel }
      );

      if (foundPath && foundPath.length > 0) {
        path = foundPath;
        currentPathIndex =
          foundPath.length > 1 && foundPath[0][0] === startQ && foundPath[0][1] === startR ? 1 : 0;
      }
    }

    return {
      ...unit,
      status: "combat",
      targetEntityId: targetAlien.id,
      targetType: "alien",
      targetPosition: {
        x: targetAlien.position.x,
        y: targetAlien.position.y ?? 0,
        z: targetAlien.position.z,
      },
      path,
      currentPathIndex,
    };
  }

  /**
   * Sets a REPAIR order targeting a colony building.
   */
  static issueRepairOrder(
    unit: PlacedUnit,
    targetBuilding: PlacedBuilding,
    hexGrid?: HexGrid,
    waterLevel?: number
  ): PlacedUnit {
    const def = UNIT_DEFINITIONS[unit.definitionId];
    const repairRange = def?.stats.repairRange ?? 4.0;
    const dist = Math.hypot(
      targetBuilding.position.x - unit.position.x,
      targetBuilding.position.z - unit.position.z
    );

    let path: [number, number][] | undefined = undefined;
    let currentPathIndex: number | undefined = undefined;

    if (dist > repairRange && hexGrid && def?.category !== "air") {
      const [startQ, startR] = worldToHex(unit.position.x, unit.position.z);
      const [targetQ, targetR] = worldToHex(targetBuilding.position.x, targetBuilding.position.z);

      const foundPath = HexPathfindingService.findPath(
        hexGrid,
        [startQ, startR],
        [targetQ, targetR],
        { maxClimb: 0.85, waterLevel }
      );

      if (foundPath && foundPath.length > 0) {
        path = foundPath;
        currentPathIndex =
          foundPath.length > 1 && foundPath[0][0] === startQ && foundPath[0][1] === startR ? 1 : 0;
      }
    }

    return {
      ...unit,
      status: "repairing",
      targetEntityId: targetBuilding.id,
      targetType: "building",
      targetPosition: targetBuilding.position,
      path,
      currentPathIndex,
    };
  }

  /**
   * Cancels unit orders and sets state to idle.
   */
  static issueStopOrder(unit: PlacedUnit): PlacedUnit {
    return {
      ...unit,
      status: "idle",
      targetEntityId: undefined,
      targetType: undefined,
      targetPosition: undefined,
      path: undefined,
      currentPathIndex: undefined,
    };
  }

  /**
   * Main simulation tick for player units.
   * Handles movement along A* waypoints, combat execution against aliens, and structure repair.
   */
  static tickUnits(
    units: PlacedUnit[],
    aliens: { ships: AlienShip[]; groundUnits: AlienGroundUnit[] },
    buildings: PlacedBuilding[],
    hexGrid?: HexGrid,
    _waterLevel?: number,
    delta: number = 0.1
  ): UnitSimulationResult {
    const updatedAliensGround = [...aliens.groundUnits];
    const updatedAlienShips = [...aliens.ships];
    let updatedBuildings = [...buildings];
    let eliminatedAliens = 0;

    const updatedUnits = units.map((unit) => {
      const def = UNIT_DEFINITIONS[unit.definitionId];
      if (!def) return unit;

      const currentUnit = { ...unit };
      if (currentUnit.attackCooldown && currentUnit.attackCooldown > 0) {
        currentUnit.attackCooldown = Math.max(0, currentUnit.attackCooldown - delta);
      }
      if (currentUnit.repairCooldown && currentUnit.repairCooldown > 0) {
        currentUnit.repairCooldown = Math.max(0, currentUnit.repairCooldown - delta);
      }

      // ── COMBAT BEHAVIOR ──────────────────────────────────────────────────────────
      if (currentUnit.status === "combat" || (def.role === "combat" && currentUnit.status === "idle")) {
        // Find target alien
        let targetAlien: AlienGroundUnit | AlienShip | undefined = undefined;
        if (currentUnit.targetEntityId) {
          targetAlien =
            updatedAliensGround.find((g) => g.id === currentUnit.targetEntityId) ??
            updatedAlienShips.find((s) => s.id === currentUnit.targetEntityId);
        }

        // Auto-acquire closest alien if idle or previous target eliminated
        if (!targetAlien) {
          const attackRange = def.stats.attackRange ?? 6.0;
          const candidates: Array<{ alien: AlienGroundUnit | AlienShip; dist: number }> = [];

          for (const g of updatedAliensGround) {
            const d = Math.hypot(g.position.x - currentUnit.position.x, g.position.z - currentUnit.position.z);
            if (d <= attackRange + 4.0) candidates.push({ alien: g, dist: d });
          }
          for (const s of updatedAlienShips) {
            const d = Math.hypot(s.position.x - currentUnit.position.x, s.position.z - currentUnit.position.z);
            if (d <= attackRange + 4.0) candidates.push({ alien: s, dist: d });
          }

          candidates.sort((a, b) => a.dist - b.dist);
          if (candidates.length > 0) {
            targetAlien = candidates[0].alien;
            currentUnit.targetEntityId = targetAlien.id;
            currentUnit.targetType = "alien";
            currentUnit.status = "combat";
          }
        }

        if (targetAlien) {
          const dx = targetAlien.position.x - currentUnit.position.x;
          const dz = targetAlien.position.z - currentUnit.position.z;
          const dist = Math.hypot(dx, dz);
          const attackRange = def.stats.attackRange ?? 6.0;

          // Face towards alien
          currentUnit.heading = Math.atan2(dx, dz);

          if (dist <= attackRange) {
            // Within attack range: stop moving and attack
            currentUnit.path = undefined;
            currentUnit.currentPathIndex = undefined;

            if ((currentUnit.attackCooldown ?? 0) <= 0) {
              const cooldown = def.stats.attackCooldown ?? 1.2;
              currentUnit.attackCooldown = cooldown;

              // Apply damage to alien ground unit or ship
              const groundIdx = updatedAliensGround.findIndex((g) => g.id === targetAlien!.id);
              if (groundIdx >= 0) {
                // Eliminate or damage ground alien (aliens have base 50 HP)
                updatedAliensGround.splice(groundIdx, 1);
                eliminatedAliens++;
                currentUnit.targetEntityId = undefined;
                currentUnit.status = "idle";
              } else {
                const shipIdx = updatedAlienShips.findIndex((s) => s.id === targetAlien!.id);
                if (shipIdx >= 0) {
                  updatedAlienShips.splice(shipIdx, 1);
                  eliminatedAliens++;
                  currentUnit.targetEntityId = undefined;
                  currentUnit.status = "idle";
                }
              }
            }
            return currentUnit;
          } else {
            // Need to move towards target
            currentUnit.targetPosition = {
              x: targetAlien.position.x,
              y: targetAlien.position.y ?? 0,
              z: targetAlien.position.z,
            };
          }
        } else if (currentUnit.status === "combat") {
          currentUnit.status = "idle";
          currentUnit.targetEntityId = undefined;
        }
      }

      // ── REPAIR BEHAVIOR ──────────────────────────────────────────────────────────
      if (currentUnit.status === "repairing" && currentUnit.targetEntityId) {
        const targetBld = updatedBuildings.find((b) => b.id === currentUnit.targetEntityId);
        if (targetBld) {
          const dx = targetBld.position.x - currentUnit.position.x;
          const dz = targetBld.position.z - currentUnit.position.z;
          const dist = Math.hypot(dx, dz);
          const repairRange = def.stats.repairRange ?? 4.0;

          currentUnit.heading = Math.atan2(dx, dz);

          if (dist <= repairRange) {
            currentUnit.path = undefined;
            currentUnit.currentPathIndex = undefined;

            const repairRate = def.stats.repairRate ?? 15;
            const newCondition = Math.min(100, targetBld.condition + repairRate * delta);
            updatedBuildings = updatedBuildings.map((b) =>
              b.id === targetBld.id ? { ...b, condition: newCondition } : b
            );

            if (newCondition >= 100) {
              currentUnit.status = "idle";
              currentUnit.targetEntityId = undefined;
            }
            return currentUnit;
          } else {
            currentUnit.targetPosition = targetBld.position;
          }
        } else {
          currentUnit.status = "idle";
          currentUnit.targetEntityId = undefined;
        }
      }

      // ── MOVEMENT BEHAVIOR ────────────────────────────────────────────────────────
      const speed = def.stats.speed ?? 2.5;

      // Hex Path Following
      if (currentUnit.path && currentUnit.currentPathIndex !== undefined) {
        if (currentUnit.currentPathIndex < currentUnit.path.length) {
          let waypointHex = currentUnit.path[currentUnit.currentPathIndex];
          let [wx, wz] = hexToWorld(waypointHex[0], waypointHex[1]);
          let wdx = wx - currentUnit.position.x;
          let wdz = wz - currentUnit.position.z;
          let wDist = Math.hypot(wdx, wdz);

          if (wDist <= 0.3) {
            currentUnit.currentPathIndex++;
            if (currentUnit.currentPathIndex < currentUnit.path.length) {
              waypointHex = currentUnit.path[currentUnit.currentPathIndex];
              [wx, wz] = hexToWorld(waypointHex[0], waypointHex[1]);
              wdx = wx - currentUnit.position.x;
              wdz = wz - currentUnit.position.z;
              wDist = Math.hypot(wdx, wdz);
            } else {
              // Reached final waypoint
              currentUnit.path = undefined;
              currentUnit.currentPathIndex = undefined;
              if (currentUnit.status === "moving") currentUnit.status = "idle";
              return currentUnit;
            }
          }

          const step = Math.min(wDist, speed * delta);
          const moveX = wDist > 0.001 ? currentUnit.position.x + (wdx / wDist) * step : currentUnit.position.x;
          const moveZ = wDist > 0.001 ? currentUnit.position.z + (wdz / wDist) * step : currentUnit.position.z;

          if (wDist > 0.001) {
            currentUnit.heading = Math.atan2(wdx, wdz);
          }

          let newY = currentUnit.position.y;
          if (hexGrid) {
            const [curQ, curR] = worldToHex(moveX, moveZ);
            const cell = hexGrid.getCell(curQ, curR);
            if (cell) newY = cell.worldY;
          }

          currentUnit.position = { x: moveX, y: newY, z: moveZ };
          return currentUnit;
        }
      }

      // Direct targetPosition movement (Air units or fallback)
      if (currentUnit.targetPosition) {
        const tdx = currentUnit.targetPosition.x - currentUnit.position.x;
        const tdz = currentUnit.targetPosition.z - currentUnit.position.z;
        const tDist = Math.hypot(tdx, tdz);

        if (tDist <= 0.3) {
          currentUnit.targetPosition = undefined;
          if (currentUnit.status === "moving") currentUnit.status = "idle";
          return currentUnit;
        }

        const step = Math.min(tDist, speed * delta);
        const moveX = currentUnit.position.x + (tdx / tDist) * step;
        const moveZ = currentUnit.position.z + (tdz / tDist) * step;
        currentUnit.heading = Math.atan2(tdx, tdz);

        let newY = currentUnit.position.y;
        if (hexGrid) {
          const [curQ, curR] = worldToHex(moveX, moveZ);
          const cell = hexGrid.getCell(curQ, curR);
          if (cell) newY = cell.worldY;
        }

        currentUnit.position = { x: moveX, y: newY, z: moveZ };
        return currentUnit;
      }

      return currentUnit;
    });

    return {
      units: updatedUnits,
      aliens: {
        ships: updatedAlienShips,
        groundUnits: updatedAliensGround,
      },
      buildings: updatedBuildings,
      eliminatedAliens,
    };
  }
}
