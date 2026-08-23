import { describe, it, expect, beforeEach } from "vitest";
import { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { HexPathfindingService } from "./HexPathfindingService";

describe("HexPathfindingService", () => {
  let grid: HexGrid;

  beforeEach(() => {
    grid = new HexGrid(5, 42);
    grid.generate(); // All hexes start flat with terrainType 'plains' (worldY = 1.2)
  });

  it("should find a simple straight path on flat terrain", () => {
    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2]);

    expect(path).not.toBeNull();
    expect(path).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
  });

  it("should detour around high elevation cliffs exceeding maxClimb", () => {
    // Set cell (0, 1) to 'peak' (worldY = 4.0).
    // Plains worldY = 1.2, so diff = 2.8 > maxClimb (0.85).
    grid.setTerrainType(0, 1, "peak");

    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], { maxClimb: 0.85 });

    expect(path).not.toBeNull();
    // Path should avoid (0, 1)
    const containsPeak = path?.some(([q, r]) => q === 0 && r === 1);
    expect(containsPeak).toBe(false);
    expect(path?.[0]).toEqual([0, 0]);
    expect(path?.[path.length - 1]).toEqual([0, 2]);
  });

  it("should return null when target is completely surrounded by impassable cliffs", () => {
    // Surround target (0, 2) with peaks on all 6 neighbors:
    // (1, 2), (1, 1), (0, 1), (-1, 2), (-1, 3), (0, 3)
    const neighbors: [number, number][] = [
      [1, 2], [1, 1], [0, 1],
      [-1, 2], [-1, 3], [0, 3],
    ];

    for (const [nq, nr] of neighbors) {
      grid.setTerrainType(nq, nr, "peak");
    }

    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], { maxClimb: 0.85 });

    expect(path).toBeNull();
  });

  it("should respect blocked userType hexes", () => {
    // Set cell (0, 1) to userType 'build'
    grid.setUserType(0, 1, "build");

    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], {
      blockedUserTypes: ["build"],
    });

    expect(path).not.toBeNull();
    const containsBlocked = path?.some(([q, r]) => q === 0 && r === 1);
    expect(containsBlocked).toBe(false);
    expect(path?.[0]).toEqual([0, 0]);
    expect(path?.[path.length - 1]).toEqual([0, 2]);
  });

  it("should return single node array when start equals target", () => {
    const path = HexPathfindingService.findPath(grid, [1, 1], [1, 1]);

    expect(path).toEqual([[1, 1]]);
  });

  it("should return null if start or target is out of grid bounds", () => {
    const path1 = HexPathfindingService.findPath(grid, [99, 99], [0, 0]);
    const path2 = HexPathfindingService.findPath(grid, [0, 0], [99, 99]);

    expect(path1).toBeNull();
    expect(path2).toBeNull();
  });

  it("should return null if start or target itself is blocked", () => {
    grid.setUserType(0, 0, "build");
    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], {
      blockedUserTypes: ["build"],
    });

    expect(path).toBeNull();
  });

  it("should detour around submerged hexes when waterLevel is provided", () => {
    // Set cell (0, 1) to deep_crater (worldY = 0.0). Plains are at worldY = 1.2.
    grid.setTerrainType(0, 1, "deep_crater");

    // With waterLevel = 0.5, (0, 1) is submerged (0.0 <= 0.5)
    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], {
      maxClimb: 2.0,
      waterLevel: 0.5,
    });

    expect(path).not.toBeNull();
    const containsSubmerged = path?.some(([q, r]) => q === 0 && r === 1);
    expect(containsSubmerged).toBe(false);
    expect(path?.[0]).toEqual([0, 0]);
    expect(path?.[path.length - 1]).toEqual([0, 2]);
  });

  it("should return null when start or target is submerged", () => {
    grid.setTerrainType(0, 0, "deep_crater"); // worldY = 0.0

    const path = HexPathfindingService.findPath(grid, [0, 0], [0, 2], {
      waterLevel: 0.5,
    });

    expect(path).toBeNull();
  });
});

