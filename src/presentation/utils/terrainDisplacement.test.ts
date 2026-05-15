import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Texture } from "three";
import {
  heightFromDisplacement,
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

describe("heightFromDisplacement (THREE.Texture)", () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement, contextId: string) {
        if (contextId !== "2d") return null;
        const w = Math.max(this.width | 0, 1);
        const h = Math.max(this.height | 0, 1);
        const { width, height, data } = rgbaRaster(w, h, () => 255);

        const ctx = {
          drawImage: vi.fn(),
          getImageData: () =>
            ({
              width,
              height,
              data,
              colorSpace: "srgb",
            }),
        };

        return ctx as unknown as CanvasRenderingContext2D;
      }
    );
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it("decodes displacement via canvas helpers and samples like the raster path", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const tex = new Texture(canvas);

    expect(heightFromDisplacement(0, 0, TERRAIN, tex)).toBeCloseTo(TERRAIN_DISPLACEMENT_SCALE, 10);
  });

  it("matches known red channel height at terrain center (Texture path)", () => {
    const w = 8;
    const h = 8;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const targetR = 200;

    getContextSpy.mockRestore();
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement, contextId: string) {
        if (contextId !== "2d") return null;
        const rw = Math.max(this.width | 0, 1);
        const rh = Math.max(this.height | 0, 1);
        const { width, height, data } = rgbaRaster(rw, rh, (x, y) =>
          x === cx && y === cy ? targetR : 0
        );

        return {
          drawImage: vi.fn(),
          getImageData: () =>
            ({
              width,
              height,
              data,
              colorSpace: "srgb",
            }),
        } as unknown as CanvasRenderingContext2D;
      }
    );

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const tex = new Texture(canvas);

    expect(heightFromDisplacement(0, 0, TERRAIN, tex)).toBeCloseTo(
      (targetR / 255) * TERRAIN_DISPLACEMENT_SCALE,
      10
    );
  });
});
