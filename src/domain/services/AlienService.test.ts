import { describe, it, expect, beforeEach } from "vitest";
import { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { hexToWorld, worldToHex } from "../../presentation/generator/hex/HexMath";
import { AlienService } from "./AlienService";
import type { PlacedBuilding } from "../entities/Building";
import type { AlienState, AlienGroundUnit } from "../entities/Alien";

describe("AlienService & HexPathfinding Unit Navigation", () => {
  let grid: HexGrid;
  let testBuilding: PlacedBuilding;

  beforeEach(() => {
    grid = new HexGrid(10, 42);
    grid.generate(); // All hexes start flat plains (worldY = 1.2)

    // Place a building at world coordinate corresponding to hex (0, 4)
    const [bx, bz] = hexToWorld(0, 4);
    testBuilding = {
      id: "building-main",
      definitionId: "colony",
      position: { x: bx, y: 1.2, z: bz },
      condition: 100,
    };
  });

  it("should resolve alien wave based on terraforming progress", () => {
    expect(AlienService.resolveWave(0)).toBe(0);
    expect(AlienService.resolveWave(24)).toBe(0);
    expect(AlienService.resolveWave(25)).toBe(1);
    expect(AlienService.resolveWave(59)).toBe(1);
    expect(AlienService.resolveWave(60)).toBe(2);
    expect(AlienService.resolveWave(100)).toBe(2);
  });

  it("should spawn ground unit on valid boundary hex and correct elevation", () => {
    const unit = AlienService.spawnGroundUnit(grid);
    expect(unit.id).toBeDefined();
    expect(unit.active).toBe(true);

    const [q, r] = worldToHex(unit.position.x, unit.position.z);
    const cell = grid.getCell(q, r);
    expect(cell).toBeDefined();
    expect(unit.position.y).toBe(cell?.worldY);
  });

  it("should navigate in hex path towards closest building on flat terrain", () => {
    const [startWx, startWz] = hexToWorld(0, 0);
    const groundUnit: AlienGroundUnit = {
      id: "ground-test-1",
      position: { x: startWx, y: 1.2, z: startWz },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };

    const state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [groundUnit],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    const result = AlienService.tick(state, [testBuilding], 60, grid);
    const updatedUnit = result.alienState.groundUnits[0];

    expect(updatedUnit).toBeDefined();
    expect(updatedUnit.targetBuildingId).toBe(testBuilding.id);
    expect(updatedUnit.path).toBeDefined();
    expect(updatedUnit.path?.length).toBeGreaterThan(1);
    expect(updatedUnit.path?.[0]).toEqual([0, 0]);
    expect(updatedUnit.path?.[updatedUnit.path.length - 1]).toEqual([0, 4]);

    // Unit should have advanced along Z towards next waypoint (0, 1)
    expect(updatedUnit.position.z).toBeGreaterThan(startWz);
    expect(updatedUnit.currentPathIndex).toBe(1);
  });

  it("should detour around high elevation cliff (peak) exceeding maxClimb", () => {
    // Set cell (0, 1) and (0, 2) to 'peak' (worldY = 4.0, cliff height diff = 2.8 > 0.85)
    grid.setTerrainType(0, 1, "peak");
    grid.setTerrainType(0, 2, "peak");

    const [startWx, startWz] = hexToWorld(0, 0);
    const groundUnit: AlienGroundUnit = {
      id: "ground-test-cliff",
      position: { x: startWx, y: 1.2, z: startWz },
      targetBuildingId: null,
      attackCooldown: 0,
      active: true,
    };

    const state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [groundUnit],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    const result = AlienService.tick(state, [testBuilding], 60, grid);
    const updatedUnit = result.alienState.groundUnits[0];

    expect(updatedUnit.path).toBeDefined();
    // Path should avoid (0, 1) and (0, 2)
    const containsCliff1 = updatedUnit.path?.some(([q, r]) => q === 0 && r === 1);
    const containsCliff2 = updatedUnit.path?.some(([q, r]) => q === 0 && r === 2);
    expect(containsCliff1).toBe(false);
    expect(containsCliff2).toBe(false);

    // Path must start at (0, 0) and reach (0, 4)
    expect(updatedUnit.path?.[0]).toEqual([0, 0]);
    expect(updatedUnit.path?.[updatedUnit.path.length - 1]).toEqual([0, 4]);
  });

  it("should advance through waypoints across multiple ticks and attack upon arrival", () => {
    // Start unit at (0, 2)
    const [startWx, startWz] = hexToWorld(0, 2);
    let state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [{
        id: "ground-advance",
        position: { x: startWx, y: 1.2, z: startWz },
        targetBuildingId: null,
        attackCooldown: 0,
        active: true,
      }],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    let buildings = [testBuilding];

    // Tick 1: move from (0, 2) towards (0, 3)
    const tick1 = AlienService.tick(state, buildings, 60, grid);
    state = tick1.alienState;
    buildings = tick1.damagedBuildings;
    expect(state.groundUnits[0].position.z).toBeGreaterThan(startWz);

    // Tick 2: continues moving into attack range (distance <= 2.5)
    const tick2 = AlienService.tick(state, buildings, 60, grid);
    state = tick2.alienState;
    buildings = tick2.damagedBuildings;

    // Tick 3: within attack range -> deals damage & resets cooldown
    const tick3 = AlienService.tick(state, buildings, 60, grid);
    state = tick3.alienState;
    buildings = tick3.damagedBuildings;

    const targetB = buildings.find(b => b.id === testBuilding.id);
    expect(targetB?.condition).toBeLessThan(100);
    expect(state.groundUnits[0].attackCooldown).toBe(5);
  });

  it("should remain in place if path is completely blocked by cliffs and no alternative target exists", () => {
    // Surround target (0, 4) with impassable peaks
    const neighbors: [number, number][] = [
      [1, 4], [1, 3], [0, 3],
      [-1, 4], [-1, 5], [0, 5],
    ];
    for (const [nq, nr] of neighbors) {
      grid.setTerrainType(nq, nr, "peak");
    }

    const [startWx, startWz] = hexToWorld(0, 0);
    const state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [{
        id: "ground-blocked",
        position: { x: startWx, y: 1.2, z: startWz },
        targetBuildingId: null,
        attackCooldown: 0,
        active: true,
      }],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    const result = AlienService.tick(state, [testBuilding], 60, grid);
    const unit = result.alienState.groundUnits[0];

    expect(unit.path).toBeUndefined();
    expect(unit.position.x).toBe(startWx);
    expect(unit.position.z).toBe(startWz);
  });

  it("should switch to reachable alternative building when closest is surrounded by cliffs", () => {
    // Closest building at (0, 3) surrounded by peaks
    const [c1x, c1z] = hexToWorld(0, 3);
    const trappedBuilding: PlacedBuilding = {
      id: "building-trapped",
      definitionId: "colony",
      position: { x: c1x, y: 1.2, z: c1z },
      condition: 100,
    };
    const neighbors: [number, number][] = [
      [1, 3], [1, 2], [0, 2],
      [-1, 3], [-1, 4], [0, 4],
    ];
    for (const [nq, nr] of neighbors) {
      grid.setTerrainType(nq, nr, "peak");
    }

    // Accessible building further away at (3, 0)
    const [c2x, c2z] = hexToWorld(3, 0);
    const accessibleBuilding: PlacedBuilding = {
      id: "building-accessible",
      definitionId: "solar_power",
      position: { x: c2x, y: 1.2, z: c2z },
      condition: 100,
    };

    const [startWx, startWz] = hexToWorld(0, 0);
    const state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [{
        id: "ground-switch",
        position: { x: startWx, y: 1.2, z: startWz },
        targetBuildingId: null,
        attackCooldown: 0,
        active: true,
      }],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    const result = AlienService.tick(state, [trappedBuilding, accessibleBuilding], 60, grid);
    const unit = result.alienState.groundUnits[0];

    expect(unit.path).toBeDefined();
    expect(unit.path?.[unit.path.length - 1]).toEqual([3, 0]);
    expect(unit.targetBuildingId).toBe(accessibleBuilding.id);
  });

  it("should eliminate ground units in turret range", () => {
    const [tx, tz] = hexToWorld(0, 2);
    const turret: PlacedBuilding = {
      id: "turret-1",
      definitionId: "turret",
      position: { x: tx, y: 1.2, z: tz },
      condition: 100,
    };

    const [ux, uz] = hexToWorld(0, 3);
    const state: AlienState = {
      wave: 2,
      ships: [],
      groundUnits: [{
        id: "ground-near-turret",
        position: { x: ux, y: 1.2, z: uz },
        targetBuildingId: null,
        attackCooldown: 0,
        active: true,
      }],
      nextShipSpawnIn: 100,
      nextGroundSpawnIn: 100,
    };

    const result = AlienService.tick(state, [turret, testBuilding], 60, grid);
    expect(result.alienState.groundUnits.length).toBe(0);
  });
});
