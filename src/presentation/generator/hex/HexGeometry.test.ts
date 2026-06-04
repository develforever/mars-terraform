import { describe, it, expect, vi } from 'vitest'
import { hexToWorld } from './HexMath'
import {
  buildHexTerrainGeometry,
  buildHexEdgesGeometry,
  buildHexHighlightGeometry,
  buildHexOverlayData,
} from './HexGeometry'
import { HexGrid, type HexCell } from './HexGrid'

// ─── Mock THREE ───────────────────────────────────────────────────────────────
// HexGeometry uses Three.js — mock it for unit tests

vi.mock('three', () => {
  class Float32BufferAttribute {
    array: number[]
    itemSize: number
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCells(count: number): HexCell[] {
  const grid = new HexGrid(5, 42)
  grid.generate()
  return grid.getAllCells().slice(0, count)
}

// ─── buildHexTerrainGeometry ──────────────────────────────────────────────────

describe('buildHexTerrainGeometry', () => {
  it('returns a BufferGeometry', () => {
    const cells = makeCells(1)
    const geo = buildHexTerrainGeometry(cells)
    expect(geo).toBeDefined()
    expect(geo.attributes).toBeDefined()
  })

  it('has position, color attributes and index', () => {
    const cells = makeCells(3)
    const geo = buildHexTerrainGeometry(cells)
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.index).not.toBeNull()
  })

  it('position and color have same vertex count', () => {
    const cells = makeCells(5)
    const geo = buildHexTerrainGeometry(cells)
    const posLen = geo.attributes.position.array.length / 3
    const colLen = geo.attributes.color.array.length / 3
    expect(posLen).toBe(colLen)
  })

  it('each hex contributes at least 7 top vertices', () => {
    const cells = makeCells(4)
    const geo = buildHexTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBeGreaterThanOrEqual(4 * 7)
  })

  it('each hex contributes at least 6 top triangles', () => {
    const cells = makeCells(3)
    const geo = buildHexTerrainGeometry(cells)
    const indexCount = geo.index!.array.length
    expect(indexCount).toBeGreaterThanOrEqual(3 * 18)
  })

  it('handles empty cell array', () => {
    const geo = buildHexTerrainGeometry([])
    expect(geo.attributes.position.array.length).toBe(0)
    expect(geo.index!.array.length).toBe(0)
  })

  it('all index values are within vertex count bounds', () => {
    const cells = makeCells(10)
    const geo = buildHexTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    for (const idx of geo.index!.array) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(vertexCount)
    }
  })

  it('color values are in [0, 1] range', () => {
    const cells = makeCells(10)
    const geo = buildHexTerrainGeometry(cells)
    for (const v of geo.attributes.color.array) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('Y positions match cell worldY (top face center)', () => {
    const cells = makeCells(1)
    const cell = cells[0]
    const geo = buildHexTerrainGeometry(cells)
    const positions = geo.attributes.position.array

    // First 3 values = center of top face = (cx, worldY, cz)
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    expect(positions[0]).toBeCloseTo(cx, 4)
    expect(positions[1]).toBeCloseTo(cell.worldY, 4)
    expect(positions[2]).toBeCloseTo(cz, 4)
  })

  it('does not add side faces between equal-height neighbors', () => {
    const cells: HexCell[] = [
      { q: 0, r: 0, height: 0.5, worldY: 2.4, terrainType: 'plains', userType: null, decor: null },
      { q: 1, r: 0, height: 0.5, worldY: 2.4, terrainType: 'plains', userType: null, decor: null },
    ]
    const geo = buildHexTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBeLessThan(2 * 31)
  })

  it('adds side faces when a neighbor is lower', () => {
    const cells: HexCell[] = [
      { q: 0, r: 0, height: 0.8, worldY: 5.2, terrainType: 'rocky', userType: null, decor: null },
      { q: 1, r: 0, height: 0.4, worldY: 2.4, terrainType: 'plains', userType: null, decor: null },
    ]
    const geo = buildHexTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBeGreaterThan(2 * 7)
  })
})

// ─── buildHexEdgesGeometry ────────────────────────────────────────────────────

describe('buildHexEdgesGeometry', () => {
  it('returns geometry with position attribute', () => {
    const cells = makeCells(3)
    const geo = buildHexEdgesGeometry(cells)
    expect(geo.attributes.position).toBeDefined()
  })

  it('each hex contributes 12 line segment endpoints (6 edges × 2)', () => {
    const cells = makeCells(5)
    const geo = buildHexEdgesGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBe(5 * 12)
  })

  it('handles empty array', () => {
    const geo = buildHexEdgesGeometry([])
    expect(geo.attributes.position.array.length).toBe(0)
  })

  it('edge vertices are at worldY + 0.05 (above terrain)', () => {
    const cells = makeCells(1)
    const cell = cells[0]
    const geo = buildHexEdgesGeometry(cells)
    const positions = geo.attributes.position.array

    // All Y values should be worldY + 0.05
    for (let i = 1; i < positions.length; i += 3) {
      expect(positions[i]).toBeCloseTo(cell.worldY + 0.05, 4)
    }
  })
})

// ─── buildHexHighlightGeometry ────────────────────────────────────────────────

describe('buildHexHighlightGeometry', () => {
  it('returns geometry with 7 vertices (center + 6 corners)', () => {
    const geo = buildHexHighlightGeometry(0, 0, 1.2)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBe(7)
  })

  it('has 6 triangles (18 indices)', () => {
    const geo = buildHexHighlightGeometry(0, 0, 1.2)
    expect(geo.index!.array.length).toBe(18)
  })

  it('center vertex is at (cx, worldY+0.08, cz)', () => {
    const geo = buildHexHighlightGeometry(2, -1, 1.9)
    const positions = geo.attributes.position.array
    const [cx, cz] = hexToWorld(2, -1)
    expect(positions[0]).toBeCloseTo(cx, 4)
    expect(positions[1]).toBeCloseTo(1.9 + 0.08, 4)
    expect(positions[2]).toBeCloseTo(cz, 4)
  })

  it('scale parameter reduces hex size', () => {
    const geo1 = buildHexHighlightGeometry(0, 0, 0, 1.0)
    const geo2 = buildHexHighlightGeometry(0, 0, 0, 0.5)

    // Corner distances: geo2 corners should be closer to center
    const p1 = geo1.attributes.position.array
    const p2 = geo2.attributes.position.array

    // First corner (index 1 = vertex 1): x=p[3], y=p[4], z=p[5]
    const dist1 = Math.sqrt(p1[3] ** 2 + p1[5] ** 2)
    const dist2 = Math.sqrt(p2[3] ** 2 + p2[5] ** 2)
    expect(dist2).toBeCloseTo(dist1 * 0.5, 3)
  })
})

// ─── buildHexOverlayData ──────────────────────────────────────────────────────

describe('buildHexOverlayData', () => {
  it('returns empty arrays for cells with no userType', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    const { positions, colors } = buildHexOverlayData(grid.getAllCells())
    expect(positions).toHaveLength(0)
    expect(colors).toHaveLength(0)
  })

  it('returns one entry per painted cell', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    grid.setUserType(1, 0, 'resource')
    grid.setUserType(-1, 1, 'blocked')
    const { positions, colors } = buildHexOverlayData(grid.getAllCells())
    expect(positions).toHaveLength(3)
    expect(colors).toHaveLength(3)
  })

  it('ignores cells with userType = empty', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    grid.setUserType(1, 0, 'empty')
    const { positions } = buildHexOverlayData(grid.getAllCells())
    expect(positions).toHaveLength(1)
  })

  it('positions are at worldY + 0.06', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    const cell = grid.getCell(0, 0)!
    const { positions } = buildHexOverlayData(grid.getAllCells())
    expect(positions[0][1]).toBeCloseTo(cell.worldY + 0.06, 4)
  })

  it('build color is greenish', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(0, 0, 'build')
    const { colors } = buildHexOverlayData(grid.getAllCells())
    const [r, g, b] = colors[0]
    expect(g).toBeGreaterThan(r)  // green dominant
    expect(g).toBeGreaterThan(b)
  })

  it('resource color is yellowish', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(0, 0, 'resource')
    const { colors } = buildHexOverlayData(grid.getAllCells())
    const [r, g, b] = colors[0]
    expect(r).toBeGreaterThan(b)  // red+green = yellow
    expect(g).toBeGreaterThan(b)
  })

  it('positions match hexToWorld for each cell', () => {
    const grid = new HexGrid(3, 1)
    grid.generate()
    grid.setUserType(2, -1, 'spawn')
    const { positions } = buildHexOverlayData(grid.getAllCells())
    const [cx, cz] = hexToWorld(2, -1)
    expect(positions[0][0]).toBeCloseTo(cx, 4)
    expect(positions[0][2]).toBeCloseTo(cz, 4)
  })
})
