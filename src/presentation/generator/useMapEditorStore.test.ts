import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useMapEditorStore } from '../../application/store/useMapEditorStore'

// Reset store before each test
beforeEach(() => {
  act(() => useMapEditorStore.getState().resetMap())
})

// ─── Meta ─────────────────────────────────────────────────────────────────────

describe('useMapEditorStore — meta', () => {
  it('has correct default meta', () => {
    const { meta } = useMapEditorStore.getState()
    expect(meta.name).toBe('mars_map')
    expect(meta.size).toEqual([100, 100])
    expect(meta.tileSize).toBe(1)
    expect(meta.terrainFile).toBe('mars_terrain.glb')
  })

  it('updateMeta patches partial fields', () => {
    act(() => useMapEditorStore.getState().updateMeta({ name: 'test_map', players: 4 }))
    const { meta } = useMapEditorStore.getState()
    expect(meta.name).toBe('test_map')
    expect(meta.players).toBe(4)
    expect(meta.terrainFile).toBe('mars_terrain.glb') // unchanged
  })
})

// ─── Tiles ────────────────────────────────────────────────────────────────────

describe('useMapEditorStore — tiles', () => {
  it('all tiles start as empty (0)', () => {
    const { tiles } = useMapEditorStore.getState()
    expect(tiles.length).toBe(10000)
    expect(tiles.every(v => v === 0)).toBe(true)
  })

  it('setTile sets correct index', () => {
    act(() => useMapEditorStore.getState().setTile(5, 3, 'build'))
    const { tiles } = useMapEditorStore.getState()
    expect(tiles[3 * 100 + 5]).toBe(1) // build = 1
  })

  it('getTileType returns correct type', () => {
    act(() => useMapEditorStore.getState().setTile(10, 10, 'resource'))
    expect(useMapEditorStore.getState().getTileType(10, 10)).toBe('resource')
    expect(useMapEditorStore.getState().getTileType(0, 0)).toBe('empty')
  })

  it('paintTiles sets multiple tiles', () => {
    const coords: [number, number][] = [[0,0],[1,0],[2,0]]
    act(() => useMapEditorStore.getState().paintTiles(coords, 'blocked'))
    const { tiles } = useMapEditorStore.getState()
    expect(tiles[0]).toBe(3)
    expect(tiles[1]).toBe(3)
    expect(tiles[2]).toBe(3)
    expect(tiles[3]).toBe(0)
  })

  it('paintTiles ignores out-of-bounds coords', () => {
    expect(() => {
      act(() => useMapEditorStore.getState().paintTiles([[-1, 0], [0, 200]], 'build'))
    }).not.toThrow()
  })
})

// ─── Build Nodes ──────────────────────────────────────────────────────────────

describe('useMapEditorStore — buildNodes', () => {
  it('addBuildNode adds a node', () => {
    act(() => useMapEditorStore.getState().addBuildNode({
      id: 'b1', pos: [10, 20], footprint: [3, 3], allowedTypes: ['colony'],
    }))
    expect(useMapEditorStore.getState().buildNodes).toHaveLength(1)
    expect(useMapEditorStore.getState().buildNodes[0].id).toBe('b1')
  })

  it('updateBuildNode patches node', () => {
    act(() => useMapEditorStore.getState().addBuildNode({
      id: 'b1', pos: [10, 20], footprint: [3, 3], allowedTypes: ['colony'],
    }))
    act(() => useMapEditorStore.getState().updateBuildNode('b1', { footprint: [5, 5] }))
    expect(useMapEditorStore.getState().buildNodes[0].footprint).toEqual([5, 5])
    expect(useMapEditorStore.getState().buildNodes[0].allowedTypes).toEqual(['colony'])
  })

  it('removeBuildNode removes correct node', () => {
    act(() => {
      useMapEditorStore.getState().addBuildNode({ id: 'b1', pos: [0,0], footprint: [3,3], allowedTypes: ['colony'] })
      useMapEditorStore.getState().addBuildNode({ id: 'b2', pos: [5,5], footprint: [2,2], allowedTypes: ['greenhouse'] })
    })
    act(() => useMapEditorStore.getState().removeBuildNode('b1'))
    const nodes = useMapEditorStore.getState().buildNodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('b2')
  })
})

// ─── Resource Nodes ───────────────────────────────────────────────────────────

describe('useMapEditorStore — resourceNodes', () => {
  it('addResourceNode adds a node', () => {
    act(() => useMapEditorStore.getState().addResourceNode({
      id: 'r1', type: 'ice', pos: [30, 40], amount: 2000, richness: 'high', model: 'ice_pile',
    }))
    const nodes = useMapEditorStore.getState().resourceNodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ice')
    expect(nodes[0].amount).toBe(2000)
  })

  it('updateResourceNode patches richness', () => {
    act(() => useMapEditorStore.getState().addResourceNode({
      id: 'r1', type: 'minerals', pos: [0,0], amount: 500, richness: 'low', model: 'm',
    }))
    act(() => useMapEditorStore.getState().updateResourceNode('r1', { richness: 'high', amount: 3000 }))
    const node = useMapEditorStore.getState().resourceNodes[0]
    expect(node.richness).toBe('high')
    expect(node.amount).toBe(3000)
  })
})

