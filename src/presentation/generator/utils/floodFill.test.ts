import { describe, it, expect } from 'vitest'
import { HexGrid } from '../hex/HexGrid'
import { floodFillSameTerrain } from './floodFill'

describe('floodFillSameTerrain', () => {
  it('all-plains: wypelnia cala mape od dowolnego heksa', () => {
    const g = new HexGrid(3, 1)
    g.generate()
    const coords = floodFillSameTerrain(g, 0, 0)
    expect(coords.length).toBe(g.getCellCount())
  })

  it('zatrzymuje sie na innym typie terenu', () => {
    const g = new HexGrid(3, 1)
    g.generate()
    // otocz (0,0) pierscieniem 'rocky' -> flood od (0,0) = tylko (0,0)
    for (const [nq, nr] of [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]) {
      g.setTerrainType(nq, nr, 'rocky')
    }
    const coords = floodFillSameTerrain(g, 0, 0)
    expect(coords).toEqual([[0, 0]])
  })

  it('wypelnia tylko spojny region tego samego typu', () => {
    const g = new HexGrid(4, 1)
    g.generate()
    // pasek 'peak' od (0,0) do (2,0)
    g.setTerrainType(0, 0, 'peak')
    g.setTerrainType(1, 0, 'peak')
    g.setTerrainType(2, 0, 'peak')
    const coords = floodFillSameTerrain(g, 0, 0)
    const keys = new Set(coords.map(([q, r]) => `${q},${r}`))
    expect(keys.has('0,0')).toBe(true)
    expect(keys.has('1,0')).toBe(true)
    expect(keys.has('2,0')).toBe(true)
    expect(coords.length).toBe(3)
  })

  it('pusty wynik dla heksa poza mapa', () => {
    const g = new HexGrid(2, 1)
    g.generate()
    expect(floodFillSameTerrain(g, 999, 999)).toEqual([])
  })
})
