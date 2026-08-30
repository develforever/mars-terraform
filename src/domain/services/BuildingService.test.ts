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
      level: 1,
    };
    const deposits: ResourceNode[] = [
      { id: "ice-node", type: "ice", pos: [3, 2], amount: 1000, richness: "med", model: "ice_01" },
    ];

    const mult = BuildingService.getDepositMultiplier(building, iceDef, deposits);
    expect(mult).toBe(1.5);
  });
});

describe("BuildingService - Building Upgrades & Logistics Units", () => {
  const iceDef = BUILDING_DEFINITIONS["ice"];
  const minerDef = BUILDING_DEFINITIONS["miner"];

  it("should return correct extraction radius per level", () => {
    const buildingLvl1: PlacedBuilding = {
      id: "b1",
      definitionId: "miner",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };
    const buildingLvl2: PlacedBuilding = { ...buildingLvl1, level: 2 };
    const buildingLvl3: PlacedBuilding = { ...buildingLvl1, level: 3 };

    expect(BuildingService.getExtractionRadius(buildingLvl1, minerDef)).toBe(1);
    expect(BuildingService.getExtractionRadius(buildingLvl2, minerDef)).toBe(2);
    expect(BuildingService.getExtractionRadius(buildingLvl3, minerDef)).toBe(4);
  });

  it("should return correct production multiplier per level", () => {
    const b1: PlacedBuilding = { id: "b1", definitionId: "miner", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 };
    const b2: PlacedBuilding = { ...b1, level: 2 };
    const b3: PlacedBuilding = { ...b1, level: 3 };

    expect(BuildingService.getLevelMultiplier(b1, minerDef)).toBe(1.0);
    expect(BuildingService.getLevelMultiplier(b2, minerDef)).toBe(1.5);
    expect(BuildingService.getLevelMultiplier(b3, minerDef)).toBe(2.2);
  });

  it("should find next upgrade for Level 1 and Level 2, but undefined for Level 3", () => {
    const b1: PlacedBuilding = { id: "b1", definitionId: "ice", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 };
    const b2: PlacedBuilding = { ...b1, level: 2 };
    const b3: PlacedBuilding = { ...b1, level: 3 };

    const up1 = BuildingService.getNextUpgrade(b1, iceDef);
    expect(up1).toBeDefined();
    expect(up1?.level).toBe(2);
    expect(up1?.unlockedUnit).toBe("rover");
    expect(up1?.extractionRadius).toBe(2);

    const up2 = BuildingService.getNextUpgrade(b2, iceDef);
    expect(up2).toBeDefined();
    expect(up2?.level).toBe(3);
    expect(up2?.unlockedUnit).toBe("drone");
    expect(up2?.extractionRadius).toBe(4);

    const up3 = BuildingService.getNextUpgrade(b3, iceDef);
    expect(up3).toBeUndefined();
  });

  it("should validate canUpgrade based on resources and max level", () => {
    const b1: PlacedBuilding = { id: "b1", definitionId: "ice", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 };
    
    // Insufficient resources for Lvl 2 ({ minerals: 23 })
    const poorResources = { o2: 100, power: 100, water: 10, biomass: 10, minerals: 5 };
    const checkPoor = BuildingService.canUpgrade(b1, iceDef, poorResources);
    expect(checkPoor.canUpgrade).toBe(false);
    expect(checkPoor.error).toBe("Cannot afford upgrade");

    // Sufficient resources
    const richResources = { o2: 100, power: 50, water: 50, biomass: 50, minerals: 50 };
    const checkRich = BuildingService.canUpgrade(b1, iceDef, richResources);
    expect(checkRich.canUpgrade).toBe(true);

    // Max level check
    const b3: PlacedBuilding = { ...b1, level: 3 };
    const checkMax = BuildingService.canUpgrade(b3, iceDef, richResources);
    expect(checkMax.canUpgrade).toBe(false);
    expect(checkMax.error).toBe("Max level reached");
  });

  it("should successfully upgrade building and return updated level and cost delta", () => {
    const b1: PlacedBuilding = { id: "b1", definitionId: "ice", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 };
    const resources = { o2: 100, power: 20, water: 20, biomass: 20, minerals: 50 };

    const result = BuildingService.upgradeBuilding(b1, iceDef, resources);
    expect(result.success).toBe(true);
    expect(result.building?.level).toBe(2);
    expect(result.costDelta?.minerals).toBe(-23);
  });

  it("should detect distant deposits when extraction radius increases with level", () => {
    // Building at [0, 0]
    const [wx, wz] = hexToWorld(0, 0);
    // Deposit at [2, 0] (axial distance = 2)
    const deposits: ResourceNode[] = [
      { id: "ice-dist2", type: "ice", pos: [2, 0], amount: 1000, richness: "med", model: "ice_01" },
    ];

    // Lvl 1 (R=1): cannot reach distance 2
    const effLvl1 = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits, 1);
    expect(effLvl1.multiplier).toBe(1.0);
    expect(effLvl1.count).toBe(0);

    // Lvl 2 (R=2): can reach distance 2
    const effLvl2 = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, deposits, 2);
    expect(effLvl2.multiplier).toBe(1.5);
    expect(effLvl2.count).toBe(1);
    expect(effLvl2.matchingNodes[0].id).toBe("ice-dist2");

    // Deposit at [4, 0] (axial distance = 4)
    const depositsFar: ResourceNode[] = [
      { id: "ice-dist4", type: "ice", pos: [4, 0], amount: 1000, richness: "med", model: "ice_01" },
    ];

    // Lvl 2 (R=2): cannot reach distance 4
    const effLvl2Far = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, depositsFar, 2);
    expect(effLvl2Far.count).toBe(0);

    // Lvl 3 (R=4): can reach distance 4
    const effLvl3Far = BuildingService.getDepositEfficiencyAtCell(iceDef, { x: wx, z: wz }, depositsFar, 4);
    expect(effLvl3Far.count).toBe(1);
    expect(effLvl3Far.multiplier).toBe(1.5);
  });
});

