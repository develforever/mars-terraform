/**
 * TerrainMeshBuilder.ts
 *
 * Buduje jedną unified BufferGeometry z całego hex gridu.
 * Kluczowa technika: shared vertices — narożniki hexów są współdzielone
 * przez sąsiednie hexy. Ich wysokość Y = średnia worldY sąsiadów.
 * Efekt: automatyczne rampy i łagodne przejścia między poziomami.
 *
 * Odrębny od InstancedMesh (hex editor) — to jest warstwa podglądu.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, HEX_SIZE } from '../hex/HexMath'
import { TERRAIN_COLORS, type HexCell } from '../hex/HexGrid'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CornerAccum {
  x: number
  z: number
  heightSum: number
  colorR: number
  colorG: number
  colorB: number
  count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Unikalny klucz narożnika z zaokrągleniem do 3 miejsc — eliminuje float drift
function cornerKey(x: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(z * 1000)}`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Buduje ciągłą BufferGeometry z vertex colors dla całej mapy hex.
 *
 * Algorytm:
 * 1. Przejście 1: dla każdego narożnika zbiera heightSum + colorSum z sąsiadów
 * 2. Tworzy pulę wierzchołków narożnikowych (shared) z uśrednioną Y i kolorem
 * 3. Przejście 2: dla każdego hexa dodaje centrum + 6 trójkątów (fan)
 *
 * Winding: (center, corner[i+1], corner[i]) → normalne w górę (+Y)
 */
export function buildSmoothTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {
  // ── Przejście 1: akumuluj dane narożników ────────────────────────────────

  const cornerAccum = new Map<string, CornerAccum>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]

    for (const [x, z] of corners) {
      const key = cornerKey(x, z)
      const existing = cornerAccum.get(key)
      if (existing) {
        existing.heightSum += cell.worldY
        existing.colorR    += r
        existing.colorG    += g
        existing.colorB    += b
        existing.count++
      } else {
        cornerAccum.set(key, {
          x, z,
          heightSum: cell.worldY,
          colorR: r, colorG: g, colorB: b,
          count: 1,
        })
      }
    }
  }

  // ── Zbuduj pulę wierzchołków narożnikowych (shared) ───────────────────────

  const posArr: number[] = []
  const colArr: number[] = []
  const idxArr: number[] = []

  // cornerVertexIndex: key → indeks w posArr
  const cornerVertexIndex = new Map<string, number>()

  for (const [key, acc] of cornerAccum) {
    const n    = acc.count
    const avgY = acc.heightSum / n
    const avgR = acc.colorR / n
    const avgG = acc.colorG / n
    const avgB = acc.colorB / n

    cornerVertexIndex.set(key, posArr.length / 3)
    posArr.push(acc.x, avgY, acc.z)
    colArr.push(avgR, avgG, avgB)
  }

  // ── Przejście 2: centrum per hex + trójkąty ───────────────────────────────

  for (const cell of cells) {
    const [cx, cz]  = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]

    // Centrum hexa — własny wierzchołek (nie shared)
    const centerIdx = posArr.length / 3
    posArr.push(cx, cell.worldY, cz)
    colArr.push(r, g, b)

    // 6 trójkątów: centrum + corner[i+1] + corner[i]
    // Winding CCW z góry → normalna w górę (+Y)
    for (let i = 0; i < 6; i++) {
      const [x0, z0] = corners[i]
      const [x1, z1] = corners[(i + 1) % 6]
      const ci = cornerVertexIndex.get(cornerKey(x0, z0))!
      const cj = cornerVertexIndex.get(cornerKey(x1, z1))!
      // (center, next_corner, this_corner) → CCW → normal UP
      idxArr.push(centerIdx, cj, ci)
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

// ─── Stats helper (do testów / debugowania) ───────────────────────────────────

export interface TerrainMeshStats {
  vertexCount:   number
  triangleCount: number
  sharedCorners: number
  hexCount:      number
}

export function getTerrainMeshStats(cells: HexCell[]): TerrainMeshStats {
  // Policz unikalne narożniki
  const cornerSet = new Set<string>()
  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      cornerSet.add(cornerKey(x, z))
    }
  }

  const sharedCorners = cornerSet.size          // wierzchołki narożnikowe (shared)
  const centerVerts   = cells.length             // 1 centrum per hex
  const vertexCount   = sharedCorners + centerVerts
  const triangleCount = cells.length * 6         // 6 trójkątów per hex

  return { vertexCount, triangleCount, sharedCorners, hexCount: cells.length }
}
