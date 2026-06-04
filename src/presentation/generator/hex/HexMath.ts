/**
 * HexMath.ts
 * Pure math for flat-top hexagonal grids.
 * Based on: https://www.redblobgames.com/grids/hexagons/
 *
 * Orientation: FLAT-TOP
 * Coordinate system: AXIAL (q, r)
 * Constraint: s = -q - r (cube coords, not stored)
 */

// ─── Flat-top hex geometry ────────────────────────────────────────────────────

export const HEX_SIZE = 1.2 // world units, center to corner

// Flat-top hex width and height
export const HEX_WIDTH = HEX_SIZE * 2          // 2.4
export const HEX_HEIGHT = HEX_SIZE * Math.SQRT2 // approx — actually sqrt(3)*size
export const HEX_HORIZ_SPACING = HEX_SIZE * 1.5 // 1.8 — x distance between hex centers
export const HEX_VERT_SPACING = HEX_SIZE * Math.sqrt(3) // z distance between hex centers

// ─── Axial ↔ World (pixel) conversion ────────────────────────────────────────

/**
 * Convert axial hex coordinates to world (x, z) position.
 * Flat-top orientation.
 */
export function hexToWorld(q: number, r: number): [number, number] {
  const x = HEX_SIZE * (3 / 2) * q
  const z = HEX_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r)
  return [x, z]
}

/**
 * Convert world (x, z) to fractional axial hex coordinates.
 * Apply hexRound() to get the nearest hex.
 */
export function worldToHexFrac(x: number, z: number): [number, number] {
  const q = ((2 / 3) * x) / HEX_SIZE
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * z) / HEX_SIZE
  return [q, r]
}

// ─── Cube rounding ────────────────────────────────────────────────────────────

/**
 * Round fractional cube coordinates to nearest hex.
 * Works in cube (x,y,z) space then converts back to axial.
 */
export function hexRound(q: number, r: number): [number, number] {
  const s = -q - r

  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)

  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)

  // Reset the largest error to maintain q + r + s = 0
  if (dq > dr && dq > ds) {
    rq = -rr - rs
  } else if (dr > ds) {
    rr = -rq - rs
  }
  // rs not stored

  return [rq, rr]
}

/**
 * Convert world (x, z) to the nearest axial hex coordinate.
 */
export function worldToHex(x: number, z: number): [number, number] {
  const [fq, fr] = worldToHexFrac(x, z)
  return hexRound(fq, fr)
}

// ─── Key ─────────────────────────────────────────────────────────────────────

/** Unique string key for a hex — used in Map<string, HexCell> */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

/** Parse hex key back to [q, r] */
export function hexFromKey(key: string): [number, number] {
  const [q, r] = key.split(',').map(Number)
  return [q, r]
}

// ─── Neighbors ───────────────────────────────────────────────────────────────

// Flat-top axial direction vectors (6 neighbors)
const HEX_DIRECTIONS: [number, number][] = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
]

/** Return the 6 axial neighbor coordinates of a hex */
export function hexNeighbors(q: number, r: number): [number, number][] {
  return HEX_DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr] as [number, number])
}

/** Return all hexes within ring of given radius (not including center) */
export function hexRing(centerQ: number, centerR: number, radius: number): [number, number][] {
  if (radius === 0) return [[centerQ, centerR]]
  const results: [number, number][] = []

  // Start at one corner and walk around the ring
  let q = centerQ + HEX_DIRECTIONS[4][0] * radius
  let r = centerR + HEX_DIRECTIONS[4][1] * radius

  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push([q, r])
      q += HEX_DIRECTIONS[side][0]
      r += HEX_DIRECTIONS[side][1]
    }
  }
  return results
}

/** Return all hexes within radius (including center) */
export function hexesInRadius(centerQ: number, centerR: number, radius: number): [number, number][] {
  const results: [number, number][] = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) {
      results.push([centerQ + q, centerR + r])
    }
  }
  return results
}

/** Return all hexes in the entire map (circle of given radius from origin) */
export function allMapHexes(mapRadius: number): [number, number][] {
  return hexesInRadius(0, 0, mapRadius)
}

// ─── Distance ─────────────────────────────────────────────────────────────────

/** Axial hex distance (cube distance) */
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q2 - q1
  const dr = r2 - r1
  const ds = -dq - dr
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
}

// ─── Corner positions ─────────────────────────────────────────────────────────

/**
 * Return the 6 corner world positions of a flat-top hex centered at (cx, cz).
 * Returns array of [x, z] pairs.
 */
export function hexCorners(cx: number, cz: number, size = HEX_SIZE): [number, number][] {
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i // flat-top: start at 0°
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push([
      cx + size * Math.cos(angleRad),
      cz + size * Math.sin(angleRad),
    ])
  }
  return corners
}

// ─── Brush helpers ────────────────────────────────────────────────────────────

/**
 * Return brush hex coords for given center and brush size.
 * size=1 → just center
 * size=3 → center + ring 1 (7 hexes)
 * size=5 → center + rings 1+2 (19 hexes)
 */
export function hexBrush(q: number, r: number, brushSize: 1 | 3 | 5): [number, number][] {
  const ringRadius = brushSize === 1 ? 0 : brushSize === 3 ? 1 : 2
  return hexesInRadius(q, r, ringRadius)
}
