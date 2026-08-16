/**
 * floodFill.ts
 *
 * Bucket-fill po grafie heksow: zwraca wszystkie heksy spojne (przez sasiedztwo)
 * z klikniętym, ktore maja TEN SAM terrainType. Czysta funkcja -> testowalna.
 */

import type { HexGrid } from '../hex/HexGrid'
import { hexNeighbors } from '../hex/HexMath'

export function floodFillSameTerrain(grid: HexGrid, q: number, r: number): [number, number][] {
  const start = grid.getCell(q, r)
  if (!start) return []
  const target = start.terrainType

  const visited = new Set<string>([`${q},${r}`])
  const stack: [number, number][] = [[q, r]]
  const out: [number, number][] = []

  while (stack.length) {
    const [cq, cr] = stack.pop()!
    const cell = grid.getCell(cq, cr)
    if (!cell || cell.terrainType !== target) continue
    out.push([cq, cr])
    for (const [nq, nr] of hexNeighbors(cq, cr)) {
      const k = `${nq},${nr}`
      if (!visited.has(k) && grid.hasCell(nq, nr)) {
        visited.add(k)
        stack.push([nq, nr])
      }
    }
  }
  return out
}
