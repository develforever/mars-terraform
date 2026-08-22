import { describe, it, expect } from 'vitest'
import { HexGrid, TERRAIN_HEIGHT } from '../hex/HexGrid'
import { applyProceduralTerrain } from './ProceduralTerrain'

function hashGrid(grid: HexGrid): string {
  return grid
    .getAllCells()
    .sort((a, b) => (a.q === b.q ? a.r - b.r : a.q - b.q))
    .map(c => `${c.q}:${c.r}:${c.terrainType}:${c.worldY}`)
    .join('|')
}

function gen(seed: number, radius = 10): HexGrid {
  const g = new HexGrid(radius, seed)
  g.generate()
  applyProceduralTerrain(g, seed)
  return g
}

describe('applyProceduralTerrain — determinism and features', () => {
  it('jest w 100% deterministyczne (ten sam seed = identyczny hash komórek)', () => {
    const g1 = gen(42, 12)
    const g2 = gen(42, 12)
    expect(hashGrid(g1)).toBe(hashGrid(g2))
  })

  it('różne seedy dają różne struktury terenu', () => {
    const g1 = gen(42, 12)
    const g2 = gen(999, 12)
    expect(hashGrid(g1)).not.toBe(hashGrid(g2))
  })

  it('tworzy wszystkie formacje marsjańskie (kratery, niziny, równiny, wyżyny, skały, szczyty)', () => {
    const g = gen(77, 15)
    const stats = g.getTerrainStats()
    expect(stats.plains).toBeGreaterThan(0)
    expect(stats.highland).toBeGreaterThan(0)
    expect(stats.rocky).toBeGreaterThan(0)
    expect(stats.peak).toBeGreaterThan(0)
    expect(stats.lowland + stats.deep_crater).toBeGreaterThan(0)
  })

  it('prawidłowo ustawia worldY odpowiadające stałym TERRAIN_HEIGHT', () => {
    const g = gen(1234, 10)
    for (const cell of g.getAllCells()) {
      expect(cell.worldY).toBe(TERRAIN_HEIGHT[cell.terrainType])
    }
  })

  it('HexGrid.prototype.applyProcedural daje ten sam wynik co applyProceduralTerrain', () => {
    const g1 = new HexGrid(8, 555)
    g1.generate()
    g1.applyProcedural()

    const g2 = new HexGrid(8, 555)
    g2.generate()
    applyProceduralTerrain(g2, 555)

    expect(hashGrid(g1)).toBe(hashGrid(g2))
  })

  it('obsługuje opcje konfiguracyjne (custom craterCount i octaves)', () => {
    const gCustom = new HexGrid(8, 100)
    gCustom.generate()
    applyProceduralTerrain(gCustom, 100, {
      octaves: 3,
      craterCount: 5,
      mountainStrength: 0.5,
    })

    const stats = gCustom.getTerrainStats()
    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    expect(total).toBe(gCustom.getCellCount())
  })
})

