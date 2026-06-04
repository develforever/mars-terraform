/**
 * HexGeometry.ts
 * Builds a merged THREE.BufferGeometry for the entire hex terrain.
 * Uses vertex colors — no textures needed.
 * Flat-top hexagons with column height based on terrain type.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, HEX_SIZE } from './HexMath'
import { TERRAIN_COLORS, type HexCell } from './HexGrid'

// ─── Single hex geometry (for InstancedMesh) ──────────────────────────────────

/**
 * Creates a flat-top hex geometry centered at origin, suitable for InstancedMesh.
 * No vertex colors — colors set per-instance via instanceColor.
 */
export function createFlatHexGeometry(size: number = HEX_SIZE): THREE.BufferGeometry {
  const corners = hexCorners(0, 0, size)
  const positions: number[] = [0, 0, 0] // center
  const indices: number[] = []

  for (const [x, z] of corners) positions.push(x, 0, z)

  for (let i = 0; i < 6; i++) {
    indices.push(0, 1 + ((i + 1) % 6), 1 + i)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ─── Brush highlight geometry ──────────────────────────────────────────────────

/**
 * Merges flat hex polygons for the hover/brush highlight.
 * Used by HexInteraction to show which hexes will be affected.
 */
/**
 * Each entry: [q, r, y] where y is the world Y to place the highlight at.
 */
export function buildBrushHighlightGeometry(
  hexCoords: [number, number, number][],
  scale = 0.94,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  let baseIndex = 0

  for (const [q, r, y] of hexCoords) {
    const [cx, cz] = hexToWorld(q, r)
    const corners = hexCorners(cx, cz, HEX_SIZE * scale)

    positions.push(cx, y, cz)
    for (const [x, z] of corners) positions.push(x, y, z)

    for (let i = 0; i < 6; i++) {
      indices.push(baseIndex, baseIndex + 1 + ((i + 1) % 6), baseIndex + 1 + i)
    }
    baseIndex += 7
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  return geo
}

// ─── Single hex top face (triangle fan from center) ───────────────────────────

/**
 * Adds the top face of a hex to the buffer arrays.
 * 6 triangles, center + 6 corners, all at worldY height.
 */
function addHexTop(
  positions: number[],
  colors: number[],
  indices: number[],
  baseIndex: number,
  cx: number,
  cz: number,
  worldY: number,
  color: [number, number, number],
): number {
  const corners = hexCorners(cx, cz, HEX_SIZE)
  const [r, g, b] = color

  // Center vertex (index 0)
  positions.push(cx, worldY, cz)
  colors.push(r, g, b)

  // 6 corner vertices (indices 1..6)
  for (const [x, z] of corners) {
    positions.push(x, worldY, z)
    colors.push(r, g, b)
  }

  // 6 triangles: center + consecutive corners
  for (let i = 0; i < 6; i++) {
    const a = baseIndex           // center
    const b2 = baseIndex + 1 + i  // corner i
    const c = baseIndex + 1 + ((i + 1) % 6) // corner i+1
    // up normal
    indices.push(a, c, b2)
  }

  // 7 vertices added (center + 6 corners)
  return 7
}

// ─── Build full terrain geometry (legacy — used by tests) ─────────────────────

/**
 * Builds a merged BufferGeometry with vertex colors for all hex cells.
 * Kept for backward compatibility with tests.
 * Production rendering uses HexTerrain InstancedMesh instead.
 */
export function buildHexTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  let baseIndex = 0

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const worldY = cell.worldY
    const color = TERRAIN_COLORS[cell.terrainType]
    baseIndex += addHexTop(positions, colors, indices, baseIndex, cx, cz, worldY, color)
  }

  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

// ─── Build wireframe edge geometry ────────────────────────────────────────────

/**
 * Builds a LineSegments geometry showing hex grid edges.
 * Used for the grid overlay toggle.
 */
export function buildHexEdgesGeometry(cells: HexCell[]): THREE.BufferGeometry {
  const positions: number[] = []

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const worldY = cell.worldY + 0.05 // slightly above terrain
    const corners = hexCorners(cx, cz, HEX_SIZE)

    for (let i = 0; i < 6; i++) {
      const [x0, z0] = corners[i]
      const [x1, z1] = corners[(i + 1) % 6]
      positions.push(x0, worldY, z0)
      positions.push(x1, worldY, z1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

// ─── Build single hex highlight geometry ─────────────────────────────────────

/**
 * Builds a flat hex polygon geometry for hover/selection highlight.
 * Positioned slightly above terrain surface.
 */
export function buildHexHighlightGeometry(
  q: number,
  r: number,
  worldY: number,
  scale = 0.92,
): THREE.BufferGeometry {
  const [cx, cz] = hexToWorld(q, r)
  const corners = hexCorners(cx, cz, HEX_SIZE * scale)
  const y = worldY + 0.08

  const positions: number[] = []
  const indices: number[] = []

  // Center
  positions.push(cx, y, cz)
  for (const [x, z] of corners) positions.push(x, y, z)

  for (let i = 0; i < 6; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % 6))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

// ─── Build overlay geometry for painted hexes ─────────────────────────────────

/**
 * Builds instanced data for painted hex overlay.
 * Returns positions and colors for each painted cell.
 * Used by HexOverlay component with InstancedMesh.
 */
export function buildHexOverlayData(cells: HexCell[]): {
  positions: [number, number, number][]
  colors: [number, number, number][]
} {
  const USER_COLORS: Record<string, [number, number, number]> = {
    build:    [0.0,  1.0,  0.53],  // #00ff88
    resource: [1.0,  0.8,  0.0],   // #ffcc00
    blocked:  [1.0,  0.2,  0.0],   // #ff3300
    spawn:    [0.0,  0.53, 1.0],   // #0088ff
  }

  const positions: [number, number, number][] = []
  const colors: [number, number, number][] = []

  for (const cell of cells) {
    if (!cell.userType || cell.userType === 'empty') continue
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    positions.push([cx, cell.worldY + 0.06, cz])
    colors.push(USER_COLORS[cell.userType] ?? [1, 1, 1])
  }

  return { positions, colors }
}
