import { describe, it, expect } from 'vitest'
import { AIMapGeneratorService } from './AIMapGeneratorService'
import { parseMapJSON } from '../../presentation/generator/schema/mapSchema'
import type { MapExportJSON } from '../mapEditorTypes'

describe('AIMapGeneratorService', () => {
  it('throws error when prompt is empty or whitespace', async () => {
    await expect(AIMapGeneratorService.generateFromPrompt('')).rejects.toThrow('Prompt cannot be empty')
    await expect(AIMapGeneratorService.generateFromPrompt('   ')).rejects.toThrow('Prompt cannot be empty')
  })

  // ─── Full Generation Archetypes ─────────────────────────────────────────────

  describe('Full Map Generation Archetypes', () => {
    it('generates Ice Crater archetype with heavy ice deposits', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Krater lodowy z potężnymi złożami wody i mroźnymi wyżynami',
        { radius: 15, seed: 1234 }
      )

      expect(result.mapData.meta.version).toBe('2.0')
      expect(result.mapData.meta.hexRadius).toBe(15)
      expect(result.mapData.hexes.length).toBeGreaterThan(0)

      const iceDeposits = result.mapData.resourceNodes.filter(r => r.type === 'ice')
      expect(iceDeposits.length).toBeGreaterThanOrEqual(4)

      const deepCraters = result.mapData.hexes.filter(h => h.terrainType === 'deep_crater')
      expect(deepCraters.length).toBeGreaterThan(0)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('generates Canyon Valley archetype', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Głęboka dolina kanionu przecinająca skaliste wyżyny i szczyty',
        { radius: 12, seed: 4321 }
      )

      expect(result.mapData.meta.name).toBe('canyon_valley_ai')
      const lowlands = result.mapData.hexes.filter(h => h.terrainType === 'lowland' || h.terrainType === 'deep_crater')
      const rocky = result.mapData.hexes.filter(h => h.terrainType === 'rocky' || h.terrainType === 'highland')

      expect(lowlands.length).toBeGreaterThan(0)
      expect(rocky.length).toBeGreaterThan(0)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('generates Symmetric 1v1 Arena archetype with balanced 2 player spawns', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Symetryczna arena 1v1 turniejowa dla 2 graczy',
        { radius: 14, players: 2, seed: 777 }
      )

      expect(result.mapData.spawnPoints).toHaveLength(2)
      const [s1, s2] = result.mapData.spawnPoints
      expect(s1.player).toBe(1)
      expect(s2.player).toBe(2)
      // Mirror opposite axial coordinates
      expect(s1.pos[0] + s2.pos[0]).toBe(0)
      expect(s1.pos[1] + s2.pos[1]).toBe(0)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('generates Volcanic Caldera archetype', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Masywna wulkaniczna kaldera z gorącym kotłem w centrum',
        { radius: 12, seed: 888 }
      )

      expect(result.mapData.meta.name).toBe('volcanic_caldera_ai')
      const deepCraters = result.mapData.hexes.filter(h => h.terrainType === 'deep_crater')
      const peaks = result.mapData.hexes.filter(h => h.terrainType === 'peak')

      expect(deepCraters.length).toBeGreaterThan(0)
      expect(peaks.length).toBeGreaterThan(0)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('generates Green Oasis archetype with rich organics', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Zielona oaza na Marsie z obfitą biomasą i wodą',
        { radius: 10, seed: 999 }
      )

      expect(result.mapData.meta.name).toBe('mars_oasis_ai')
      const organics = result.mapData.resourceNodes.filter(r => r.type === 'organics')
      expect(organics.length).toBeGreaterThan(0)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('is deterministic with same seed', async () => {
      const resA = await AIMapGeneratorService.generateFromPrompt('Krater lodowy', { radius: 10, seed: 555 })
      const resB = await AIMapGeneratorService.generateFromPrompt('Krater lodowy', { radius: 10, seed: 555 })

      expect(resA.mapData).toEqual(resB.mapData)
    })
  })

  // ─── Selective Modifications on Current Map ─────────────────────────────────

  describe('Selective Modifications', () => {
    const baseMap: MapExportJSON = {
      meta: {
        name: 'base_test_map',
        description: 'Test',
        version: '2.0',
        gridType: 'hex-flat-top',
        hexSize: 1.0,
        hexRadius: 10,
        players: 2,
        seed: 42,
      },
      hexes: [
        { q: 0, r: 0, terrainType: 'lowland', userType: null, decor: null },
        { q: 1, r: 0, terrainType: 'lowland', userType: null, decor: null },
        { q: 2, r: 0, terrainType: 'lowland', userType: null, decor: null },
        { q: -5, r: 0, terrainType: 'plains', userType: null, decor: null },
        { q: -6, r: 0, terrainType: 'plains', userType: null, decor: null },
        { q: 5, r: 0, terrainType: 'plains', userType: null, decor: null },
      ],
      buildNodes: [],
      resourceNodes: [],
      spawnPoints: [{ player: 1, pos: [-5, 0] }, { player: 2, pos: [5, 0] }],
      decor: [{ model: 'rock_01', pos: [0, 0], rot: 0, scale: 1 }],
    }

    it('adds ice resources on lowlands when requested', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Dodaj 3 złoża lodu na nizinach',
        { currentMap: baseMap, seed: 100 }
      )

      const iceNodes = result.mapData.resourceNodes.filter(r => r.type === 'ice')
      expect(iceNodes.length).toBeGreaterThanOrEqual(1)
      expect(result.operationsApplied.some(op => op.includes('lodu') || op.includes('ice'))).toBe(true)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('raises terrain in the west', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Podnieś teren na zachodzie',
        { currentMap: baseMap, seed: 200 }
      )

      const westHex = result.mapData.hexes.find(h => h.q === -6 && h.r === 0)
      expect(westHex).toBeDefined()
      // Was 'plains', elevated to 'highland'
      expect(westHex?.terrainType).toBe('highland')

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('smooths cliffs around spawn bases', async () => {
      const mapWithCliffBase: MapExportJSON = {
        ...baseMap,
        hexes: [
          ...baseMap.hexes,
          { q: -4, r: 0, terrainType: 'peak', userType: null, decor: null },
          { q: -5, r: 1, terrainType: 'deep_crater', userType: null, decor: null },
        ],
      }

      const result = await AIMapGeneratorService.generateFromPrompt(
        'Wygładź klify wokół bazy i wyrównaj teren przy spawnach',
        { currentMap: mapWithCliffBase, seed: 300 }
      )

      const adjacentToSpawn = result.mapData.hexes.find(h => h.q === -4 && h.r === 0)
      expect(adjacentToSpawn?.terrainType).toBe('plains')

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })

    it('clears all decor when requested', async () => {
      const result = await AIMapGeneratorService.generateFromPrompt(
        'Usuń wszystkie dekoracje i skały z mapy',
        { currentMap: baseMap, seed: 400 }
      )

      expect(result.mapData.decor).toHaveLength(0)
      expect(result.operationsApplied.some(op => op.includes('dekoracyjne'))).toBe(true)

      const validation = parseMapJSON(result.mapData)
      expect(validation.ok).toBe(true)
    })
  })
})
