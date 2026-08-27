import { describe, it, expect } from "vitest";
import { getRangeRingConfig } from "./buildingRangeUtils";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";

describe("BuildingRangeRing config", () => {
  it("returns red color and correct radius for defense turrets", () => {
    const turret: PlacedBuilding = {
      id: "t1",
      definitionId: "turret",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };
    const config = getRangeRingConfig(turret, BUILDING_DEFINITIONS.turret);
    expect(config.color).toBe("#ef4444");
    expect(config.radius).toBe(4.0);
  });

  it("returns cyan color and extraction radius for mines and ice extractors", () => {
    const minerLvl1: PlacedBuilding = {
      id: "m1",
      definitionId: "miner",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };
    const configLvl1 = getRangeRingConfig(minerLvl1, BUILDING_DEFINITIONS.miner);
    expect(configLvl1.color).toBe("#00ffff");
    expect(configLvl1.radius).toBeGreaterThanOrEqual(3.5);

    const minerLvl3: PlacedBuilding = {
      id: "m1",
      definitionId: "miner",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 3,
    };
    const configLvl3 = getRangeRingConfig(minerLvl3, BUILDING_DEFINITIONS.miner);
    expect(configLvl3.color).toBe("#00ffff");
    expect(configLvl3.radius).toBeGreaterThan(configLvl1.radius);
  });

  it("returns green color for living modules and greenhouses", () => {
    const hab: PlacedBuilding = {
      id: "h1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };
    const habConfig = getRangeRingConfig(hab, BUILDING_DEFINITIONS.hab);
    expect(habConfig.color).toBe("#00ff88");

    const greenhouse: PlacedBuilding = {
      id: "g1",
      definitionId: "greenhouse",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };
    const ghConfig = getRangeRingConfig(greenhouse, BUILDING_DEFINITIONS.greenhouse);
    expect(ghConfig.color).toBe("#00ff88");
  });
});
