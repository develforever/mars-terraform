import { describe, it, expect } from "vitest";
import {
  BuildingConnectionService,
  DEFAULT_MAX_GRID_DISTANCE,
} from "./BuildingConnectionService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { hexToWorld } from "../../presentation/generator/hex/HexMath";
import type { PlacedBuilding } from "../entities/Building";

describe("BuildingConnectionService - Role Classification", () => {
  it("should classify power producers correctly", () => {
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["solar"])).toBe("producer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["rtg"])).toBe("producer");
  });

  it("should classify power consumers correctly", () => {
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["hab"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["greenhouse"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["o2-gen"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["miner"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["lab"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["turret"])).toBe("consumer");
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["ice"])).toBe("consumer");
  });

  it("should classify power storage correctly", () => {
    expect(BuildingConnectionService.getPowerRole(BUILDING_DEFINITIONS["battery"])).toBe("storage");
  });

  it("should classify water producers correctly", () => {
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["ice"])).toBe("producer");
  });

  it("should classify water consumers correctly", () => {
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["hab"])).toBe("consumer");
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["greenhouse"])).toBe("consumer");
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["lab"])).toBe("consumer");
  });

  it("should classify water storage correctly", () => {
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["watertank"])).toBe("storage");
  });

  it("should return null for undefined or non-participating buildings", () => {
    expect(BuildingConnectionService.getPowerRole(undefined)).toBeNull();
    expect(BuildingConnectionService.getWaterRole(BUILDING_DEFINITIONS["solar"])).toBeNull();
  });
});

describe("BuildingConnectionService - Hex Distances and Candidate Edges", () => {
  it("should find candidate edges within max axial distance R <= 4", () => {
    const [w0x, w0z] = hexToWorld(0, 0);
    const [w3x, w3z] = hexToWorld(3, 0); // distance = 3 (<= 4)
    const [w5x, w5z] = hexToWorld(5, 0); // distance = 5 (> 4)

    const solar: PlacedBuilding = {
      id: "solar-1",
      definitionId: "solar",
      position: { x: w0x, y: 0, z: w0z },
      condition: 100,
    };
    const habNear: PlacedBuilding = {
      id: "hab-near",
      definitionId: "hab",
      position: { x: w3x, y: 0, z: w3z },
      condition: 100,
    };
    const habFar: PlacedBuilding = {
      id: "hab-far",
      definitionId: "hab",
      position: { x: w5x, y: 0, z: w5z },
      condition: 100,
    };

    const placed = [solar, habNear, habFar];
    const powerEdges = BuildingConnectionService.getCandidateEdges(
      placed,
      BUILDING_DEFINITIONS,
      "power",
      DEFAULT_MAX_GRID_DISTANCE
    );

    // solar <-> habNear is distance 3 (valid)
    // habNear <-> habFar is distance 2 (valid)
    // solar <-> habFar is distance 5 (invalid)
    expect(powerEdges).toHaveLength(2);
    expect(powerEdges.some((e) => e.from.id === "solar-1" && e.to.id === "hab-near")).toBe(true);
    expect(powerEdges.some((e) => e.from.id === "hab-near" && e.to.id === "hab-far")).toBe(true);
    expect(powerEdges.some((e) => (e.from.id === "solar-1" && e.to.id === "hab-far") || (e.from.id === "hab-far" && e.to.id === "solar-1"))).toBe(false);
  });
});

