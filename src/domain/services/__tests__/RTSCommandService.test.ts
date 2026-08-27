import { describe, it, expect, beforeEach } from "vitest";
import { RTSCommandService } from "../RTSCommandService";
import { HexGrid } from "../../../presentation/generator/hex/HexGrid";
import { UNIT_IDS } from "../../config/units";
import type { PlacedUnit } from "../../entities/Unit";
import type { PlacedBuilding } from "../../entities/Building";
import type { AlienGroundUnit } from "../../entities/Alien";

describe("RTSCommandService", () => {
  let grid: HexGrid;
  let testUnit: PlacedUnit;
  let testCombatRover: PlacedUnit;
  let testRepairDrone: PlacedUnit;

  beforeEach(() => {
    grid = new HexGrid(10, 42);
    grid.generate();

    testUnit = {
      id: "unit-1",
      definitionId: UNIT_IDS.ROVER,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      currentHealth: 100,
      status: "idle",
    };

    testCombatRover = {
      id: "combat-1",
      definitionId: UNIT_IDS.ROVER_COMBAT,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      currentHealth: 250,
      status: "idle",
    };

    testRepairDrone = {
      id: "repair-1",
      definitionId: UNIT_IDS.DRONE_REPAIR,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      currentHealth: 120,
      status: "idle",
    };
  });

  it("issues a MOVE order using A* pathfinding on hex grid", () => {
    const moved = RTSCommandService.issueMoveOrder(
      testUnit,
      { x: 3.6, y: 0, z: 2.0 },
      grid,
      0
    );

    expect(moved.status).toBe("moving");
    expect(moved.targetPosition).toEqual({ x: 3.6, y: 0, z: 2.0 });
    expect(moved.path).toBeDefined();
    expect(moved.path!.length).toBeGreaterThan(0);
  });

  it("issues an ATTACK order targeting alien ground unit", () => {
    const alien: AlienGroundUnit = {
      id: "alien-1",
      position: { x: 4.0, y: 0, z: 4.0 },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };

    const ordered = RTSCommandService.issueAttackOrder(
      testCombatRover,
      alien,
      grid,
      0
    );

    expect(ordered.status).toBe("combat");
    expect(ordered.targetEntityId).toBe("alien-1");
    expect(ordered.targetType).toBe("alien");
  });

  it("issues a REPAIR order targeting a damaged building", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 2.0, y: 0, z: 2.0 },
      condition: 50,
      level: 1,
    };

    const ordered = RTSCommandService.issueRepairOrder(
      testRepairDrone,
      building,
      grid,
      0
    );

    expect(ordered.status).toBe("repairing");
    expect(ordered.targetEntityId).toBe("hab-1");
    expect(ordered.targetType).toBe("building");
  });

  it("issues a STOP order clearing target and resetting state to idle", () => {
    const busyUnit: PlacedUnit = {
      ...testUnit,
      status: "moving",
      targetPosition: { x: 10, y: 0, z: 10 },
      path: [[0, 0], [1, 0]],
      currentPathIndex: 0,
    };

    const stopped = RTSCommandService.issueStopOrder(busyUnit);

    expect(stopped.status).toBe("idle");
    expect(stopped.targetPosition).toBeUndefined();
    expect(stopped.path).toBeUndefined();
    expect(stopped.currentPathIndex).toBeUndefined();
  });

  it("simulates combat and eliminates alien in attack range", () => {
    const alien: AlienGroundUnit = {
      id: "alien-target",
      position: { x: 2.0, y: 0, z: 2.0 },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };

    const readyCombatUnit: PlacedUnit = {
      ...testCombatRover,
      position: { x: 0, y: 0, z: 0 },
      status: "combat",
      targetEntityId: "alien-target",
      targetType: "alien",
      attackCooldown: 0,
    };

    const simResult = RTSCommandService.tickUnits(
      [readyCombatUnit],
      { ships: [], groundUnits: [alien] },
      [],
      grid,
      0,
      0.1
    );

    expect(simResult.eliminatedAliens).toBe(1);
    expect(simResult.aliens.groundUnits.length).toBe(0);
    expect(simResult.units[0].status).toBe("idle");
  });

  it("simulates repair and restores building condition", () => {
    const damagedBuilding: PlacedBuilding = {
      id: "damaged-bld",
      definitionId: "solar",
      position: { x: 1.0, y: 0, z: 1.0 },
      condition: 80,
      level: 1,
    };

    const readyRepairDrone: PlacedUnit = {
      ...testRepairDrone,
      position: { x: 0, y: 0, z: 0 },
      status: "repairing",
      targetEntityId: "damaged-bld",
      targetType: "building",
    };

    const simResult = RTSCommandService.tickUnits(
      [readyRepairDrone],
      { ships: [], groundUnits: [] },
      [damagedBuilding],
      grid,
      0,
      1.0 // 1s delta -> +15 HP
    );

    expect(simResult.buildings[0].condition).toBe(95);
  });
});
