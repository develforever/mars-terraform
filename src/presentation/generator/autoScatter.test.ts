import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useMapEditorStore } from '../../application/store/useMapEditorStore'

beforeEach(() => {
  act(() => useMapEditorStore.getState().resetMap())
})

describe('autoScatter', () => {
  it('places correct number of rocks as decor', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 20, minerals: 0, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 1,
    }))
    expect(useMapEditorStore.getState().decor).toHaveLength(20)
  })

  it('places correct number of resource nodes', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 0, minerals: 5, ice: 3, organics: 2, energy: 1,
      clearExisting: true, seed: 42,
    }))
    const { resourceNodes } = useMapEditorStore.getState()
    const minerals = resourceNodes.filter(n => n.type === 'minerals')
    const ice = resourceNodes.filter(n => n.type === 'ice')
    expect(minerals).toHaveLength(5)
    expect(ice).toHaveLength(3)
    expect(resourceNodes).toHaveLength(11)
  })

  it('marks rock tiles as blocked in tile array', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 10, minerals: 0, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 7,
    }))
    const { tiles, decor } = useMapEditorStore.getState()
    for (const item of decor) {
      const [x, z] = item.pos
      expect(tiles[z * 100 + x]).toBe(3) // blocked
    }
  })

  it('marks resource tiles as resource in tile array', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 0, minerals: 5, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 99,
    }))
    const { tiles, resourceNodes } = useMapEditorStore.getState()
    for (const node of resourceNodes) {
      const [x, z] = node.pos
      expect(tiles[z * 100 + x]).toBe(2) // resource
    }
  })

  it('does not place two items on same tile', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 30, minerals: 10, ice: 5, organics: 5, energy: 5,
      clearExisting: true, seed: 123,
    }))
    const { decor, resourceNodes } = useMapEditorStore.getState()
    const positions = new Set<string>()
    for (const d of decor) positions.add(`${d.pos[0]},${d.pos[1]}`)
    for (const r of resourceNodes) {
      const key = `${r.pos[0]},${r.pos[1]}`
      expect(positions.has(key)).toBe(false)
      positions.add(key)
    }
  })

  it('clearExisting=false keeps existing nodes', () => {
    act(() => useMapEditorStore.getState().addResourceNode({
      id: 'pre', type: 'ice', pos: [5, 5], amount: 999, richness: 'high', model: 'x',
    }))
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 5, minerals: 3, ice: 0, organics: 0, energy: 0,
      clearExisting: false, seed: 1,
    }))
    const nodes = useMapEditorStore.getState().resourceNodes
    expect(nodes.some(n => n.id === 'pre')).toBe(true)
  })

  it('same seed produces deterministic results', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 10, minerals: 5, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 42,
    }))
    const decor1 = JSON.stringify(useMapEditorStore.getState().decor)

    act(() => useMapEditorStore.getState().resetMap())

    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 10, minerals: 5, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 42,
    }))
    const decor2 = JSON.stringify(useMapEditorStore.getState().decor)

    expect(decor1).toBe(decor2)
  })

  it('undo restores state before scatter', () => {
    act(() => useMapEditorStore.getState().autoScatter({
      rocks: 10, minerals: 5, ice: 0, organics: 0, energy: 0,
      clearExisting: true, seed: 1,
    }))
    expect(useMapEditorStore.getState().decor.length).toBeGreaterThan(0)

    act(() => useMapEditorStore.getState().undo())
    expect(useMapEditorStore.getState().decor).toHaveLength(0)
  })
})