describe("BuildingConnectionService - Spanning Tree & Graph Connectivity", () => {
  it("should create a minimum spanning forest without redundant cycles", () => {
    // 3 buildings in a triangle with pairwise distance 1
    const [w0x, w0z] = hexToWorld(0, 0);
    const [w1x, w1z] = hexToWorld(1, 0);
    const [w2x, w2z] = hexToWorld(0, 1);

    const b1: PlacedBuilding = { id: "solar-1", definitionId: "solar", position: { x: w0x, y: 0, z: w0z }, condition: 100 };
    const b2: PlacedBuilding = { id: "hab-1", definitionId: "hab", position: { x: w1x, y: 0, z: w1z }, condition: 100 };
    const b3: PlacedBuilding = { id: "o2-1", definitionId: "o2-gen", position: { x: w2x, y: 0, z: w2z }, condition: 100 };

    const placed = [b1, b2, b3];
    const connections = BuildingConnectionService.getSpanningConnectionsForGrid(
      placed,
      BUILDING_DEFINITIONS,
      "power",
      4
    );

    // For 3 connected nodes, a spanning tree has exactly 2 edges (no 3rd redundant cycle edge)
    expect(connections).toHaveLength(2);
    expect(connections.every((c) => c.type === "power")).toBe(true);
  });

  it("should handle separate isolated clusters as distinct sub-trees", () => {
    // Cluster 1 at (0, 0)
    const [c1_1x, c1_1z] = hexToWorld(0, 0);
    const [c1_2x, c1_2z] = hexToWorld(1, 0);

    // Cluster 2 far away at (15, 15)
    const [c2_1x, c2_1z] = hexToWorld(15, 15);
    const [c2_2x, c2_2z] = hexToWorld(16, 15);

    const b1: PlacedBuilding = { id: "c1-solar", definitionId: "solar", position: { x: c1_1x, y: 0, z: c1_1z }, condition: 100 };
    const b2: PlacedBuilding = { id: "c1-hab", definitionId: "hab", position: { x: c1_2x, y: 0, z: c1_2z }, condition: 100 };
    const b3: PlacedBuilding = { id: "c2-solar", definitionId: "solar", position: { x: c2_1x, y: 0, z: c2_1z }, condition: 100 };
    const b4: PlacedBuilding = { id: "c2-hab", definitionId: "hab", position: { x: c2_2x, y: 0, z: c2_2z }, condition: 100 };

    const placed = [b1, b2, b3, b4];
    const connections = BuildingConnectionService.getSpanningConnectionsForGrid(
      placed,
      BUILDING_DEFINITIONS,
      "power",
      4
    );

    // Exactly 2 connections: 1 for cluster 1, 1 for cluster 2
    expect(connections).toHaveLength(2);

    const stats = BuildingConnectionService.getNetworkStats(placed, BUILDING_DEFINITIONS, 4);
    expect(stats.powerClustersCount).toBe(2);
    expect(stats.powerProducersCount).toBe(2);
    expect(stats.powerConsumersCount).toBe(2);
  });

  it("should check isSupplied correctly for power and water", () => {
    const [w0x, w0z] = hexToWorld(0, 0);
    const [w1x, w1z] = hexToWorld(1, 0);
    const [w2x, w2z] = hexToWorld(2, 0);
    const [w10x, w10z] = hexToWorld(10, 10);

    const solar: PlacedBuilding = { id: "solar-1", definitionId: "solar", position: { x: w0x, y: 0, z: w0z }, condition: 100 };
    const battery: PlacedBuilding = { id: "bat-1", definitionId: "battery", position: { x: w1x, y: 0, z: w1z }, condition: 100 };
    const hab: PlacedBuilding = { id: "hab-1", definitionId: "hab", position: { x: w2x, y: 0, z: w2z }, condition: 100 };
    const isolatedHab: PlacedBuilding = { id: "hab-isolated", definitionId: "hab", position: { x: w10x, y: 0, z: w10z }, condition: 100 };

    const ice: PlacedBuilding = { id: "ice-1", definitionId: "ice", position: { x: w0x, y: 0, z: w0z }, condition: 100 };

    const placed = [solar, battery, hab, isolatedHab, ice];

    // Hab is connected to Solar via Battery (distance 1 hops) -> power supplied
    expect(BuildingConnectionService.isSupplied("hab-1", placed, BUILDING_DEFINITIONS, "power", 4)).toBe(true);

    // Isolated hab is not connected to solar -> power not supplied
    expect(BuildingConnectionService.isSupplied("hab-isolated", placed, BUILDING_DEFINITIONS, "power", 4)).toBe(false);

    // Hab at (2, 0) is connected to Ice at (0, 0) (distance 2 <= 4) -> water supplied
    expect(BuildingConnectionService.isSupplied("hab-1", placed, BUILDING_DEFINITIONS, "water", 4)).toBe(true);
    expect(BuildingConnectionService.isSupplied("hab-isolated", placed, BUILDING_DEFINITIONS, "water", 4)).toBe(false);
  });

  it("should generate both power and water connections in getGridConnections", () => {
    const [w0x, w0z] = hexToWorld(0, 0);
    const [w1x, w1z] = hexToWorld(1, 0);
    const [w2x, w2z] = hexToWorld(2, 0);

    const solar: PlacedBuilding = { id: "solar-1", definitionId: "solar", position: { x: w0x, y: 0, z: w0z }, condition: 100 };
    const ice: PlacedBuilding = { id: "ice-1", definitionId: "ice", position: { x: w1x, y: 0, z: w1z }, condition: 100 };
    const greenhouse: PlacedBuilding = { id: "gh-1", definitionId: "greenhouse", position: { x: w2x, y: 0, z: w2z }, condition: 100 };

    const placed = [solar, ice, greenhouse];
    const connections = BuildingConnectionService.getGridConnections(placed, BUILDING_DEFINITIONS, 4);

    const powerConns = connections.filter((c) => c.type === "power");
    const waterConns = connections.filter((c) => c.type === "water");

    expect(powerConns.length).toBeGreaterThan(0);
    expect(waterConns.length).toBeGreaterThan(0);
  });
});
