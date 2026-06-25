/**
 * TerrainMeshBuilder.ts
 *
 * Buduje TOPY terenu ze SFAZOWANA krawedzia (bevel):
 *   - plaski szesciokat (centrum + wewnetrzny pierscien) na worldY,
 *   - sfazowany pierscien schodzacy do worldY - CHAMFER_DROP na pelnym promieniu.
 *
 * Pelny promien (outer ring) to wspoldzielona krawedz z sasiadami -> CliffBuilder
 * podpina scianki dokladnie tam. Watertight z definicji.
 */

import * as THREE from 'three'
import { hexToWorld, hexCorners, HEX_SIZE } from '../hex/HexMath'
import { TERRAIN_COLORS, type HexCell } from '../hex/HexGrid'
import { TERRAIN_TEX_INDEX } from './TerrainTextureLoader'

/** O ile opada krawedz fazowania (i poziom gory scianek). */
export const CHAMFER_DROP = 0.16
/** Promien wewnetrznego (plaskiego) topu jako ulamek HEX_SIZE. */
const INNER_RATIO = 0.86

export function buildSmoothTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry {
  const pos:  number[] = []
  const col:  number[] = []
  const tidx: number[] = []
  const twgt: number[] = []
  const tri:  number[] = []

  for (const cell of cells) {
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    const outer = hexCorners(cx, cz, HEX_SIZE)
    const inner = hexCorners(cx, cz, HEX_SIZE * INNER_RATIO)
    const [r, g, b] = TERRAIN_COLORS[cell.terrainType]
    const texIdx = TERRAIN_TEX_INDEX[cell.terrainType] ?? 2
    const y  = cell.worldY
    const yb = y - CHAMFER_DROP

    const base = pos.length / 3
    const push = (x: number, yy: number, z: number) => {
      pos.push(x, yy, z); col.push(r, g, b); tidx.push(texIdx, 0, 0); twgt.push(1, 0, 0)
    }

    // centrum (base+0)
    push(cx, y, cz)
    // wewnetrzny pierscien (base+1..6) na worldY
    for (let i = 0; i < 6; i++) push(inner[i][0], y, inner[i][1])
    // zewnetrzny pierscien (base+7..12) na worldY - drop
    for (let i = 0; i < 6; i++) push(outer[i][0], yb, outer[i][1])

    const C = base, IN = base + 1, OUT = base + 7

    // plaski top (wachlarz)
    for (let i = 0; i < 6; i++) tri.push(C, IN + ((i + 1) % 6), IN + i)
    // pierscien fazowania (quady inner -> outer)
    for (let i = 0; i < 6; i++) {
      const a = IN + i, b = IN + ((i + 1) % 6), c = OUT + ((i + 1) % 6), d = OUT + i
      tri.push(a, b, c, a, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',   new THREE.Float32BufferAttribute(pos,  3))
  geo.setAttribute('color',      new THREE.Float32BufferAttribute(col,  3))
  geo.setAttribute('terrainIdx', new THREE.Float32BufferAttribute(tidx, 3))
  geo.setAttribute('terrainWgt', new THREE.Float32BufferAttribute(twgt, 3))
  geo.setIndex(tri)
  geo.computeVertexNormals()
  return geo
}
