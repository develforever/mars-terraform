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
    expect(meta.players).toBe(2)
  })

  it('updateMeta patches partial fields', () => {
    act(() => useMapEditorStore.getState().updateMeta({ name: 'test_map', players: 4 }))
    const { meta } = useMapEditorStore.getState()
    expect(meta.name).toBe('test_map')
    expect(meta.players).toBe(4)
  })
})

// ─── Hex grid ─────────────────────────────────────────────────────────────────

describe('useMapEditorStore — hexGrid', () => {
  it('generates hex grid on resetMap', () => {
    const { hexGrid } = useMapEditorStore.getState()
    expect(hexGrid).not.toBeNull()
    expect(hexGrid!.getCellCount()).toBeGreaterThan(0)
  })

  it('all cells start as plains', () => {
    const { hexGrid } = useMapEditorStore.getState()
    for (const cell of hexGrid!.getAllCells()) {
      expect(cell.terrainType).toBe('plains')
      expect(cell.userType).toBeNull()
    }
  })

  it('generateHexGrid respects radius', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    const { hexGrid } = useMapEditorStore.getState()
    expect(hexGrid!.getCellCount()).toBe(91) // 3*5*6+1
  })

  it('setHexUserType paints a hex', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    act(() => useMapEditorStore.getState().setHexUserType(0, 0, 'build'))
    const { hexGrid } = useMapEditorStore.getState()
    expect(hexGrid!.getCell(0, 0)!.userType).toBe('build')
  })

  it('paintHexes paints multiple hexes', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    act(() => useMapEditorStore.getState().paintHexes([[0,0],[1,0],[0,1]], 'build'))
    const { hexGrid } = useMapEditorStore.getState()
    expect(hexGrid!.getCell(0, 0)!.userType).toBe('build')
    expect(hexGrid!.getCell(1, 0)!.userType).toBe('build')
    expect(hexGrid!.getCell(0, 1)!.userType).toBe('build')
  })

  it('setHexTerrainType changes terrain', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    act(() => useMapEditorStore.getState().setHexTerrainType(0, 0, 'rocky'))
    const { hexGrid } = useMapEditorStore.getState()
    expect(hexGrid!.getCell(0, 0)!.terrainType).toBe('rocky')
  })
})

// ─── Hex selection ────────────────────────────────────────────────────────────

describe('useMapEditorStore — hex selection', () => {
  it('selectHex sets selectedHex', () => {
    act(() => useMapEditorStore.getState().selectHex(3, -2))
    expect(useMapEditorStore.getState().selectedHex).toEqual({ q: 3, r: -2 })
  })

  it('clearSelection clears both selectedHex and selectedNodeId', () => {
    act(() => {
      useMapEditorStore.getState().selectHex(1, 1)
      useMapEditorStore.getState().setSelectedNodeId('b1')
    })
    act(() => useMapEditorStore.getState().clearSelection())
    expect(useMapEditorStore.getState().selectedHex).toBeNull()
    expect(useMapEditorStore.getState().selectedNodeId).toBeNull()
  })
})

// ─── Build Nodes ──────────────────────────────────────────────────────────────

describe('useMapEditorStore — buildNodes', () => {
  it('addBuildNode adds a node', () => {
    act(() => useMapEditorStore.getState().addBuildNode({
      id: 'b1', pos: [3, -2], footprint: [1, 1], allowedTypes: ['colony'],
    }))
    expect(useMapEditorStore.getState().buildNodes).toHaveLength(1)
    expect(useMapEditorStore.getState().buildNodes[0].id).toBe('b1')
  })

  it('updateBuildNode patches node', () => {
    act(() => useMapEditorStore.getState().addBuildNode({
      id: 'b1', pos: [0, 0], footprint: [1, 1], allowedTypes: ['colony'],
    }))
    act(() => useMapEditorStore.getState().updateBuildNode('b1', { footprint: [2, 2] }))
    expect(useMapEditorStore.getState().buildNodes[0].footprint).toEqual([2, 2])
  })

  it('removeBuildNode removes correct node', () => {
    act(() => {
      useMapEditorStore.getState().addBuildNode({ id: 'b1', pos: [0,0], footprint: [1,1], allowedTypes: ['colony'] })
      useMapEditorStore.getState().addBuildNode({ id: 'b2', pos: [1,0], footprint: [1,1], allowedTypes: ['greenhouse'] })
    })
    act(() => useMapEditorStore.getState().removeBuildNode('b1'))
    const nodes = useMapEditorStore.getState().buildNodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('b2')
  })
})

