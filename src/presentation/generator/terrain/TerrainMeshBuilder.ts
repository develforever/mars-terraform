/**
 * TerrainMeshBuilder.ts
 *
 * Buduje unified BufferGeometry z "Dual Topology" + atrybuty blend tekstur.
 *
 *   RAMPA  (diff ≤ RAMP_THRESHOLD): narożniki shared, averaged Y + blend weights
 *   KLIF   (diff > RAMP_THRESHOLD): per-hex vertices, płaskie plateau
 *
 * Atrybuty wierzchołka:
 *   position   (3) — XYZ
 *   color      (3) — vertex color fallback
 *   terrainIdx (3) — indeksy do DataArrayTexture (do 3 warstw)
 *   terrainWgt (3) — wagi blendowania (suma = 1.0)
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexKey, HEX_SIZE } from '../hex/HexMath'
import { TERRAIN_COLORS, type HexCell } from '../hex/HexGrid'
import { TERRAIN_TEX_INDEX } from './TerrainTextureLoader'

// ─── Progi ────────────────────────────────────────────────────────────────────

export const RAMP_THRESHOLD = 1.4

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ck(x: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(z * 1000)}`
}

// Oblicz do 3 unikalnych indeksów + wagi z listy typów terrainowych
function computeBlend(
  terrainTypes: string[],
): { indices: [number, number, number]; weights: [number, number, number] } {
  const counts: Record<number, number> = {}
  for (const t of terrainTypes) {
    const idx = TERRAIN_TEX_INDEX[t] ?? 2
    counts[idx] = (counts[idx] ?? 0) + 1
  }
  const total = terrainTypes.length
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const indices: [number, number, number] = [0, 0, 0]
  const weights: [number, number, number] = [0, 0, 0]
  let wSum = 0
  for (let i = 0; i < sorted.length; i++) {
    indices[i] = Number(sorted[i][0])
    weights[i] = sorted[i][1] / total
    wSum += weights[i]
  }
  // Normalize
  if (wSum > 0) for (let i = 0; i < 3; i++) weights[i] /= wSum
  else weights[0] = 1.0

  return { indices, weights }
}

// ─── buildSmoothTerrainGeometry ───────────────────────────────────────────────

export function buildSmoothTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {

  // ── Pass 1: zbierz dane narożników ──────────────────────────────────────

  interface CornerData {
    x: number
    z: number
    hexes: Array<{ worldY: number; r: number; g: number; b: number; terrainType: string }>
  }

  const cornerData = new Map<string, CornerData>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]

    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      const key = ck(x, z)
      const entry = cornerData.get(key)
      if (entry) {
        entry.hexes.push({ worldY: cell.worldY, r, g, b, terrainType: cell.terrainType })
      } else {
        cornerData.set(key, { x, z, hexes: [{ worldY: cell.worldY, r, g, b, terrainType: cell.terrainType }] })
      }
    }
  }

  // ── Pass 2: klasyfikuj narożniki (ramp vs cliff) ─────────────────────────

  const cliffCorners = new Set<string>()

  for (const [key, data] of cornerData) {
    const ys = data.hexes.map(h => h.worldY)
    const range = Math.max(...ys) - Math.min(...ys)
    if (range > RAMP_THRESHOLD) cliffCorners.add(key)
  }

  // ── Pass 3: wierzchołki RAMP (shared, blended) ────────────────────────────

  const posArr: number[] = []
  const colArr: number[] = []
  const tidxArr: number[] = []   // terrainIdx (3 floats)
  const twgtArr: number[] = []   // terrainWgt (3 floats)
  const triArr: number[] = []    // triangle indices

  const sharedVIdx = new Map<string, number>()

  for (const [key, data] of cornerData) {
    if (cliffCorners.has(key)) continue

    const n = data.hexes.length
    const avgY = data.hexes.reduce((a, h) => a + h.worldY, 0) / n
    const avgR = data.hexes.reduce((a, h) => a + h.r, 0) / n
    const avgG = data.hexes.reduce((a, h) => a + h.g, 0) / n
    const avgB = data.hexes.reduce((a, h) => a + h.b, 0) / n

    // Blend tekstur z sąsiadujących hexów
    const { indices, weights } = computeBlend(data.hexes.map(h => h.terrainType))

    sharedVIdx.set(key, posArr.length / 3)
    posArr.push(data.x, avgY, data.z)
    colArr.push(avgR, avgG, avgB)
    tidxArr.push(...indices)
    twgtArr.push(...weights)
  }

  // ── Pass 4: per-hex — centrum + triangles ────────────────────────────────

  const cliffVIdx = new Map<string, number>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]
    const hk        = hexKey(cell.q, cell.r)
    const texIdx    = TERRAIN_TEX_INDEX[cell.terrainType] ?? 2

    // Centrum: jedna tekstura, waga = 1.0
    const centerIdx = posArr.length / 3
    posArr.push(cx, cell.worldY, cz)
    colArr.push(r, g, b)
    tidxArr.push(texIdx, 0, 0)
    twgtArr.push(1.0, 0.0, 0.0)

    for (let i = 0; i < 6; i++) {
      const [x0, z0] = corners[i]
      const [x1, z1] = corners[(i + 1) % 6]
      const k0 = ck(x0, z0)
      const k1 = ck(x1, z1)

      const vi0 = resolveCornerVertex(
        k0, x0, z0, cell.worldY, r, g, b, texIdx, hk,
        sharedVIdx, cliffVIdx, posArr, colArr, tidxArr, twgtArr,
      )
      const vi1 = resolveCornerVertex(
        k1, x1, z1, cell.worldY, r, g, b, texIdx, hk,
        sharedVIdx, cliffVIdx, posArr, colArr, tidxArr, twgtArr,
      )

      triArr.push(centerIdx, vi1, vi0)
    }
  }

  // ── Złóż geometrię ────────────────────────────────────────────────────────

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',    new THREE.Float32BufferAttribute(posArr,  3))
  geo.setAttribute('color',       new THREE.Float32BufferAttribute(colArr,  3))
  geo.setAttribute('terrainIdx',  new THREE.Float32BufferAttribute(tidxArr, 3))
  geo.setAttribute('terrainWgt',  new THREE.Float32BufferAttribute(twgtArr, 3))
  geo.setIndex(triArr)
  geo.computeVertexNormals()

  return geo
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function resolveCornerVertex(
  cornerKey: string,
  x: number, z: number,
  worldY: number,
  r: number, g: number, b: number,
  texIdx: number,
  hexCacheKey: string,
  sharedVIdx: Map<string, number>,
  cliffVIdx:  Map<string, number>,
  posArr:  number[],
  colArr:  number[],
  tidxArr: number[],
  twgtArr: number[],
): number {
  const shared = sharedVIdx.get(cornerKey)
  if (shared !== undefined) return shared

  const cliffKey = hexCacheKey + '_' + cornerKey
  const existing = cliffVIdx.get(cliffKey)
  if (existing !== undefined) return existing

  const idx = posArr.length / 3
  posArr.push(x, worldY, z)
  colArr.push(r, g, b)
  tidxArr.push(texIdx, 0, 0)
  twgtArr.push(1.0, 0.0, 0.0)
  cliffVIdx.set(cliffKey, idx)
  return idx
}

// ─── Stats ────────────────────────────────────────────────────────────────────

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
      const ex = cornerData.get(key)
      if (ex) ex.push(cell.worldY)
      else cornerData.set(key, [cell.worldY])
    }
  }

  let sharedCorners = 0, cliffCorners = 0
  for (const ys of cornerData.values()) {
    const range = Math.max(...ys) - Math.min(...ys)
    if (range <= RAMP_THRESHOLD) sharedCorners++
    else cliffCorners++
  }

  return {
    vertexCount:   Math.round(sharedCorners + cells.length * 1.5),
    triangleCount: cells.length * 6,
    sharedCorners,
    cliffCorners,
    hexCount: cells.length,
  }
}
