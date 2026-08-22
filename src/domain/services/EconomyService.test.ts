import { describe, it, expect } from "vitest";
import { EconomyService } from "./EconomyService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { hexToWorld, hexNeighbors } from "../../presentation/generator/hex/HexMath";
import type { PlacedBuilding } from "../entities/Building";
import type { ResourceNode } from "../mapEditorTypes";
import type { ColonyState } from "../entities/Colony";

describe("EconomyService - Extraction & Deposit Mechanics", () => {
  const [wx, wz] = hexToWorld(0, 0);

  it("should boost water production for ice extractor adjacent to ice deposits", () => {
    const placed: PlacedBuilding[] = [
      { id: "ice-1", definitionId: "ice", position: { x: wx, y: 0, z: wz }, condition: 100 },
    ];
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [0, 0], amount: 1000, richness: "med", model: "ice_01" },
    ];

    // Base water production of 'ice' is 0.40, power is -0.20
    // With 1 matching deposit, multiplier is 1.5 -> water = 0.40 * 1.5 = 0.60
    // Power consumption remains -0.20 (consumption is not boosted by deposit bonus)
    const production = EconomyService.calculateProduction(
      placed,
      BUILDING_DEFINITIONS,
      1.0,
      1.0,
      deposits
    );

    expect(production.water).toBeCloseTo(0.60, 4);
    expect(production.power).toBeCloseTo(-0.20, 4);
  });

  it("should boost biomass production for miner adjacent to mineral deposits", () => {
    const neighbors = hexNeighbors(0, 0);
    const placed: PlacedBuilding[] = [
      { id: "miner-1", definitionId: "miner", position: { x: wx, y: 0, z: wz }, condition: 100 },
    ];
    const deposits: ResourceNode[] = [
      { id: "m1", type: "minerals", pos: [0, 0], amount: 1000, richness: "med", model: "mineral_pile_01" },
      { id: "m2", type: "minerals", pos: neighbors[0], amount: 1000, richness: "med", model: "mineral_pile_01" },
    ];

    // Miner base biomass is 0.40, power is -0.30
    // 2 deposits -> 2.0x multiplier -> biomass = 0.80
    const production = EconomyService.calculateProduction(
      placed,
      BUILDING_DEFINITIONS,
      1.0,
      1.0,
      deposits
    );

    expect(production.biomass).toBeCloseTo(0.80, 4);
    expect(production.power).toBeCloseTo(-0.30, 4);
  });

  it("should deplete extracted deposits when depletionRate > 0", () => {
    const placed: PlacedBuilding[] = [
      { id: "ice-1", definitionId: "ice", position: { x: wx, y: 0, z: wz }, condition: 100 },
    ];
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [0, 0], amount: 100, richness: "med", model: "ice_01" },
      { id: "d2", type: "ice", pos: [10, 10], amount: 500, richness: "med", model: "ice_01" }, // far away
    ];

    const updated = EconomyService.depleteDeposits(
      placed,
      BUILDING_DEFINITIONS,
      deposits,
      0.5 // depletion rate
    );

    expect(updated[0].amount).toBe(99.5);
    expect(updated[1].amount).toBe(500); // unaffected
  });

  it("should not deplete deposits when depletionRate is 0 (e.g. sandbox/adventure mode)", () => {
    const placed: PlacedBuilding[] = [
      { id: "ice-1", definitionId: "ice", position: { x: wx, y: 0, z: wz }, condition: 100 },
    ];
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [0, 0], amount: 100, richness: "med", model: "ice_01" },
    ];

    const updated = EconomyService.depleteDeposits(
      placed,
      BUILDING_DEFINITIONS,
      deposits,
      0
    );

    expect(updated[0].amount).toBe(100);
  });

  it("should run economy tick and update resources with deposit bonuses and depletion", () => {
    const colony: ColonyState = {
      resources: { o2: 10, power: 20, water: 10, biomass: 5 },
      capacity: { power: 100, water: 100, biomass: 100 },
      sun: 1.0,
      alive: true,
    };
    const placed: PlacedBuilding[] = [
      { id: "ice-1", definitionId: "ice", position: { x: wx, y: 0, z: wz }, condition: 100 },
    ];
    const deposits: ResourceNode[] = [
      { id: "d1", type: "ice", pos: [0, 0], amount: 50, richness: "med", model: "ice_01" },
    ];

    const result = EconomyService.tick(
      colony,
      placed,
      BUILDING_DEFINITIONS,
      1.0,
      deposits,
      0.1
    );

    expect(result.gameOver).toBe(false);
    expect(result.delta.water).toBeCloseTo(0.60, 4); // 0.40 * 1.5
    expect(result.resourceNodes?.[0].amount).toBe(49.9);
  });
});
