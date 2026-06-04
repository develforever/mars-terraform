/**
 * HexGeometry.ts
 * Builds a merged THREE.BufferGeometry for the entire hex terrain.
 * Uses vertex colors — no textures needed.
 * Flat-top hexagons with column height based on terrain type.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexKey, hexNeighbors, HEX_SIZE } from './HexMath'
import { TERRAIN_COLORS, type HexCell } from './HexGrid'

// ─── Config ───────────────────────────────────────────────────────────────────

const EDGE_DEPTH = 0.8
const HEIGHT_EPSILON = 0.001

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

// ─── Single hex side face ─────────────────────────────────────────────────────

function addHexSide(
  positions: number[],
  colors: number[],
  indices: number[],
  baseIndex: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  topY: number,
  bottomY: number,
  color: [number, number, number],
): number {
  const [r, g, b] = color

  const sr = r * 0.55
  const sg = g * 0.55
  const sb = b * 0.55

  const tl = baseIndex
  positions.push(x0, topY, z0); colors.push(sr, sg, sb)
  const tr = baseIndex + 1
  positions.push(x1, topY, z1); colors.push(sr, sg, sb)
  const br = baseIndex + 2
  positions.push(x1, bottomY, z1); colors.push(sr, sg, sb)
  const bl = baseIndex + 3
  positions.push(x0, bottomY, z0); colors.push(sr, sg, sb)

  indices.push(tl, tr, br)
  indices.push(tl, br, bl)

  return 4
}

// ─── Build full terrain geometry ──────────────────────────────────────────────

/**
 * Builds a single merged BufferGeometry for all hex cells.
 * Each cell contributes one top face and only visible lower side faces.
 * Rendered in 1 draw call.
 */
export function buildHexTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const cellMap = new Map(cells.map(cell => [hexKey(cell.q, cell.r), cell]))

  let baseIndex = 0

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const worldY = cell.worldY
    const color = TERRAIN_COLORS[cell.terrainType]

    baseIndex += addHexTop(positions, colors, indices, baseIndex, cx, cz, worldY, color)

    const corners = hexCorners(cx, cz, HEX_SIZE)
    const neighbors = hexNeighbors(cell.q, cell.r)

    for (let i = 0; i < 6; i++) {
      const neighbor = cellMap.get(hexKey(neighbors[i][0], neighbors[i][1]))
      const bottomY = neighbor ? neighbor.worldY : Math.max(0, worldY - EDGE_DEPTH)
      if (bottomY >= worldY - HEIGHT_EPSILON) continue

      //const [x0, z0] = corners[i]
      //const [x1, z1] = corners[(i + 1) % 6]
      //baseIndex += addHexSide(positions, colors, indices, baseIndex, x0, z0, x1, z1, worldY, bottomY, color)
    }
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
