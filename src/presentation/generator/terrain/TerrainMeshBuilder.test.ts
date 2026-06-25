import { describe, it, expect, vi } from 'vitest'
import { buildSmoothTerrainGeometry, CHAMFER_DROP } from './TerrainMeshBuilder'
import { buildCliffGeometry } from './CliffBuilder'
import { HexGrid, TERRAIN_HEIGHT, type HexCell } from '../hex/HexGrid'

vi.mock('three', () => {
  class Float32BufferAttribute {
    array: number[]; itemSize: number
    constructor(arr: number[], size: number) { this.array = arr; this.itemSize = size }
  }
  class BufferGeometry {
    attributes: Record<string, Float32BufferAttribute> = {}
    index: { array: number[] } | null = null
    setAttribute(name: string, attr: Float32BufferAttribute) { this.attributes[name] = attr }
    setIndex(arr: number[]) { this.index = { array: arr } }
    computeVertexNormals() {}
  }
  return { BufferGeometry, Float32BufferAttribute }
})

function makeGrid(radius: number): HexCell[] {
  const grid = new HexGrid(radius, 1)
  grid.generate()
  return grid.getAllCells()
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-4

// ─── Topy (z fazowaniem) ────────────────────────────────────────────────────────

describe('buildSmoothTerrainGeometry — struktura', () => {
  it('zwraca geometrie z position, color, terrainIdx, terrainWgt, index', () => {
    const geo = buildSmoothTerrainGeometry(makeGrid(2))
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.attributes.terrainIdx).toBeDefined()
    expect(geo.attributes.terrainWgt).toBeDefined()
    expect(geo.index).not.toBeNull()
  })

  it('18 trojkatow na heks (6 top + 12 bevel)', () => {
    const cells = makeGrid(2)
    const geo = buildSmoothTerrainGeometry(cells)
    expect(geo.index!.array.length).toBe(cells.length * 18 * 3)
  })

  it('13 wierzcholkow na heks (centrum + 6 inner + 6 outer)', () => {
    const cells = makeGrid(3)
    const geo = buildSmoothTerrainGeometry(cells)
    expect(geo.attributes.position.array.length / 3).toBe(13 * cells.length)
  })

  it('wszystkie indeksy w zakresie', () => {
    const geo = buildSmoothTerrainGeometry(makeGrid(3))
    const vc = geo.attributes.position.array.length / 3
    for (const i of geo.index!.array) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(vc)
    }
  })

  it('position i color maja te sama liczbe wierzcholkow', () => {
    const geo = buildSmoothTerrainGeometry(makeGrid(3))
    expect(geo.attributes.position.array.length).toBe(geo.attributes.color.array.length)
  })
})

describe('buildSmoothTerrainGeometry — fazowane topy', () => {
  it('all-plains: Y tylko na worldY lub worldY - CHAMFER_DROP', () => {
    const geo = buildSmoothTerrainGeometry(makeGrid(3))
    const p = geo.attributes.position.array
    const top = TERRAIN_HEIGHT['plains']
    const bev = top - CHAMFER_DROP
    for (let i = 1; i < p.length; i += 3) {
      expect(near(p[i], top) || near(p[i], bev)).toBe(true)
    }
  })

  it('pojedynczy heks: centrum+inner na worldY, outer na worldY - drop', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'highland')
    const geo = buildSmoothTerrainGeometry(grid.getAllCells())
    const p = geo.attributes.position.array
    const y0 = p[1] // centrum pierwszego heksa
    for (let v = 0; v < 7; v++)  expect(near(p[v * 3 + 1], y0)).toBe(true)            // centrum + inner
    for (let v = 7; v < 13; v++) expect(near(p[v * 3 + 1], y0 - CHAMFER_DROP)).toBe(true) // outer
  })

  it('peak wsrod plains: tylko dyskretne poziomy (bez interpolacji)', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'peak')
    const geo = buildSmoothTerrainGeometry(grid.getAllCells())
    const p = geo.attributes.position.array
    const lv = [TERRAIN_HEIGHT['plains'], TERRAIN_HEIGHT['plains'] - CHAMFER_DROP,
                TERRAIN_HEIGHT['peak'],   TERRAIN_HEIGHT['peak'] - CHAMFER_DROP]
    for (let i = 1; i < p.length; i += 3) {
      expect(lv.some(v => near(p[i], v))).toBe(true)
    }
  })
})

// ─── Scianki / skirt ─────────────────────────────────────────────────────────

describe('buildCliffGeometry — szczelne scianki', () => {
  it('all-plains: skirt na brzegu schodzi do BASE_Y', () => {
    const geo = buildCliffGeometry(makeGrid(2))
    expect(geo).not.toBeNull()
    const p = geo!.attributes.position.array
    let hasBase = false
    for (let i = 1; i < p.length; i += 3) if (p[i] < -2.4) hasBase = true
    expect(hasBase).toBe(true)
  })

  it('peak wsrod plains: gora scianki na peak-drop, dol na plains-drop', () => {
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'peak')
    const geo = buildCliffGeometry(grid.getAllCells())!
    const p = geo.attributes.position.array
    let topOk = false, botOk = false
    for (let i = 1; i < p.length; i += 3) {
      if (near(p[i], TERRAIN_HEIGHT['peak']   - CHAMFER_DROP)) topOk = true
      if (near(p[i], TERRAIN_HEIGHT['plains'] - CHAMFER_DROP)) botOk = true
    }
    expect(topOk).toBe(true)
    expect(botOk).toBe(true)
  })

  it('indeksy scian w zakresie, position==color', () => {
    const grid = new HexGrid(4, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'peak')
    const geo = buildCliffGeometry(grid.getAllCells())!
    const vc = geo.attributes.position.array.length / 3
    for (const i of geo.index!.array) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(vc)
    }
    expect(geo.attributes.position.array.length).toBe(geo.attributes.color.array.length)
  })
})
