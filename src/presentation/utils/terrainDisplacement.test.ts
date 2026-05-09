import { describe, it, expect } from "vitest";
import {
  heightFromDisplacementRaster,
  TERRAIN_DISPLACEMENT_SCALE,
} from "./terrainDisplacement";

const TERRAIN = { x: 100, z: 50 };

/** RGBA raster: row-major, R channel sampled for height. */
function rgbaRaster(width: number, height: number, fill: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("heightFromDisplacementRaster", () => {
  it("returns 0 when raster is null", () => {
    expect(heightFromDisplacementRaster(0, 0, TERRAIN, null)).toBe(0);
  });

  it("returns 0 when raster is empty", () => {
    expect(
      heightFromDisplacementRaster(0, 0, TERRAIN, { width: 0, height: 4, data: new Uint8ClampedArray(0) })
    ).toBe(0);
  });

  it("returns 0 for world position outside the terrain rectangle", () => {
    const raster = rgbaRaster(4, 4, () => 255);
    expect(heightFromDisplacementRaster(60, 0, TERRAIN, raster)).toBe(0);
    expect(heightFromDisplacementRaster(0, 30, TERRAIN, raster)).toBe(0);
  });

  it("samples the red channel at the center and applies displacement scale", () => {
    const w = 8;
    const h = 8;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const targetR = 200;

    const raster = rgbaRaster(w, h, (x, y) => (x === cx && y === cy ? targetR : 0));

    const y = heightFromDisplacementRaster(0, 0, TERRAIN, raster);
    expect(y).toBeCloseTo((targetR / 255) * TERRAIN_DISPLACEMENT_SCALE, 10);
  });

  it("respects a custom displacement scale override", () => {
    const raster = rgbaRaster(2, 2, () => 255);
    expect(heightFromDisplacementRaster(0, 0, TERRAIN, raster, 2)).toBeCloseTo(2, 10);
  });
});