// ─── Spawn Points ─────────────────────────────────────────────────────────────

describe('useMapEditorStore — spawnPoints', () => {
  it('addSpawnPoint adds a spawn', () => {
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [-10, 10] }))
    expect(useMapEditorStore.getState().spawnPoints).toHaveLength(1)
  })

  it('addSpawnPoint replaces existing player spawn', () => {
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [5, 5] }))
    act(() => useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [-5, -5] }))
    const spawns = useMapEditorStore.getState().spawnPoints
    expect(spawns).toHaveLength(1)
    expect(spawns[0].pos).toEqual([-5, -5])
  })
})

// ─── Undo ─────────────────────────────────────────────────────────────────────

describe('useMapEditorStore — undo', () => {
  it('undo restores previous hex userType', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    act(() => useMapEditorStore.getState().setHexUserType(0, 0, 'build'))
    expect(useMapEditorStore.getState().hexGrid!.getCell(0, 0)!.userType).toBe('build')

    act(() => useMapEditorStore.getState().undo())
    expect(useMapEditorStore.getState().hexGrid!.getCell(0, 0)!.userType).toBeNull()
  })

  it('undo does nothing on empty stack', () => {
    expect(() => {
      act(() => useMapEditorStore.getState().undo())
    }).not.toThrow()
  })
})

// ─── Export / Import ──────────────────────────────────────────────────────────

describe('useMapEditorStore — export/import', () => {
  it('exportToJSON returns correct v2 schema', () => {
    act(() => useMapEditorStore.getState().generateHexGrid(5))
    const json = useMapEditorStore.getState().exportToJSON()
    expect(json.meta.version).toBe('2.0')
    expect(json.meta.gridType).toBe('hex-flat-top')
    expect(Array.isArray(json.hexes)).toBe(true)
    expect(json.hexes.length).toBeGreaterThan(0)
    expect(json).toHaveProperty('buildNodes')
    expect(json).toHaveProperty('spawnPoints')
  })

  it('loadFromJSON v2 roundtrip preserves data', () => {
    act(() => {
      useMapEditorStore.getState().generateHexGrid(5)
      useMapEditorStore.getState().setHexTerrainType(0, 0, 'rocky')
      useMapEditorStore.getState().setHexUserType(0, 0, 'build')
      useMapEditorStore.getState().addBuildNode({ id: 'b1', pos: [0,0], footprint: [1,1], allowedTypes: ['colony'] })
      useMapEditorStore.getState().addSpawnPoint({ player: 1, pos: [-3, 3] })
    })

    const exported = useMapEditorStore.getState().exportToJSON()

    act(() => useMapEditorStore.getState().resetMap())
    act(() => useMapEditorStore.getState().loadFromJSON(exported))

    const state = useMapEditorStore.getState()
    expect(state.buildNodes).toHaveLength(1)
    expect(state.spawnPoints[0].player).toBe(1)
    expect(state.hexGrid!.getCell(0, 0)!.terrainType).toBe('rocky')
    expect(state.hexGrid!.getCell(0, 0)!.userType).toBe('build')
  })
})

// ─── UI state ─────────────────────────────────────────────────────────────────

