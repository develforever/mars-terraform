import { describe, it, expect } from 'vitest'
import { validateMap } from './utils/validateMap'
import type { MapExportJSON } from '../../domain/mapEditorTypes'

const BASE_MAP: MapExportJSON = {
  meta: { name: 'test', description: '', size: [100, 100], tileSize: 1, players: 2, terrainFile: 'x.glb', seed: null },
  buildNodes: [{ id: 'b1', pos: [10, 10], footprint: [3, 3], allowedTypes: ['colony'] }],
  resourceNodes: [{ id: 'r1', type: 'minerals', pos: [50, 50], amount: 1000, richness: 'med', model: 'm' }],
  spawnPoints: [{ player: 1, pos: [5, 5] }, { player: 2, pos: [90, 90] }],
  decor: [],
  blockedTiles: btoa(new Array(10000).fill(0).map(String).join('').slice(0, 10000)),
}

describe('validateMap', () => {
  it('valid map returns no errors', () => {
    const result = validateMap(BASE_MAP)
    expect(result.valid).toBe(true)
    expect(result.errors.filter(e => e.level === 'error')).toHaveLength(0)
  })

  it('empty map name is an error', () => {
    const result = validateMap({ ...BASE_MAP, meta: { ...BASE_MAP.meta, name: '  ' } })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('name'))).toBe(true)
  })

  it('missing spawn points for players count is an error', () => {
    const result = validateMap({ ...BASE_MAP, spawnPoints: [{ player: 1, pos: [5, 5] }] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('spawn'))).toBe(true)
  })

  it('duplicate spawn players is an error', () => {
    const result = validateMap({
      ...BASE_MAP,
      spawnPoints: [{ player: 1, pos: [5, 5] }, { player: 1, pos: [90, 90] }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true)
  })

  it('out-of-bounds build node is an error', () => {
    const result = validateMap({
      ...BASE_MAP,
      buildNodes: [{ id: 'b1', pos: [150, 10], footprint: [3, 3], allowedTypes: ['colony'] }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('out of map bounds'))).toBe(true)
  })

  it('no build nodes is a warning not error', () => {
    const result = validateMap({ ...BASE_MAP, buildNodes: [] })
    expect(result.valid).toBe(true)
    expect(result.errors.some(e => e.level === 'warning' && e.message.includes('build nodes'))).toBe(true)
  })

  it('no resource nodes is a warning not error', () => {
    const result = validateMap({ ...BASE_MAP, resourceNodes: [] })
    expect(result.valid).toBe(true)
    expect(result.errors.some(e => e.level === 'warning' && e.message.includes('resource nodes'))).toBe(true)
  })

  it('invalid players count is an error', () => {
    const result = validateMap({ ...BASE_MAP, meta: { ...BASE_MAP.meta, players: 5 } })
    expect(result.valid).toBe(false)
  })
})
