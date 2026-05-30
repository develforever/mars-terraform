import { describe, it, expect } from "vitest";
import { ResourceBreakdownService } from "./ResourceBreakdownService";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import type { PlacedBuilding } from "../entities/Building";

describe("ResourceBreakdownService", () => {
  it("should show solar panel as power producer during day", () => {
    const placed: PlacedBuilding[] = [
      { id: "solar-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100 },
    ];
    const breakdown = ResourceBreakdownService.getBreakdown(
      "power",
      placed,
      BUILDING_DEFINITIONS,
      1.0, // sunFactor = 1 (full day)
      1.0  // productionModifier = 1 (no weather penalty)
    );
    expect(breakdown.producers.length).toBe(1);
    expect(breakdown.producers[0].value).toBe(0.5);
  });

  it("should show two solar panels as power producers", () => {
    const placed: PlacedBuilding[] = [
      { id: "solar-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100 },
      { id: "solar-2", definitionId: "solar", position: { x: 1, y: 0, z: 0 }, condition: 100 },
    ];
    const breakdown = ResourceBreakdownService.getBreakdown(
      "power",
      placed,
      BUILDING_DEFINITIONS,
      1.0,
      1.0
    );
    expect(breakdown.producers.length).toBe(2);
    expect(breakdown.producers[0].value).toBe(0.5);
    expect(breakdown.producers[1].value).toBe(0.5);
    expect(breakdown.net).toBe(1.0);
  });

  it("should show solar panels as idle producers at night (sunFactor=0)", () => {
    const placed: PlacedBuilding[] = [
      { id: "solar-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100 },
    ];
    const breakdown = ResourceBreakdownService.getBreakdown(
      "power",
      placed,
      BUILDING_DEFINITIONS,
      0.0, // night
      1.0
    );
    expect(breakdown.producers.length).toBe(1);
    expect(breakdown.producers[0].value).toBe(0);
    expect(breakdown.net).toBe(0);
  });
});
