import { describe, it, expect } from 'vitest'
import { HexGrid } from '../hex/HexGrid'
import { generateDecor, generateResources, generateSpawns, generateBuildNodes } from './ProceduralPlacement'

function grid(seed = 1, radius = 8) {
  const g = new HexGrid(radius, seed)
  g.generate()
  // troche zroznicowania terenu
  g.setTerrainType(0, 0, 'rocky')
  g.setTerrainType(1, 0, 'peak')
  g.setTerrainType(2, 0, 'highland')
  return g
}

describe('generateDecor', () => {
  it('deterministyczne dla tego samego seeda', () => {
    expect(generateDecor(grid(), 7)).toEqual(generateDecor(grid(), 7))
  })
  it('rozne seedy daja rozny wynik', () => {
    expect(JSON.stringify(generateDecor(grid(), 7))).not.toBe(JSON.stringify(generateDecor(grid(), 99)))
  })
  it('uzywa znanych modeli', () => {
    const ok = new Set(['rock_01', 'rocks', 'boulder', 'crystal', 'wreck'])
    for (const d of generateDecor(grid(), 7)) expect(ok.has(d.model)).toBe(true)
  })
})

describe('generateResources', () => {
  it('deterministyczne dla tego samego seeda', () => {
    expect(generateResources(grid(), 7, 2)).toEqual(generateResources(grid(), 7, 2))
  })
  it('liczba skaluje sie z graczami i ma poprawne pola', () => {
    const r2 = generateResources(grid(), 7, 2)
    const r4 = generateResources(grid(), 7, 4)
    expect(r4.length).toBeGreaterThan(r2.length)
    for (const n of r2) {
      expect(['minerals', 'ice', 'organics', 'energy']).toContain(n.type)
      expect(['low', 'med', 'high']).toContain(n.richness)
      expect(n.amount).toBeGreaterThan(0)
    }
  })
  it('brak duplikatow pozycji', () => {
    const r = generateResources(grid(), 3, 4)
    const keys = new Set(r.map(n => `${n.pos[0]},${n.pos[1]}`))
    expect(keys.size).toBe(r.length)
  })
})

describe('generateSpawns', () => {
  it('deterministyczne i tyle ile graczy', () => {
    const a = generateSpawns(grid(), 7, 3)
    const b = generateSpawns(grid(), 7, 3)
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    expect(a.map(s => s.player).sort()).toEqual([1, 2, 3])
  })
  it('rozne pozycje spawnow', () => {
    const s = generateSpawns(grid(), 5, 4)
    const keys = new Set(s.map(p => `${p.pos[0]},${p.pos[1]}`))
    expect(keys.size).toBe(4)
  })
})

describe('generateBuildNodes', () => {
  it('deterministyczne i niepuste gdy sa spawny', () => {
    const sp = generateSpawns(grid(), 7, 2)
    const a = generateBuildNodes(grid(), 7, 2, sp)
    const b = generateBuildNodes(grid(), 7, 2, sp)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })
  it('nie stawia na heksie spawnu', () => {
    const sp = generateSpawns(grid(), 7, 2)
    const bn = generateBuildNodes(grid(), 7, 2, sp)
    for (const b of bn) {
      expect(sp.some(s => s.pos[0] === b.pos[0] && s.pos[1] === b.pos[1])).toBe(false)
    }
  })
})
