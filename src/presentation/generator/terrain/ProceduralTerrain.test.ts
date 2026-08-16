import { describe, it, expect } from 'vitest'
import { HexGrid } from '../hex/HexGrid'
import { applyProceduralTerrain } from './ProceduralTerrain'

function gen(seed: number, radius = 8): string[] {
  const g = new HexGrid(radius, seed)
  g.generate()
  applyProceduralTerrain(g, seed)
  return g.getAllCells().map(c => c.terrainType)
}

describe('applyProceduralTerrain', () => {
  it('jest deterministyczne (ten sam seed = ta sama mapa)', () => {
    expect(gen(7)).toEqual(gen(7))
  })

  it('daje zroznicowany teren (nie same plains)', () => {
    const types = new Set(gen(7))
    expect(types.size).toBeGreaterThan(1)
  })

  it('rozne seedy daja rozne mapy', () => {
    expect(gen(7).join(',')).not.toBe(gen(99).join(','))
  })

  it('ustawia worldY wg typu (peak wyzej niz plains)', () => {
    const g = new HexGrid(8, 7)
    g.generate()
    applyProceduralTerrain(g, 7)
    const cells = g.getAllCells()
    const peak = cells.find(c => c.terrainType === 'peak')
    const plains = cells.find(c => c.terrainType === 'plains')
    if (peak && plains) expect(peak.worldY).toBeGreaterThan(plains.worldY)
  })
})
