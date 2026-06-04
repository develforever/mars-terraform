/**
 * CliffBuilder.ts
 *
 * Genera ściany boczne między hexami z dużą różnicą wysokości.
 *
 * Kluczowe: wierzchołki górne krawędzi klifu używają UŚREDNIONYCH wysokości
 * narożników (identycznych jak TerrainMeshBuilder) — dzięki temu ściany
 * dokładnie przylegają do powierzchni smooth terenu bez przecięć.
 *
 * Algorytm per edge:
 *   topA  = avgY narożnika (suma worldY wszystkich sąsiadów / count)
 *   topB  = avgY drugiego narożnika krawędzi
 *   botA  = avgY narożnika na poziomie sąsiada (tylko hexy sąsiada)
 *   botB  = analogicznie
 *
 * Uproszczenie: zamiast pełnego re-obliczania, używamy interpolacji:
 *   cornerTopY  = (cell.worldY + neighbor.worldY) / 2  — dla obu rogów krawędzi
 *   cornerBotY  = neighbor.worldY                      — dolna krawędź
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexNeighbors, hexKey, HEX_SIZE } from '../hex/HexMath'
import type { HexCell } from '../hex/HexGrid'

// ─── Stałe ────────────────────────────────────────────────────────────────────

// Minimalna różnica Y żeby wygenerować ścianę boczną
const CLIFF_THRESHOLD = 0.8

// Ciemny bazalt — kolor ścian klifów
const CLIFF_R = 0.20
const CLIFF_G = 0.11
const CLIFF_B = 0.05

// Indeksy rogów krawędzi: krawędź i = (corner[i], corner[i+1%6])
const EDGE_CORNERS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
]

// ─── Corner height map ────────────────────────────────────────────────────────

function buildCornerHeightMap(cells: HexCell[]): Map<string, number> {
  // Ta sama logika co TerrainMeshBuilder — uśredniony Y per narożnik
  const accum = new Map<string, { sum: number; count: number }>()

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    for (const [x, z] of hexCorners(cx, cz, HEX_SIZE)) {
      const key = `${Math.round(x * 1000)},${Math.round(z * 1000)}`
      const e = accum.get(key)
      if (e) { e.sum += cell.worldY; e.count++ }
      else accum.set(key, { sum: cell.worldY, count: 1 })
    }
  }

  const result = new Map<string, number>()
  for (const [key, { sum, count }] of accum) result.set(key, sum / count)
  return result
}

function ck(x: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(z * 1000)}`
}

// ─── buildCliffGeometry ───────────────────────────────────────────────────────

export function buildCliffGeometry(cells: HexCell[]): THREE.BufferGeometry | null {
  const cellMap       = new Map(cells.map(c => [hexKey(c.q, c.r), c]))
  const cornerHeights = buildCornerHeightMap(cells)

  const posArr: number[] = []
  const colArr: number[] = []
  const idxArr: number[] = []

  for (const cell of cells) {
    const [cx, cz]  = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const neighbors = hexNeighbors(cell.q, cell.r)

    for (let e = 0; e < 6; e++) {
      const neighbor = cellMap.get(hexKey(neighbors[e][0], neighbors[e][1]))

      // Tylko między dwoma istniejącymi hexami; tylko gdy ten jest wyraźnie wyższy
      if (!neighbor) continue
      if (neighbor.worldY >= cell.worldY - CLIFF_THRESHOLD) continue

      const [ci, cj] = EDGE_CORNERS[e]
      const [x0, z0] = corners[ci]
      const [x1, z1] = corners[cj]

      // Górna krawędź klifu = uśredniona wysokość narożnika (jak w smooth terrain)
      // Dolna krawędź = wysokość narożnika tego samego punktu po stronie niższego hexa
      // → przybliżamy: górna = z corner height map, dolna = neighbor.worldY
      const topY0 = cornerHeights.get(ck(x0, z0)) ?? cell.worldY
      const topY1 = cornerHeights.get(ck(x1, z1)) ?? cell.worldY
      const botY  = neighbor.worldY

      // Pomijamy krawędzie gdzie górna = dolna (brak widocznej ściany)
      if (topY0 <= botY + 0.05 && topY1 <= botY + 0.05) continue

      const base = posArr.length / 3

      // Kolor — lekko ciemniejszy w dolnej partii
      const shade = (v: number) => v * (0.6 + 0.4 * ((topY0 - botY) / (cell.worldY - botY + 0.01)))
      const r = shade(CLIFF_R)
      const g = shade(CLIFF_G)
      const b = shade(CLIFF_B)

      posArr.push(
        x0, topY0, z0,  // tl
        x1, topY1, z1,  // tr
        x1, botY,  z1,  // br
        x0, botY,  z0,  // bl
      )
      colArr.push(r, g, b,  r, g, b,  r, g, b,  r, g, b)

      // CCW z zewnątrz hexa (w kierunku niższego sąsiada)
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
  geo.computeVertexNormals()
  return geo
}
