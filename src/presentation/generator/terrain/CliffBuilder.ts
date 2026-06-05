/**
 * CliffBuilder.ts
 *
 * Genera ściany boczne klifów.
 *
 * Kryterium generowania ściany dla krawędzi A↔B (A wyższy):
 *   (a) diff(A,B) > RAMP_THRESHOLD            → bezpośredni klif
 *   (b) którykolwiek narożnik krawędzi jest "cliff corner" w terrain meshu
 *       (range worldY wśród sąsiadów > RAMP_THRESHOLD)
 *
 * Warunek (b) wypełnia luki gdy narożnik jest cliff corner przez TRZECIEGO sąsiada,
 * mimo że diff bezpośredni A↔B < RAMP_THRESHOLD.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexNeighbors, hexKey, HEX_SIZE } from '../hex/HexMath'
import type { HexCell } from '../hex/HexGrid'
import { RAMP_THRESHOLD } from './TerrainMeshBuilder'

// Marsjański brązowy bazalt — wystarczająco jasny żeby był widoczny ze wszystkich stron
const CLIFF_R = 0.52
const CLIFF_G = 0.28
const CLIFF_B = 0.10

// Para narożników dla krawędzi e, bordering HEX_DIRECTIONS[e]
// Poprawna kolejność: midpoint krawędzi wskazuje w kierunku neighbor[e]
const EDGE_CORNERS: [number, number][] = [
  [0, 1],  // dir 0: (1,  0)  → upper-right
  [5, 0],  // dir 1: (1, -1)  → lower-right
  [4, 5],  // dir 2: (0, -1)  → below
  [3, 4],  // dir 3: (-1, 0)  → lower-left
  [2, 3],  // dir 4: (-1, 1)  → upper-left
  [1, 2],  // dir 5: (0,  1)  → above
]

function ck(x: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(z * 1000)}`
}

// ─── Corner range map ─────────────────────────────────────────────────────────

function buildCornerRangeMap(cells: HexCell[]): Map<string, number> {
  const accum = new Map<string, { min: number; max: number }>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      const key = ck(x, z)
      const e = accum.get(key)
      if (e) {
        if (cell.worldY < e.min) e.min = cell.worldY
        if (cell.worldY > e.max) e.max = cell.worldY
      } else {
        accum.set(key, { min: cell.worldY, max: cell.worldY })
      }
    }
  }

  const result = new Map<string, number>()
  for (const [key, { min, max }] of accum) result.set(key, max - min)
  return result
}

// ─── buildCliffGeometry ───────────────────────────────────────────────────────

export function buildCliffGeometry(cells: HexCell[]): THREE.BufferGeometry | null {
  const cellMap      = new Map(cells.map(c => [hexKey(c.q, c.r), c]))
  const cornerRanges = buildCornerRangeMap(cells)

  const isCliffCorner = (key: string) => (cornerRanges.get(key) ?? 0) > RAMP_THRESHOLD

  const posArr: number[] = []
  const colArr: number[] = []
  const idxArr: number[] = []

  for (const cell of cells) {
    const [cx, cz]  = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const neighbors = hexNeighbors(cell.q, cell.r)
    const topY      = cell.worldY

    for (let e = 0; e < 6; e++) {
      const neighbor = cellMap.get(hexKey(neighbors[e][0], neighbors[e][1]))
      if (!neighbor) continue

      const botY = neighbor.worldY
      if (topY <= botY + 0.001) continue  // Ten hex musi być wyższy

      const [ci, cj] = EDGE_CORNERS[e]
      const [x0, z0] = corners[ci]
      const [x1, z1] = corners[cj]
      const k0 = ck(x0, z0)
      const k1 = ck(x1, z1)

      const diff = topY - botY

      // Generuj ścianę jeśli:
      //   (a) bezpośredni klif (duża różnica), LUB
      //   (b) któryś narożnik krawędzi jest cliff corner (może być luka w meshu)
      const needsWall = diff > RAMP_THRESHOLD || isCliffCorner(k0) || isCliffCorner(k1)
      if (!needsWall) continue

      const base = posArr.length / 3

      // Gradient góra → dół (ciemniejszy dół = głębokość wizualna)
      const topShade = 1.0
      const botShade = 0.55
      const tr = CLIFF_R * topShade, tg = CLIFF_G * topShade, tb = CLIFF_B * topShade
      const br = CLIFF_R * botShade, bg = CLIFF_G * botShade, bb = CLIFF_B * botShade

      posArr.push(
        x0, topY, z0,   // tl
        x1, topY, z1,   // tr
        x1, botY, z1,   // br
        x0, botY, z0,   // bl
      )
      colArr.push(
        tr, tg, tb,
        tr, tg, tb,
        br, bg, bb,
        br, bg, bb,
      )

      idxArr.push(
        base + 0, base + 1, base + 2,
        base + 0, base + 2, base + 3,
      )
    }
  }

  if (posArr.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colArr, 3))
  geo.setIndex(idxArr)
  // Bez computeVertexNormals — cliff material jest MeshBasicMaterial (unlit)
  return geo
}
