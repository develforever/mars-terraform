/**
 * TerrainMeshBuilder.ts
 *
 * Buduje unified BufferGeometry z "Dual Topology":
 *
 *   RAMPA  (diff ≤ RAMP_THRESHOLD):
 *     Narożniki sąsiadujących hexów są WSPÓŁDZIELONE (averaged Y).
 *     → Łagodne przejście, naturalne zbocze.
 *
 *   KLIF   (diff > RAMP_THRESHOLD):
 *     Każdy hex dostaje WŁASNY wierzchołek narożnika na swojej wysokości.
 *     → Płaskie plateau z ostrą krawędzią. CliffBuilder wypełnia pionową lukę.
 *
 * Kryterium: zakres worldY wśród wszystkich hexów dzielących dany narożnik.
 * Jeśli range ≤ RAMP_THRESHOLD → ramp (shared); w przeciwnym razie → cliff (per-hex).
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexKey, HEX_SIZE } from '../hex/HexMath'
import { TERRAIN_COLORS, type HexCell } from '../hex/HexGrid'

// ─── Progi ────────────────────────────────────────────────────────────────────

/**
 * Maksymalna różnica worldY między sąsiednimi hexami dozwolona dla rampy.
 * Powyżej → klif (per-hex vertices, płaskie plateau).
 * 1.4 ≈ przejście o 1.5–2 poziomy (np. plains↔rocky).
 */
export const RAMP_THRESHOLD = 1.4

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ck(x: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(z * 1000)}`
}

// ─── buildSmoothTerrainGeometry ───────────────────────────────────────────────

export function buildSmoothTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {

  // ── Przejście 1: zbierz dane narożników (heightY + kolor per hex) ─────────

  interface CornerData {
    x: number
    z: number
    hexes: Array<{ worldY: number; r: number; g: number; b: number }>
  }

  const cornerData = new Map<string, CornerData>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]

    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      const key = ck(x, z)
      const entry = cornerData.get(key)
      if (entry) {
        entry.hexes.push({ worldY: cell.worldY, r, g, b })
      } else {
        cornerData.set(key, { x, z, hexes: [{ worldY: cell.worldY, r, g, b }] })
      }
    }
  }

  // ── Przejście 2: klasyfikuj narożniki (ramp vs cliff) ─────────────────────

  const cliffCorners = new Set<string>()

  for (const [key, data] of cornerData) {
    const ys = data.hexes.map(h => h.worldY)
    const range = Math.max(...ys) - Math.min(...ys)
    if (range > RAMP_THRESHOLD) cliffCorners.add(key)
  }

  // ── Przejście 3: wierzchołki dla narożników RAMP (shared) ────────────────

  const posArr: number[] = []
  const colArr: number[] = []
  const idxArr: number[] = []

  const sharedVIdx = new Map<string, number>() // cornerKey → vertex index

  for (const [key, data] of cornerData) {
    if (cliffCorners.has(key)) continue // klif: wierzchołek per-hex (poniżej)

    const n    = data.hexes.length
    const avgY = data.hexes.reduce((a, h) => a + h.worldY, 0) / n
    const avgR = data.hexes.reduce((a, h) => a + h.r, 0) / n
    const avgG = data.hexes.reduce((a, h) => a + h.g, 0) / n
    const avgB = data.hexes.reduce((a, h) => a + h.b, 0) / n

    sharedVIdx.set(key, posArr.length / 3)
    posArr.push(data.x, avgY, data.z)
    colArr.push(avgR, avgG, avgB)
  }

  // ── Przejście 4: per-hex — centrum + trójkąty ────────────────────────────

  // Dla narożników klifu: jeden wierzchołek per hex (cached per hex+corner)
  const cliffVIdx = new Map<string, number>() // "hexKey_cornerKey" → vertex index

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const corners  = hexCorners(cx, cz, HEX_SIZE)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]
    const hk = hexKey(cell.q, cell.r)

    // Centrum hexa — zawsze na pełnej wysokości
    const centerIdx = posArr.length / 3
    posArr.push(cx, cell.worldY, cz)
    colArr.push(r, g, b)

    // 6 trójkątów (fan)
    for (let i = 0; i < 6; i++) {
      const [x0, z0] = corners[i]
      const [x1, z1] = corners[(i + 1) % 6]
      const k0 = ck(x0, z0)
      const k1 = ck(x1, z1)

      const vi0 = resolveCornerVertex(k0, x0, z0, cell.worldY, r, g, b, hk, sharedVIdx, cliffVIdx, posArr, colArr)
      const vi1 = resolveCornerVertex(k1, x1, z1, cell.worldY, r, g, b, hk, sharedVIdx, cliffVIdx, posArr, colArr)

      // CCW winding → normal UP (+Y)
      idxArr.push(centerIdx, vi1, vi0)
    }
  }

  // ── Złóż geometrię ────────────────────────────────────────────────────────

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colArr, 3))
  geo.setIndex(idxArr)
  geo.computeVertexNormals()

  return geo
}

// ─── Helper: lookup or create corner vertex ───────────────────────────────────

function resolveCornerVertex(
  cornerKey: string,
  x: number, z: number,
  worldY: number,
  r: number, g: number, b: number,
  hexCacheKey: string,
  sharedVIdx: Map<string, number>,
  cliffVIdx: Map<string, number>,
  posArr: number[],
  colArr: number[],
): number {
  // Ramp corner → shared vertex
  const shared = sharedVIdx.get(cornerKey)
  if (shared !== undefined) return shared

  // Cliff corner → per-hex vertex (jeden na hex, reużywany wewnątrz tego hexa)
  const cliffKey = hexCacheKey + '_' + cornerKey
  const existing = cliffVIdx.get(cliffKey)
  if (existing !== undefined) return existing

  const idx = posArr.length / 3
  posArr.push(x, worldY, z)
  colArr.push(r, g, b)
  cliffVIdx.set(cliffKey, idx)
  return idx
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

export interface TerrainMeshStats {
  vertexCount:   number
  triangleCount: number
  sharedCorners: number
  cliffCorners:  number
  hexCount:      number
}

export function getTerrainMeshStats(cells: HexCell[]): TerrainMeshStats {
  const cornerData = new Map<string, number[]>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      const key = ck(x, z)
      const existing = cornerData.get(key)
      if (existing) existing.push(cell.worldY)
      else cornerData.set(key, [cell.worldY])
    }
  }

  let sharedCorners = 0
  let cliffCorners  = 0
  for (const ys of cornerData.values()) {
    const range = Math.max(...ys) - Math.min(...ys)
    if (range <= RAMP_THRESHOLD) sharedCorners++
    else cliffCorners++
  }

  const vertexCount   = sharedCorners + cells.length * (1 + cliffCorners / cells.length)
  const triangleCount = cells.length * 6

  return {
    vertexCount: Math.round(vertexCount),
    triangleCount,
    sharedCorners,
    cliffCorners,
    hexCount: cells.length,
  }
}
