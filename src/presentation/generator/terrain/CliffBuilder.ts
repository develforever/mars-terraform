/**
 * CliffBuilder.ts
 *
 * Pionowe scianki podpinane do SFAZOWANEJ krawedzi topow (outer ring na
 * worldY - CHAMFER_DROP). Watertight: gora/dol scianki trafia dokladnie
 * w outer ring sasiednich topow.
 *   - rozni sasiedzi: wyzszy buduje sciane od (thisY-drop) do (nbY-drop),
 *   - brzeg mapy: skirt do BASE_Y.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, hexNeighbors, hexKey, HEX_SIZE } from '../hex/HexMath'
import { TERRAIN_COLORS, type HexCell } from '../hex/HexGrid'
import { TERRAIN_TEX_INDEX } from './TerrainTextureLoader'
import { CHAMFER_DROP } from './TerrainMeshBuilder'

const BASE_Y   = -2.5
const ROCK_IDX = TERRAIN_TEX_INDEX.rocky ?? 4

const EDGE_CORNERS: [number, number][] = [
  [0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2],
]

export function buildCliffGeometry(cells: HexCell[]): THREE.BufferGeometry | null {
  const cellMap = new Map(cells.map(c => [hexKey(c.q, c.r), c]))

  const pos:  number[] = []
  const col:  number[] = []
  const tidx: number[] = []
  const twgt: number[] = []
  const idx:  number[] = []

  for (const cell of cells) {
    const [cx, cz]  = hexToWorld(cell.q, cell.r)
    const corners   = hexCorners(cx, cz, HEX_SIZE)
    const neighbors = hexNeighbors(cell.q, cell.r)
    const topY      = cell.worldY - CHAMFER_DROP
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]

    for (let e = 0; e < 6; e++) {
      const nb = cellMap.get(hexKey(neighbors[e][0], neighbors[e][1]))

      let botY: number
      if (!nb) {
        botY = BASE_Y
      } else if (nb.worldY < cell.worldY - 0.001) {
        botY = nb.worldY - CHAMFER_DROP
      } else {
        continue
      }

      const [ci, cj] = EDGE_CORNERS[e]
      const [x0, z0] = corners[ci]
      const [x1, z1] = corners[cj]

      const base = pos.length / 3
      const tS = 1.0, bS = 0.55
      pos.push(x0, topY, z0,  x1, topY, z1,  x1, botY, z1,  x0, botY, z0)
      col.push(
        r * tS, g * tS, b * tS,
        r * tS, g * tS, b * tS,
        r * bS, g * bS, b * bS,
        r * bS, g * bS, b * bS,
      )
      for (let v = 0; v < 4; v++) { tidx.push(ROCK_IDX, 0, 0); twgt.push(1, 0, 0) }

      idx.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3)
    }
  }

  if (pos.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',   new THREE.Float32BufferAttribute(pos,  3))
  geo.setAttribute('color',      new THREE.Float32BufferAttribute(col,  3))
  geo.setAttribute('terrainIdx', new THREE.Float32BufferAttribute(tidx, 3))
  geo.setAttribute('terrainWgt', new THREE.Float32BufferAttribute(twgt, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}
