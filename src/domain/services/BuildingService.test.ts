import { describe, it, expect } from "vitest";
import { BuildingService } from "./BuildingService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { hexToWorld, hexNeighbors } from "../../presentation/generator/hex/HexMath";
import type { ResourceNode } from "../mapEditorTypes";
import type { PlacedBuilding } from "../entities/Building";

describe("BuildingService - Resource Deposit Efficiency & Hex Adjacency", () => {
  const iceDef = BUILDING_DEFINITIONS["ice"];
  const minerDef = BUILDING_DEFINITIONS["miner"];
  const solarDef = BUILDING_DEFINITIONS["solar"];

  it("should return base multiplier 1.0 for non-extractive buildings", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [0, 0], amount: 1000, richness: "med", model: "ice_01" },
      { id: "d2", type: "minerals", pos: [1, 0], amount: 1000, richness: "med", model: "mineral_pile_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(solarDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.0);
    expect(efficiency.count).toBe(0);
    expect(efficiency.matchingNodes).toHaveLength(0);
  });

  it("should return base 1.0 when extractor has no nearby deposits", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [5, 5], amount: 1000, richness: "med", model: "ice_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.0);
    expect(efficiency.count).toBe(0);
    expect(efficiency.depositType).toBe("ice");
  });

  it("should calculate +50% bonus (1.5x) when extractor is directly on matching deposit", () => {
    const [wx, wz] = hexToWorld(2, -1);
    const deposits: ResourceNode[] = [
      { id: "ice-1", type: "ice", pos: [2, -1], amount: 1200, richness: "med", model: "ice_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.5);
    expect(efficiency.count).toBe(1);
    expect(efficiency.matchingNodes[0].id).toBe("ice-1");
  });

  it("should calculate +50% bonus (1.5x) for each direct neighbor hex", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const neighbors = hexNeighbors(0, 0);
    const neighborPos = neighbors[0]; // [1, 0]

    const deposits: ResourceNode[] = [
      { id: "ice-neighbor", type: "ice", pos: neighborPos, amount: 800, richness: "low", model: "ice_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.5);
    expect(efficiency.count).toBe(1);
  });

  it("should stack bonuses (+50% per deposit) for multiple adjacent deposits", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const neighbors = hexNeighbors(0, 0);

    const deposits: ResourceNode[] = [
      { id: "min-center", type: "minerals", pos: [0, 0], amount: 1000, richness: "med", model: "mineral_pile_01" },
      { id: "min-n1", type: "minerals", pos: neighbors[0], amount: 1500, richness: "high", model: "mineral_pile_01" },
      { id: "min-n2", type: "minerals", pos: neighbors[1], amount: 1000, richness: "med", model: "mineral_pile_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(minerDef, { x: wx, z: wz }, deposits);
    // 3 matching deposits -> 1.0 + 3 * 0.5 = 2.5 (250% yield)
    expect(efficiency.multiplier).toBe(2.5);
    expect(efficiency.count).toBe(3);
    expect(efficiency.matchingNodes).toHaveLength(3);
  });

  it("should ignore non-matching deposit types", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const deposits: ResourceNode[] = [
      { id: "min-center", type: "minerals", pos: [0, 0], amount: 1000, richness: "med", model: "mineral_pile_01" },
      { id: "org-n1", type: "organics", pos: [1, 0], amount: 1000, richness: "med", model: "organics_01" },
    ];

    // Ice extractor only extracts 'ice'
    const efficiency = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.0);
    expect(efficiency.count).toBe(0);
  });

  it("should ignore depleted deposits (amount <= 0)", () => {
    const [wx, wz] = hexToWorld(0, 0);
    const deposits: ResourceNode[] = [
      { id: "ice-depleted", type: "ice", pos: [0, 0], amount: 0, richness: "med", model: "ice_01" },
      { id: "ice-active", type: "ice", pos: [1, 0], amount: 500, richness: "low", model: "ice_01" },
    ];

    const efficiency = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits);
    expect(efficiency.multiplier).toBe(1.5);
    expect(efficiency.count).toBe(1);
    expect(efficiency.matchingNodes[0].id).toBe("ice-active");
  });

  it("should calculate getDepositMultiplier for PlacedBuilding", () => {
    const [wx, wz] = hexToWorld(3, 2);
    const building: PlacedBuilding = {
      id: "bld-1",
      definitionId: "ice",
      position: { x: wx, y: 1.2, z: wz },
      condition: 100,
    };
    const deposits: ResourceNode[] = [
      { id: "ice-node", type: "ice", pos: [3, 2], amount: 1000, richness: "med", model: "ice_01" },
    ];

    const mult = BuildingService.getDepositMultiplier(building, iceDef, deposits);
    expect(mult).toBe(1.5);
  });
});