describe('useMapEditorStore — UI state', () => {
  it('setActiveTool updates tool', () => {
    act(() => useMapEditorStore.getState().setActiveTool('decor'))
    expect(useMapEditorStore.getState().activeTool).toBe('decor')
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

  it('setHexRadius updates hexRadius', () => {
    act(() => useMapEditorStore.getState().setHexRadius(15))
    expect(useMapEditorStore.getState().hexRadius).toBe(15)
  })
})


// ─── Round-trip eksport/import ────────────────────────────────────────────────

describe('useMapEditorStore — round-trip export/import', () => {
  it('export -> reset -> import -> export daje identyczny JSON', () => {
    const s = () => useMapEditorStore.getState()

    act(() => {
      s().generateHexGrid(5, 7)
      s().updateMeta({ name: 'rt_map', description: 'opis', players: 3 })
      s().paintHexTerrainType([[0, 0], [1, 0]], 'peak')
      s().paintHexTerrainType([[-1, 0]], 'deep_crater')
      s().paintHexTerrainType([[0, 1]], 'highland')
      s().addBuildNode({ id: 'b1', pos: [2, 0], footprint: [1, 1], allowedTypes: ['colony', 'greenhouse'] })
      s().addResourceNode({ id: 'r1', type: 'minerals', pos: [0, 2], amount: 1500, richness: 'high', model: 'mineral_pile_01' })
      s().addSpawnPoint({ player: 1, pos: [3, 0] })
      s().addSpawnPoint({ player: 2, pos: [-3, 0] })
      s().addDecor({ model: 'rock_01', pos: [1, 1], rot: 0.5, scale: 1.2 })
    })

    const exportA = s().exportToJSON()

    // Symulacja: nowa sesja wczytuje plik
    act(() => {
      s().resetMap()
      s().loadFromJSON(exportA)
    })

    const exportB = s().exportToJSON()

    expect(exportB).toEqual(exportA)
  })

  it('odtwarza meta, teren, wezly i decor po imporcie', () => {
    const s = () => useMapEditorStore.getState()

    act(() => {
      s().generateHexGrid(4, 11)
      s().updateMeta({ name: 'check', description: 'd', players: 2 })
      s().paintHexTerrainType([[0, 0]], 'rocky')
      s().addResourceNode({ id: 'r9', type: 'ice', pos: [1, 0], amount: 800, richness: 'low', model: 'ice_01' })
      s().addDecor({ model: 'rock_01', pos: [0, 1], rot: 1.0, scale: 0.8 })
    })
    const exp = s().exportToJSON()

    act(() => { s().resetMap(); s().loadFromJSON(exp) })

    const st = s()
    expect(st.meta.name).toBe('check')
    expect(st.meta.players).toBe(2)
    expect(st.resourceNodes).toHaveLength(1)
    expect(st.resourceNodes[0].type).toBe('ice')
    expect(st.resourceNodes[0].amount).toBe(800)
    expect(st.decor).toHaveLength(1)
    expect(st.decor[0].scale).toBeCloseTo(0.8, 5)
    expect(st.hexGrid?.getCell(0, 0)?.terrainType).toBe('rocky')
  })
})

// ─── Decor & Resource Node updates ───────────────────────────────────────────

describe('useMapEditorStore — decor & resource node modifications', () => {
  it('updateDecorAt patches model, scale, and rot for decor item', () => {
    const s = () => useMapEditorStore.getState()

    act(() => {
      s().addDecor({ model: 'rock_01', pos: [2, 3], rot: 0, scale: 1.0 })
    })

    expect(s().decor[0]).toEqual({ model: 'rock_01', pos: [2, 3], rot: 0, scale: 1.0 })

    act(() => {
      s().updateDecorAt(2, 3, { model: 'crystal', scale: 1.8, rot: Math.PI })
    })

    const updated = s().decor.find(d => d.pos[0] === 2 && d.pos[1] === 3)
    expect(updated).toBeDefined()
    expect(updated?.model).toBe('crystal')
    expect(updated?.scale).toBe(1.8)
    expect(updated?.rot).toBe(Math.PI)
  })

  it('updateDecorAt does nothing if decor does not exist', () => {
    const s = () => useMapEditorStore.getState()
    act(() => {
      s().addDecor({ model: 'rock_01', pos: [2, 3], rot: 0, scale: 1.0 })
    })

    act(() => {
      s().updateDecorAt(99, 99, { model: 'boulder' })
    })

    expect(s().decor).toHaveLength(1)
    expect(s().decor[0].model).toBe('rock_01')
  })

  it('undo restores decor properties before updateDecorAt', () => {
    const s = () => useMapEditorStore.getState()
    act(() => {
      s().addDecor({ model: 'rock_01', pos: [0, 0], rot: 0, scale: 1.0 })
    })
    act(() => {
      s().updateDecorAt(0, 0, { model: 'wreck', scale: 2.0 })
    })
    expect(s().decor[0].model).toBe('wreck')
    expect(s().decor[0].scale).toBe(2.0)

    act(() => {
      s().undo()
    })

    expect(s().decor[0].model).toBe('rock_01')
    expect(s().decor[0].scale).toBe(1.0)
  })

  it('updateResourceNode updates 3D model variant and resource type', () => {
    const s = () => useMapEditorStore.getState()
    act(() => {
      s().addResourceNode({ id: 'r1', type: 'minerals', pos: [1, 1], amount: 1000, richness: 'med', model: 'mineral_pile_01' })
    })

    act(() => {
      s().updateResourceNode('r1', { model: 'crystal_cluster_01' })
    })
    expect(s().resourceNodes[0].model).toBe('crystal_cluster_01')

    act(() => {
      s().updateResourceNode('r1', { type: 'ice', model: 'ice_spire_01' })
    })
    expect(s().resourceNodes[0].type).toBe('ice')
    expect(s().resourceNodes[0].model).toBe('ice_spire_01')
  })
})