// ─── Spawn Points ─────────────────────────────────────────────────────────────

describe('useMapEditorStore — spawnPoints', () => {
  it('addSpawnPoint adds a spawn', () => {
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [5, 5] }))
    expect(useMapEditorStore.getState().spawnPoints).toHaveLength(1)
  })

  it('addSpawnPoint replaces existing player spawn', () => {
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [5, 5] }))
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [10, 10] }))
    const spawns = useMapEditorStore.getState().spawnPoints
    expect(spawns).toHaveLength(1)
    expect(spawns[0].pos).toEqual([10, 10])
  })

  it('removeSpawnPoint removes correct player', () => {
    act(() => {
      useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [5, 5] })
      useMapEditorStore.getState().addSpawnPoint({ player: 2, pos: [90, 90] })
    })
    act(() => useMapEditorStore.getState().removeSpawnPoint(1))
    const spawns = useMapEditorStore.getState().spawnPoints
    expect(spawns).toHaveLength(1)
    expect(spawns[0].player).toBe(2)
  })
})

// ─── Undo ─────────────────────────────────────────────────────────────────────

describe('useMapEditorStore — undo', () => {
  it('undo restores previous tile state', () => {
    // paintTiles calls pushUndo internally
    act(() => useMapEditorStore.getState().paintTiles([[0,0],[1,0]], 'build'))
    expect(useMapEditorStore.getState().tiles[0]).toBe(1)

    act(() => useMapEditorStore.getState().undo())
    expect(useMapEditorStore.getState().tiles[0]).toBe(0)
  })

  it('undo does nothing on empty stack', () => {
    expect(() => {
      act(() => useMapEditorStore.getState().undo())
    }).not.toThrow()
  })
})

// ─── Export / Import ──────────────────────────────────────────────────────────

describe('useMapEditorStore — export/import', () => {
  it('exportToJSON returns correct schema shape', () => {
    const json = useMapEditorStore.getState().exportToJSON()
    expect(json).toHaveProperty('meta')
    expect(json).toHaveProperty('buildNodes')
    expect(json).toHaveProperty('resourceNodes')
    expect(json).toHaveProperty('spawnPoints')
    expect(json).toHaveProperty('decor')
    expect(json).toHaveProperty('blockedTiles')
    expect(typeof json.blockedTiles).toBe('string')
  })

  it('loadFromJSON + exportToJSON roundtrip preserves data', () => {
    act(() => {
      useMapEditorStore.getState().addBuildNode({ id: 'b1', pos: [10,10], footprint: [3,3], allowedTypes: ['colony'] })
      useMapEditorStore.getState().addResourceNode({ id: 'r1', type: 'ice', pos: [50,50], amount: 1500, richness: 'high', model: 'ice' })
      useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [5,5] })
      useMapEditorStore.getState().paintTiles([[20,20]], 'blocked')
    })

    const exported = useMapEditorStore.getState().exportToJSON()

    act(() => useMapEditorStore.getState().resetMap())
    act(() => useMapEditorStore.getState().loadFromJSON(exported))

    const state = useMapEditorStore.getState()
    expect(state.buildNodes).toHaveLength(1)
    expect(state.buildNodes[0].id).toBe('b1')
    expect(state.resourceNodes[0].type).toBe('ice')
    expect(state.spawnPoints[0].player).toBe(1)
    expect(state.getTileType(20, 20)).toBe('blocked')
  })

  it('loadFromJSON handles corrupt blockedTiles gracefully', () => {
    expect(() => {
      act(() => useMapEditorStore.getState().loadFromJSON({
        meta: { name: 'x', description: '', size: [100,100], tileSize: 1, players: 2, terrainFile: 'x.glb', seed: null },
        buildNodes: [], resourceNodes: [], spawnPoints: [], decor: [],
        blockedTiles: '!!!invalid base64!!!',
      }))
    }).not.toThrow()
  })
})

// ─── UI state ─────────────────────────────────────────────────────────────────

describe('useMapEditorStore — UI state', () => {
  it('setActiveTool updates tool', () => {
    act(() => useMapEditorStore.getState().setActiveTool('blocked'))
    expect(useMapEditorStore.getState().activeTool).toBe('blocked')
  })

  it('toggleGrid flips showGrid', () => {
    const before = useMapEditorStore.getState().showGrid
    act(() => useMapEditorStore.getState().toggleGrid())
    expect(useMapEditorStore.getState().showGrid).toBe(!before)
  })

  it('setBrushSize updates brushSize', () => {
    act(() => useMapEditorStore.getState().setBrushSize(5))
    expect(useMapEditorStore.getState().brushSize).toBe(5)
  })
})
