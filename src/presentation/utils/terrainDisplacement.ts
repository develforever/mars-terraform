import type { Texture } from "three";

/** Must match `<meshStandardMaterial displacementScale>` on MarsTerrain. */
export const TERRAIN_DISPLACEMENT_SCALE = 1.2;

type ChannelData = { width: number; height: number; data: Uint8ClampedArray };

const cache = new WeakMap<Texture, ChannelData>();

/**
 * Sample displacement height from RGBA raster (red channel only), matching `getImageData` layout.
 */
export function heightFromDisplacementRaster(
  worldX: number,
  worldZ: number,
  terrainSize: { x: number; z: number },
  raster: ChannelData | null,
  displacementScale: number = TERRAIN_DISPLACEMENT_SCALE
): number {
  if (!raster?.data?.length || raster.width <= 0 || raster.height <= 0) return 0;

  const halfW = terrainSize.x / 2;
  const halfD = terrainSize.z / 2;
  const lx = worldX;
  const ly = -worldZ;
  if (lx < -halfW || lx > halfW || ly < -halfD || ly > halfD) return 0;

  const u = (lx + halfW) / terrainSize.x;
  const v = (ly + halfD) / terrainSize.z;

  const px = Math.min(raster.width - 1, Math.max(0, Math.floor(u * raster.width)));
  const py = Math.min(raster.height - 1, Math.max(0, Math.floor(v * raster.height)));
  const idx = (py * raster.width + px) * 4;
  const sample = raster.data[idx]! / 255;
  return sample * displacementScale;
}

function getImageChannelData(texture: Texture): ChannelData | null {
  const cached = cache.get(texture);
  if (cached) return cached;

  const image = texture.image as HTMLImageElement | ImageBitmap | OffscreenCanvas | undefined;
  if (!image || !("width" in image) || !(image.width > 0)) return null;

  const width = image.width;
  const height = image.height;
  if (typeof document === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const entry: ChannelData = { width, height, data: imageData.data };
    cache.set(texture, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * World Y from displacement map (matches MarsTerrain meshStandardMaterial settings).
 * Mesh: plane in XZ after rotation-x = -π/2; local (lx, ly, 0) → world (lx, 0, -ly).
 */
export function heightFromDisplacement(
  worldX: number,
  worldZ: number,
  terrainSize: { x: number; z: number },
  displacementMap: Texture | null,
  displacementScale: number = TERRAIN_DISPLACEMENT_SCALE
): number {
  if (!displacementMap?.image) return 0;
  const img = displacementMap.image as { width: number; height: number };
  if (!img.width || !img.height) return 0;

  const halfW = terrainSize.x / 2;
  const halfD = terrainSize.z / 2;
  const lx = worldX;
  const ly = -worldZ;
  if (lx < -halfW || lx > halfW || ly < -halfD || ly > halfD) return 0;

  const raster = getImageChannelData(displacementMap);
  return heightFromDisplacementRaster(
    worldX,
    worldZ,
    terrainSize,
    raster,
    displacementScale
  );
}
