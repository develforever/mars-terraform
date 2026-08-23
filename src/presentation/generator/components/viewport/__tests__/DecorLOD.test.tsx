import { describe, it, expect } from "vitest";
import {
  POI_MODEL_PATHS,
  POI_LOD_MODEL_PATHS,
  getLOD1Path,
  DECOR_MODELS,
} from "../decorConstants";

describe("Decor & POI Distance-based LOD", () => {
  it("should have matching LOD1 paths for all POI models", () => {
    for (const key of Object.keys(POI_MODEL_PATHS)) {
      expect(POI_LOD_MODEL_PATHS[key], `LOD1 path for POI ${key} should exist`).toBeDefined();
      expect(POI_LOD_MODEL_PATHS[key]).toBe(`/models/mars/${key}_lod1.glb`);
    }
  });

  it("should resolve LOD1 paths correctly via getLOD1Path", () => {
    expect(getLOD1Path("poi_abandoned_lab")).toBe("/models/mars/poi_abandoned_lab_lod1.glb");
    expect(getLOD1Path("poi_alien_hive")).toBe("/models/mars/poi_alien_hive_lod1.glb");
    expect(getLOD1Path("poi_crashed_freighter")).toBe("/models/mars/poi_crashed_freighter_lod1.glb");
  });

  it("should generate _lod1.glb path for arbitrary .glb model paths", () => {
    expect(getLOD1Path("/models/mars/rock_crystalsLargeA.glb")).toBe(
      "/models/mars/rock_crystalsLargeA_lod1.glb"
    );
    expect(getLOD1Path("/models/mars/turret_double.glb")).toBe(
      "/models/mars/turret_double_lod1.glb"
    );
  });

  it("should avoid double suffixing for paths already ending in _lod1.glb", () => {
    expect(getLOD1Path("/models/mars/rock_crystalsLargeA_lod1.glb")).toBeNull();
  });

  it("should return null for non-glb procedural decor keys", () => {
    expect(getLOD1Path("rock_01")).toBeNull();
    expect(getLOD1Path("rocks")).toBeNull();
    expect(getLOD1Path("boulder")).toBeNull();
    expect(getLOD1Path("crystal")).toBeNull();
    expect(getLOD1Path("wreck")).toBeNull();
  });

  it("should ensure all POIs are cataloged in DECOR_MODELS", () => {
    const decorKeys = new Set(DECOR_MODELS.map((d) => d.model));
    expect(decorKeys.has("poi_abandoned_lab")).toBe(true);
    expect(decorKeys.has("poi_alien_hive")).toBe(true);
    expect(decorKeys.has("poi_crashed_freighter")).toBe(true);
  });
});
