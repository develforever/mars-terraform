import { describe, it, expect, vi } from 'vitest'
import { buildSmoothTerrainGeometry, getTerrainMeshStats } from './TerrainMeshBuilder'
import { HexGrid, TERRAIN_HEIGHT, type HexCell } from '../hex/HexGrid'

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

function makeGrid(radius: number): HexCell[] {
  const grid = new HexGrid(radius, 1)
  grid.generate()
  return grid.getAllCells()
}

// ─── buildSmoothTerrainGeometry ───────────────────────────────────────────────

describe('buildSmoothTerrainGeometry — structure', () => {
  it('returns a BufferGeometry with position, color, index', () => {
    const cells = makeGrid(2)
    const geo = buildSmoothTerrainGeometry(cells)
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.color).toBeDefined()
    expect(geo.index).not.toBeNull()
  })

  it('has 6 triangles per hex (18 indices per hex)', () => {
    const cells = makeGrid(2)
    const geo = buildSmoothTerrainGeometry(cells)
    expect(geo.index!.array.length).toBe(cells.length * 6 * 3) // 3 indices per triangle
  })

  it('all index values are within vertex array bounds', () => {
    const cells = makeGrid(3)
    const geo = buildSmoothTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    for (const idx of geo.index!.array) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(vertexCount)
    }
  })

  it('position and color have same vertex count', () => {
    const cells = makeGrid(3)
    const geo = buildSmoothTerrainGeometry(cells)
    expect(geo.attributes.position.array.length).toBe(geo.attributes.color.array.length)
  })
})

describe('buildSmoothTerrainGeometry — shared vertices', () => {
  it('has fewer vertices than 7×cellCount (shared corners reduce count)', () => {
    const cells = makeGrid(5)
    const geo = buildSmoothTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    // InstancedMesh approach would be 7 * cells.length, shared should be less
    expect(vertexCount).toBeLessThan(7 * cells.length)
  })

  it('has more vertices than cells.length (at least 1 center per hex)', () => {
    const cells = makeGrid(3)
    const geo = buildSmoothTerrainGeometry(cells)
    const vertexCount = geo.attributes.position.array.length / 3
    expect(vertexCount).toBeGreaterThan(cells.length)
  })
})

describe('buildSmoothTerrainGeometry — height interpolation', () => {
  it('shared corner between plains and highland has Y between their worldY values', () => {
    // Manually create two adjacent cells with different heights
    const grid = new HexGrid(5, 1)
    grid.generate()
    grid.setTerrainType(0, 0, 'plains')   // worldY = 1.2
    grid.setTerrainType(1, 0, 'highland') // worldY = 2.0
    const cells = grid.getAllCells()

    const geo = buildSmoothTerrainGeometry(cells)
    const positions = geo.attributes.position.array

    // Find Y values of all vertices
    const yValues: number[] = []
    for (let i = 1; i < positions.length; i += 3) yValues.push(positions[i])

    const plainsY    = TERRAIN_HEIGHT['plains']    // 1.2
    const highlandY  = TERRAIN_HEIGHT['highland']  // 2.0

    // Some vertex should have Y between the two heights (shared corner interpolated)
    const hasInterpolated = yValues.some(y =>
      y > plainsY + 0.01 && y < highlandY - 0.01
    )
    expect(hasInterpolated).toBe(true)
  })

  it('all-plains grid has all vertices near plains worldY', () => {
    const cells = makeGrid(3) // all plains by default
    const geo = buildSmoothTerrainGeometry(cells)
    const positions = geo.attributes.position.array
    const plainsY = TERRAIN_HEIGHT['plains']

    for (let i = 1; i < positions.length; i += 3) {
      expect(positions[i]).toBeCloseTo(plainsY, 5)
    }
  })
})

// ─── getTerrainMeshStats ───────────────────────────────────────────────────────

describe('getTerrainMeshStats', () => {
  it('triangleCount = hexCount * 6', () => {
    const cells = makeGrid(4)
    const stats = getTerrainMeshStats(cells)
    expect(stats.triangleCount).toBe(stats.hexCount * 6)
  })

  it('vertexCount = sharedCorners + hexCount (1 center per hex)', () => {
    const cells = makeGrid(4)
    const stats = getTerrainMeshStats(cells)
    expect(stats.vertexCount).toBe(stats.sharedCorners + stats.hexCount)
  })

  it('shared corners < 6 * hexCount (interior corners are shared)', () => {
    const cells = makeGrid(5)
    const stats = getTerrainMeshStats(cells)
    expect(stats.sharedCorners).toBeLessThan(6 * stats.hexCount)
  })
})
