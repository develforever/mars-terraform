import { describe, it, expect } from 'vitest'
import { validateMap } from './utils/validateMap'
import type { MapExportJSON } from '../../domain/mapEditorTypes'

const BASE_MAP: MapExportJSON = {
  meta: {
    name: 'test',
    description: '',
    version: '2.0',
    gridType: 'hex-flat-top',
    hexSize: 1.2,
    hexRadius: 20,
    players: 2,
    seed: 42,
  },
  hexes: [],
  buildNodes: [{ id: 'b1', pos: [0, 0], footprint: [1, 1], allowedTypes: ['colony'] }],
  resourceNodes: [{ id: 'r1', type: 'minerals', pos: [3, -2], amount: 1000, richness: 'med', model: 'm' }],
  spawnPoints: [{ player: 1, pos: [-15, 10] }, { player: 2, pos: [15, -10] }],
  decor: [],
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
    const result = validateMap({ ...BASE_MAP, spawnPoints: [{ player: 1, pos: [-15, 10] }] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('spawn'))).toBe(true)
  })

  it('duplicate spawn players is an error', () => {
    const result = validateMap({
      ...BASE_MAP,
      spawnPoints: [{ player: 1, pos: [-15, 10] }, { player: 1, pos: [15, -10] }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true)
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


// ─── Nowe reguly ──────────────────────────────────────────────────────────────

const withHexes = (extra: Partial<MapExportJSON>): MapExportJSON => ({
  ...BASE_MAP,
  hexes: [
    { q: 0, r: 0, terrainType: 'plains', userType: null, decor: null },
    { q: 5, r: 0, terrainType: 'plains', userType: null, decor: null },
    { q: -5, r: 0, terrainType: 'plains', userType: null, decor: null },
  ],
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [{ player: 1, pos: [0, 0] }, { player: 2, pos: [5, 0] }],
  ...extra,
})

describe('validateMap — nowe reguly', () => {
  it('wezel poza mapa to error', () => {
    const r = validateMap(withHexes({ spawnPoints: [{ player: 1, pos: [99, 99] }, { player: 2, pos: [5, 0] }] }))
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.message.includes('outside the map'))).toBe(true)
  })

  it('spawny zbyt blisko to warning (nie error)', () => {
    const r = validateMap(withHexes({
      hexes: [
        { q: 0, r: 0, terrainType: 'plains', userType: null, decor: null },
        { q: 1, r: 0, terrainType: 'plains', userType: null, decor: null },
      ],
      spawnPoints: [{ player: 1, pos: [0, 0] }, { player: 2, pos: [1, 0] }],
    }))
    expect(r.valid).toBe(true)
    expect(r.errors.some(e => e.level === 'warning' && e.message.includes('very close'))).toBe(true)
  })

  it('poprawna mapa z hexes nie ma errorow', () => {
    const r = validateMap(withHexes({
      buildNodes: [{ id: 'b1', pos: [0, 0], footprint: [1, 1], allowedTypes: ['colony'] }],
      resourceNodes: [
        { id: 'r1', type: 'minerals', pos: [5, 0], amount: 1000, richness: 'med', model: 'm' },
        { id: 'r2', type: 'ice', pos: [0, 0], amount: 800, richness: 'low', model: 'm' },
      ],
    }))
    expect(r.errors.filter(e => e.level === 'error')).toHaveLength(0)
  })
})
