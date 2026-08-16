import { describe, it, expect } from 'vitest'
import { parseMapJSON } from './mapSchema'

const valid = {
  meta: {
    name: 'm', description: '', version: '2.0', gridType: 'hex-flat-top',
    hexSize: 1.2, hexRadius: 5, players: 2, seed: 42,
  },
  hexes: [{ q: 0, r: 0, terrainType: 'plains', userType: null, decor: null }],
  buildNodes: [{ id: 'b1', pos: [1, 0], footprint: [1, 1], allowedTypes: ['colony'] }],
  resourceNodes: [{ id: 'r1', type: 'minerals', pos: [0, 1], amount: 1000, richness: 'med', model: 'm1' }],
  spawnPoints: [{ player: 1, pos: [2, 0] }],
  decor: [{ model: 'rock_01', pos: [1, 1], rot: 0.5, scale: 1 }],
}

describe('parseMapJSON', () => {
  it('akceptuje poprawny plik v2.0', () => {
    const r = parseMapJSON(valid)
    expect(r.ok).toBe(true)
    expect(r.data?.meta.name).toBe('m')
  })

  it('odrzuca zly typ terenu', () => {
    const bad = structuredClone(valid)
    bad.hexes[0].terrainType = 'lava'
    const r = parseMapJSON(bad)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('terrainType')
  })

  it('odrzuca zla wersje', () => {
    const bad = structuredClone(valid)
    bad.meta.version = '1.0'
    expect(parseMapJSON(bad).ok).toBe(false)
  })

  it('odrzuca players poza 1..4', () => {
    const bad = structuredClone(valid)
    bad.meta.players = 9
    expect(parseMapJSON(bad).ok).toBe(false)
  })

  it('odrzuca brak sekcji / smieci', () => {
    expect(parseMapJSON({}).ok).toBe(false)
    expect(parseMapJSON(null).ok).toBe(false)
    expect(parseMapJSON('nope').ok).toBe(false)
  })

  it('odrzuca zly ksztalt pos', () => {
    const bad = structuredClone(valid)
    ;(bad.spawnPoints[0] as { pos: unknown }).pos = [1, 2, 3]
    expect(parseMapJSON(bad).ok).toBe(false)
  })
})
