import { describe, it, expect } from "vitest";
import { ResearchService } from "./ResearchService";
import { TECH_IDS } from "../config/technologies";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import type { PlacedBuilding } from "../entities/Building";

// ── calculateRPProduction ────────────────────────────────────────────────────

describe("ResearchService.calculateRPProduction", () => {
  it("returns 0 when no buildings exist", () => {
    expect(ResearchService.calculateRPProduction([], BUILDING_DEFINITIONS)).toBe(0);
  });

  it("returns 0.2 RP when one hab is placed at full condition", () => {
    const placed: PlacedBuilding[] = [
      { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.2, 4);
  });

  it("scales Hab RP by condition factor (50% condition = 0.1 RP)", () => {
    const placed: PlacedBuilding[] = [
      { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 50 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.1, 4);
  });

  it("returns 0.5 RP for one Lab level-1 at full condition (without hab)", () => {
    const placed: PlacedBuilding[] = [
      { id: "lab-1", definitionId: "lab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.5, 4);
  });

  it("returns 0.75 RP for one Lab level-2 at full condition", () => {
    const placed: PlacedBuilding[] = [
      { id: "lab-1", definitionId: "lab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 2 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.75, 4);
  });

  it("returns 1.1 RP for one Lab level-3 at full condition", () => {
    const placed: PlacedBuilding[] = [
      { id: "lab-1", definitionId: "lab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 3 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(1.1, 4);
  });

  it("scales Lab RP by condition factor (50% condition = 0.25 RP from Lv1 lab)", () => {
    const placed: PlacedBuilding[] = [
      { id: "lab-1", definitionId: "lab", position: { x: 0, y: 0, z: 0 }, condition: 50, level: 1 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.25, 4);
  });

  it("sums RP from Hab and multiple labs", () => {
    const placed: PlacedBuilding[] = [
      { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100 },
      { id: "lab-1", definitionId: "lab", position: { x: 2, y: 0, z: 2 }, condition: 100, level: 1 },
      { id: "lab-2", definitionId: "lab", position: { x: 5, y: 0, z: 5 }, condition: 100, level: 2 },
    ];
    expect(ResearchService.calculateRPProduction(placed, BUILDING_DEFINITIONS)).toBeCloseTo(0.2 + 0.5 + 0.75, 4);
  });
});

// ── canResearch ──────────────────────────────────────────────────────────────

describe("ResearchService.canResearch", () => {
  it("returns already_researched if tech is already unlocked", () => {
    const result = ResearchService.canResearch(
      TECH_IDS.BASIC_STRUCTURES,
      999,
      [TECH_IDS.BASIC_STRUCTURES]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("already_researched");
  });

  it("returns missing_prereq when prereq is not unlocked", () => {
    const result = ResearchService.canResearch(
      TECH_IDS.ADVANCED_HAB, // requires basic_structures
      999,
      [] // nothing unlocked
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("missing_prereq");
  });

  it("returns insufficient_rp when player cannot afford the tech", () => {
    const result = ResearchService.canResearch(
      TECH_IDS.ADVANCED_HAB, // costs 30 RP
      10, // only 10 RP
      [TECH_IDS.BASIC_STRUCTURES]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("insufficient_rp");
  });

  it("returns allowed=true when prereqs met and RP sufficient", () => {
    const result = ResearchService.canResearch(
      TECH_IDS.ADVANCED_HAB, // costs 30 RP
      50, // enough RP
      [TECH_IDS.BASIC_STRUCTURES]
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });
});

// ── startResearch ────────────────────────────────────────────────────────────

describe("ResearchService.startResearch", () => {
  it("returns success=false when prereq is missing", () => {
    const result = ResearchService.startResearch(TECH_IDS.ADVANCED_HAB, 999, []);
    expect(result.success).toBe(false);
    expect(result.newResearchPoints).toBe(999); // unchanged
  });

  it("deducts RP and adds tech to unlocked list on success", () => {
    const result = ResearchService.startResearch(
      TECH_IDS.ADVANCED_HAB, // costs 30 RP
      100,
      [TECH_IDS.BASIC_STRUCTURES]
    );
    expect(result.success).toBe(true);
    expect(result.rpCost).toBe(30);
    expect(result.newResearchPoints).toBe(70);
    expect(result.newUnlockedTechs).toContain(TECH_IDS.ADVANCED_HAB);
    expect(result.newUnlockedTechs).toContain(TECH_IDS.BASIC_STRUCTURES);
  });

  it("does not mutate the original unlockedTechs array", () => {
    const original = [TECH_IDS.BASIC_STRUCTURES];
    ResearchService.startResearch(TECH_IDS.ADVANCED_HAB, 100, original);
    expect(original).toHaveLength(1); // unmodified
  });
});

// ── isBuildingUnlocked ───────────────────────────────────────────────────────

describe("ResearchService.isBuildingUnlocked", () => {
  it("returns true for buildings without requiredTech", () => {
    // 'hab' has no requiredTech
    expect(ResearchService.isBuildingUnlocked("hab", BUILDING_DEFINITIONS, [])).toBe(true);
  });

  it("returns false for buildings with requiredTech that is not unlocked", () => {
    // 'greenhouse' requires 'advanced_hab'
    expect(
      ResearchService.isBuildingUnlocked("greenhouse", BUILDING_DEFINITIONS, [TECH_IDS.BASIC_STRUCTURES])
    ).toBe(false);
  });

  it("returns true for buildings with requiredTech that IS unlocked", () => {
    expect(
      ResearchService.isBuildingUnlocked(
        "greenhouse",
        BUILDING_DEFINITIONS,
        [TECH_IDS.BASIC_STRUCTURES, TECH_IDS.ADVANCED_HAB]
      )
    ).toBe(true);
  });

  it("returns false for unknown building ID", () => {
    expect(ResearchService.isBuildingUnlocked("nonexistent", BUILDING_DEFINITIONS, [])).toBe(false);
  });
});

// ── getUnlockedBuildingIds ───────────────────────────────────────────────────

describe("ResearchService.getUnlockedBuildingIds", () => {
  it("returns buildings from basic_structures when only that is unlocked", () => {
    const ids = ResearchService.getUnlockedBuildingIds([TECH_IDS.BASIC_STRUCTURES]);
    expect(ids.has("hab")).toBe(true);
    expect(ids.has("solar")).toBe(true);
    expect(ids.has("ice")).toBe(true);
    expect(ids.has("lab")).toBe(true);
    // Should not have advanced buildings
    expect(ids.has("rtg")).toBe(false);
    expect(ids.has("greenhouse")).toBe(false);
  });

  it("includes greenhouse when advanced_hab is unlocked", () => {
    const ids = ResearchService.getUnlockedBuildingIds([
      TECH_IDS.BASIC_STRUCTURES,
      TECH_IDS.ADVANCED_HAB,
    ]);
    expect(ids.has("greenhouse")).toBe(true);
  });
});
