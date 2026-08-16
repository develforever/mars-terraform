import { describe, it, expect, beforeEach } from 'vitest'
import { HexGrid, TERRAIN_COLORS, TERRAIN_HEIGHT } from './HexGrid'
import { hexKey } from './HexMath'

describe('HexGrid — construction', () => {
  it('generates correct number of cells for radius 5', () => {
    const grid = new HexGrid(5, 42)
    grid.generate()
    // 3*n*(n+1)+1 = 3*5*6+1 = 91
    expect(grid.getCellCount()).toBe(91)
  })

  it('generates correct number of cells for radius 20', () => {
    const grid = new HexGrid(20, 42)
    grid.generate()
    // 3*20*21+1 = 1261
    expect(grid.getCellCount()).toBe(1261)
  })

  it('origin cell always exists', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    expect(grid.getCell(0, 0)).toBeDefined()
  })

  it('cell outside radius does not exist', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    expect(grid.getCell(10, 10)).toBeUndefined()
  })
})

describe('HexGrid — cell values (flat terrain)', () => {
  let grid: HexGrid

  beforeEach(() => {
    grid = new HexGrid(10, 42)
    grid.generate()
  })

  it('all cells have height = 0', () => {
    for (const cell of grid.getAllCells()) {
      expect(cell.height).toBe(0)
    }
  })

  it('all cells have worldY = TERRAIN_HEIGHT[plains]', () => {
    for (const cell of grid.getAllCells()) {
      expect(cell.worldY).toBe(1.2) // plains = 1.2
    }
  })

  it('all cells start as plains terrainType', () => {
    for (const cell of grid.getAllCells()) {
      expect(cell.terrainType).toBe('plains')
    }
  })

  it('all cells start with userType = null', () => {
    for (const cell of grid.getAllCells()) {
      expect(cell.userType).toBeNull()
    }
  })

  it('cells have correct q, r matching their key', () => {
    for (const cell of grid.getAllCells()) {
      const found = grid.getCell(cell.q, cell.r)
      expect(found).toBeDefined()
      expect(found!.q).toBe(cell.q)
      expect(found!.r).toBe(cell.r)
    }
  })
})

describe('HexGrid — determinism', () => {
  it('same seed produces identical grids', () => {
    const g1 = new HexGrid(10, 12345)
    const g2 = new HexGrid(10, 12345)
    g1.generate()
    g2.generate()

    const cells1 = g1.getAllCells().sort((a, b) => hexKey(a.q, a.r).localeCompare(hexKey(b.q, b.r)))
    const cells2 = g2.getAllCells().sort((a, b) => hexKey(a.q, a.r).localeCompare(hexKey(b.q, b.r)))

    for (let i = 0; i < cells1.length; i++) {
      expect(cells1[i].terrainType).toBe(cells2[i].terrainType)
      expect(cells1[i].height).toBe(cells2[i].height)
    }
  })
})

describe('HexGrid — setUserType', () => {
  it('sets userType on existing cell', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    expect(grid.getCell(0, 0)!.userType).toBe('build')
  })

  it('setting null clears userType', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    grid.setUserType(0, 0, null)
    expect(grid.getCell(0, 0)!.userType).toBeNull()
  })

  it('does not affect other cells', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setUserType(0, 0, 'resource')
    for (const cell of grid.getAllCells()) {
      if (cell.q === 0 && cell.r === 0) continue
      expect(cell.userType).toBeNull()
    }
  })

  it('setUserType on non-existent cell does not throw', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    expect(() => grid.setUserType(99, 99, 'build')).not.toThrow()
  })
})

describe('HexGrid — setTerrainType', () => {
  it('sets terrainType on existing cell', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'rocky')
    expect(grid.getCell(0, 0)!.terrainType).toBe('rocky')
  })

  it('updates worldY when terrainType changes', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'peak')
    expect(grid.getCell(0, 0)!.worldY).toBe(TERRAIN_HEIGHT['peak'])
    grid.setTerrainType(0, 0, 'deep_crater')
    expect(grid.getCell(0, 0)!.worldY).toBe(TERRAIN_HEIGHT['deep_crater'])
  })

  it('does not affect other cells', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'highland')
    for (const cell of grid.getAllCells()) {
      if (cell.q === 0 && cell.r === 0) continue
      expect(cell.terrainType).toBe('plains')
    }
  })
})

describe('HexGrid — snapshot / restore', () => {
  it('snapshot captures current state', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    const snap = grid.snapshot()
    expect(snap.get(hexKey(0, 0))!.userType).toBe('build')
  })

  it('restoreSnapshot reverts changes', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    const snap = grid.snapshot()
    grid.setUserType(0, 0, 'build')
    grid.restoreSnapshot(snap)
    expect(grid.getCell(0, 0)!.userType).toBeNull()
  })
})

describe('HexGrid — stats', () => {
  it('getTerrainStats counts all cells as plains', () => {
    const grid = new HexGrid(10, 42)
    grid.generate()
    const stats = grid.getTerrainStats()
    expect(stats.plains).toBe(grid.getCellCount())
    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    expect(total).toBe(grid.getCellCount())
  })

  it('getUserTypeStats shows all empty before painting', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    const stats = grid.getUserTypeStats()
    expect(stats.empty).toBe(grid.getCellCount())
    expect(stats.build).toBe(0)
  })

  it('getUserTypeStats updates after painting', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    grid.setUserType(1, 0, 'resource')
    const stats = grid.getUserTypeStats()
    expect(stats.build).toBe(1)
    expect(stats.resource).toBe(1)
    expect(stats.empty).toBe(grid.getCellCount() - 2)
  })
})

describe('HexGrid — serialization', () => {
  it('toJSON / fromJSON roundtrip preserves data', () => {
    const grid = new HexGrid(5, 42)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    grid.setTerrainType(0, 0, 'rocky')
    grid.setUserType(1, -1, 'resource')

    const json = grid.toJSON() as { hexes: Partial<import('./HexGrid').HexCell>[] }
    const grid2 = new HexGrid(5, 42)
    grid2.fromJSON(json)

    expect(grid2.getCellCount()).toBe(grid.getCellCount())
    expect(grid2.getCell(0, 0)!.userType).toBe('build')
    expect(grid2.getCell(0, 0)!.terrainType).toBe('rocky')
    expect(grid2.getCell(1, -1)!.userType).toBe('resource')
  })

  it('toJSON includes version and gridType', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    const json = grid.toJSON() as Record<string, unknown>
    expect(json.version).toBe(2)
    expect(json.gridType).toBe('hex-flat-top')
    expect(json.radius).toBe(5)
    expect(json.seed).toBe(1)
  })
})

describe('TERRAIN_COLORS', () => {
  it('all terrain types have RGB values in [0, 1]', () => {
    for (const [, [r, g, b]] of Object.entries(TERRAIN_COLORS)) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })
})
