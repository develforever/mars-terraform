/**
 * AIMapGeneratorService.ts
 *
 * Domain service transforming natural language prompts (PL / EN) into valid MapExportJSON (v2.0).
 * Features:
 *  1. Archetype-based procedural generation (Ice Crater, Canyon Valley, Symmetric 1v1 Arena, Volcanic Caldera, Green Oasis, Mountain Range, Flat Plains).
 *  2. Selective map modification (Resource placement on specific terrains, directional height shifts, base smoothing, decor adjustments).
 *  3. Deterministic fallback heuristic NLP engine (100% offline-capable, robust to any prompt).
 *  4. Zod schema validation ensuring strict v2.0 map contract compliance.
 */

import type {
  MapExportJSON,
  ResourceNode,
  ResourceType,
  SpawnPoint,
  BuildNode,
  DecorItem,
  HexExportCell,
} from '../mapEditorTypes'
import { HexGrid, type HexTerrainType } from '../../presentation/generator/hex/HexGrid'
import { hexToWorld, hexDistance, hexRing, HEX_SIZE } from '../../presentation/generator/hex/HexMath'
import { parseMapJSON } from '../../presentation/generator/schema/mapSchema'
import { generateDecor, generateResources, generateSpawns, generateBuildNodes } from '../../presentation/generator/terrain/ProceduralPlacement'
import { applyProceduralTerrain } from '../../presentation/generator/terrain/ProceduralTerrain'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AIMapGenerateOptions {
  currentMap?: MapExportJSON | null
  radius?: number
  players?: number
  seed?: number
  apiUrl?: string
  apiKey?: string
  forceOffline?: boolean
}

export interface AIMapGenerationResult {
  mapData: MapExportJSON
  summary: string
  operationsApplied: string[]
  isFallback: boolean
}

// ─── Helpers: PRNG & String Normalization ─────────────────────────────────────

function makePrng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stringToSeed(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0) || 42
}

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const TERRAIN_ORDER: HexTerrainType[] = ['deep_crater', 'lowland', 'plains', 'highland', 'rocky', 'peak']

function elevateTerrain(current: HexTerrainType, steps = 1): HexTerrainType {
  const idx = TERRAIN_ORDER.indexOf(current)
  if (idx === -1) return 'plains'
  const newIdx = Math.min(TERRAIN_ORDER.length - 1, idx + steps)
  return TERRAIN_ORDER[newIdx]
}

function lowerTerrain(current: HexTerrainType, steps = 1): HexTerrainType {
  const idx = TERRAIN_ORDER.indexOf(current)
  if (idx === -1) return 'plains'
  const newIdx = Math.max(0, idx - steps)
  return TERRAIN_ORDER[newIdx]
}

// ─── AIMapGeneratorService ───────────────────────────────────────────────────

export class AIMapGeneratorService {
  /**
   * Main entry point: Generates or modifies a map based on a natural language prompt.
   */
  public static async generateFromPrompt(
    prompt: string,
    options?: AIMapGenerateOptions,
  ): Promise<AIMapGenerationResult> {
    const rawPrompt = prompt.trim()
    if (!rawPrompt) {
      throw new Error('Prompt cannot be empty')
    }

    const norm = normalizePrompt(rawPrompt)
    const baseSeed = options?.seed ?? (stringToSeed(rawPrompt) % 100000)
    const isModificationPrompt = AIMapGeneratorService.detectModificationIntent(norm, options?.currentMap)

    if (isModificationPrompt && options?.currentMap) {
      return AIMapGeneratorService.executeSelectiveModification(norm, rawPrompt, options.currentMap, baseSeed)
    }

    return AIMapGeneratorService.executeFullGeneration(norm, rawPrompt, options, baseSeed)
  }

  // ─── Intent Detection ────────────────────────────────────────────────────────

  private static detectModificationIntent(normalized: string, currentMap?: MapExportJSON | null): boolean {
    if (!currentMap) return false

    const modKeywords = [
      'dodaj', 'add', 'podnies', 'raise', 'podwyzsz', 'obniz', 'lower',
      'wygladz', 'smooth', 'wyrownaj', 'flatten', 'usun', 'remove', 'wyczysc', 'clear',
      'zmien', 'change', 'zwieksz', 'increase', 'zmniejsz', 'decrease', 'ulepsz',
    ]

    return modKeywords.some(kw => normalized.includes(kw))
  }

  // ─── Archetype Detection ────────────────────────────────────────────────────

  private static detectArchetype(normalized: string): 'ice_crater' | 'canyon_valley' | 'symmetric_arena' | 'volcanic_caldera' | 'oasis' | 'mountains' | 'plains' | 'procedural' {
    if (normalized.includes('lod') || normalized.includes('ice') || normalized.includes('glacier') || normalized.includes('zmarzl')) {
      return 'ice_crater'
    }
    if (normalized.includes('kanion') || normalized.includes('canyon') || normalized.includes('wawow') || normalized.includes('dolin') || normalized.includes('gorge')) {
      return 'canyon_valley'
    }
    if (normalized.includes('symetr') || normalized.includes('arena') || normalized.includes('1v1') || normalized.includes('turniej') || normalized.includes('balanced') || normalized.includes('duel')) {
      return 'symmetric_arena'
    }
    if (normalized.includes('wulkan') || normalized.includes('volcan') || normalized.includes('kalder') || normalized.includes('caldera') || normalized.includes('magm')) {
      return 'volcanic_caldera'
    }
    if (normalized.includes('oaz') || normalized.includes('oasis') || normalized.includes('zielon') || normalized.includes('green') || normalized.includes('organi')) {
      return 'oasis'
    }
    if (normalized.includes('gor') || normalized.includes('mountain') || normalized.includes('szczyt') || normalized.includes('peak') || normalized.includes('grani')) {
      return 'mountains'
    }
    if (normalized.includes('rownin') || normalized.includes('plain') || normalized.includes('plask') || normalized.includes('flat')) {
      return 'plains'
    }
    return 'procedural'
  }

  // ─── Full Generation ────────────────────────────────────────────────────────

  private static executeFullGeneration(
    normalized: string,
    rawPrompt: string,
    options: AIMapGenerateOptions | undefined,
    seed: number,
  ): AIMapGenerationResult {
    const radius = options?.radius ?? options?.currentMap?.meta.hexRadius ?? 20
    const players = options?.players ?? options?.currentMap?.meta.players ?? 2
    const archetype = AIMapGeneratorService.detectArchetype(normalized)
    const rng = makePrng(seed)

    const grid = new HexGrid(radius, seed)
    grid.generate()

    const operations: string[] = []
    let mapName = 'ai_generated_map'
    let description = `Generated from prompt: "${rawPrompt}"`

    switch (archetype) {
      case 'ice_crater': {
        mapName = 'ice_crater_ai'
        description = 'Lodowy krater z potężnymi złożami wody, otoczony mroźnymi wyżynami.'
        operations.push('Wygenerowano centralny krater uderzeniowy z lodowym dnem')
        operations.push('Uformowano wyniesiony wał krateru (highland/rocky)')

        const craterR = radius * 0.48
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r)
          if (dist < craterR * 0.6) {
            grid.setTerrainType(c.q, c.r, 'deep_crater')
          } else if (dist < craterR) {
            grid.setTerrainType(c.q, c.r, 'lowland')
          } else if (dist < craterR * 1.35) {
            grid.setTerrainType(c.q, c.r, rng() < 0.4 ? 'peak' : 'highland')
          } else {
            const r = rng()
            grid.setTerrainType(c.q, c.r, r < 0.65 ? 'plains' : r < 0.85 ? 'highland' : 'lowland')
          }
        }
        break
      }

      case 'canyon_valley': {
        mapName = 'canyon_valley_ai'
        description = 'Głęboki kanion przecinający skaliste wyżyny i szczyty marsjańskie.'
        operations.push('Wyrzeźbiono krętą dolinę kanionu przez środek mapy')
        operations.push('Otoczono kanion pasmami skalistymi i urwiskami')

        for (const c of grid.getAllCells()) {
          const [wx, wz] = hexToWorld(c.q, c.r)
          // Meandering canyon formula
          const canyonCenterZ = Math.sin(wx * 0.12) * (radius * HEX_SIZE * 0.35)
          const distToCanyon = Math.abs(wz - canyonCenterZ)
          const canyonWidth = radius * HEX_SIZE * 0.22

          if (distToCanyon < canyonWidth * 0.5) {
            grid.setTerrainType(c.q, c.r, 'lowland')
          } else if (distToCanyon < canyonWidth) {
            grid.setTerrainType(c.q, c.r, 'deep_crater')
          } else if (distToCanyon < canyonWidth * 1.6) {
            grid.setTerrainType(c.q, c.r, 'rocky')
          } else if (distToCanyon < canyonWidth * 2.4) {
            grid.setTerrainType(c.q, c.r, 'highland')
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.6 ? 'plains' : 'highland')
          }
        }
        break
      }

      case 'symmetric_arena': {
        mapName = 'symmetric_arena_1v1'
        description = 'Symetryczna mapa turniejowa 1v1 ze zbalansowanymi zasobami i strategicznym centrum.'
        operations.push('Zbudowano idealnie symetryczną rzeźbę terenu dla 2 graczy')
        operations.push('Utworzono centralne wzgórze strategiczne z bogatymi zasobami')

        // Symmetrical quadrant/polar terrain
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r)
          if (dist === 0) {
            grid.setTerrainType(c.q, c.r, 'peak')
          } else if (dist <= 2) {
            grid.setTerrainType(c.q, c.r, 'rocky')
          } else if (dist <= 4) {
            grid.setTerrainType(c.q, c.r, 'highland')
          } else {
            // Mirror coordinate lookup
            const normX = Math.abs(c.q)
            const normY = Math.abs(c.r)
            const p = (normX * 7 + normY * 13 + dist) % 10
            if (p < 5) grid.setTerrainType(c.q, c.r, 'plains')
            else if (p < 8) grid.setTerrainType(c.q, c.r, 'lowland')
            else grid.setTerrainType(c.q, c.r, 'highland')
          }
        }
        break
      }

      case 'volcanic_caldera': {
        mapName = 'volcanic_caldera_ai'
        description = 'Masywny krater wulkaniczny z gorącym kotłem geotermalnym w centrum.'
        operations.push('Uformowano pierścień wulkaniczny ze strzelistymi szczytami')
        operations.push('Utworzono centralną kalderę z bogatą energią')

        const rimRadius = radius * 0.55
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r)
          if (dist < rimRadius * 0.45) {
            grid.setTerrainType(c.q, c.r, 'deep_crater')
          } else if (dist < rimRadius * 0.75) {
            grid.setTerrainType(c.q, c.r, 'lowland')
          } else if (Math.abs(dist - rimRadius) < 2) {
            grid.setTerrainType(c.q, c.r, rng() < 0.6 ? 'peak' : 'rocky')
          } else if (dist < rimRadius + 4) {
            grid.setTerrainType(c.q, c.r, 'highland')
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.7 ? 'plains' : 'lowland')
          }
        }
        break
      }

      case 'oasis': {
        mapName = 'mars_oasis_ai'
        description = 'Życiodajna oaza nizinna z bogatymi zasobami biomasy i wody.'
        operations.push('Uformowano osłoniętą kotlinę nizinną')
        operations.push('Skoncentrowano złoża biomasy i lodu w centrum')

        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r)
          if (dist < radius * 0.4) {
            grid.setTerrainType(c.q, c.r, 'lowland')
          } else if (dist < radius * 0.7) {
            grid.setTerrainType(c.q, c.r, 'plains')
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.5 ? 'highland' : 'rocky')
          }
        }
        break
      }

      case 'mountains': {
        mapName = 'mountain_peaks_ai'
        description = 'Labirynt grani górskich i skalistych przełęczy.'
        operations.push('Wygenerowano pasma górskie o podwyższonej rzeźbie terenu')
        applyProceduralTerrain(grid, seed, { mountainStrength: 0.65, octaves: 5, baseFrequency: 0.045 })
        break
      }

      case 'plains': {
        mapName = 'flat_plains_ai'
        description = 'Rozległe równiny ułatwiające szybką rozbudowę kolonii.'
        operations.push('Wygładzono większość terenu do równin i nizin')
        for (const c of grid.getAllCells()) {
          const r = rng()
          grid.setTerrainType(c.q, c.r, r < 0.75 ? 'plains' : r < 0.90 ? 'lowland' : 'highland')
        }
        break
      }

      default: {
        operations.push('Zastosowano deterministyczny szum proceduralny fBm i kratery')
        applyProceduralTerrain(grid, seed)
        break
      }
    }

    // Generate Spawns
    let spawns: SpawnPoint[] = []
    if (archetype === 'symmetric_arena' && players === 2) {
      // Precise symmetric spawns
      const spawnOffset = Math.floor(radius * 0.75)
      spawns = [
        { player: 1, pos: [-spawnOffset, 0] },
        { player: 2, pos: [spawnOffset, 0] },
      ]
      // Ensure flat ground at spawns
      for (const sp of spawns) {
        grid.setTerrainType(sp.pos[0], sp.pos[1], 'plains')
      }
      operations.push('Rozmieszczono symetryczne punkty startowe dla 2 graczy')
    } else {
      spawns = generateSpawns(grid, seed + 10, players)
      operations.push(`Wygenerowano ${spawns.length} punktów startowych graczy`)
    }

    // Generate Resources
    let resources: ResourceNode[] = []
    if (archetype === 'ice_crater') {
      resources = generateResources(grid, seed + 20, players)
      // Boost ice in crater
      let iceAdded = 0
      for (const c of grid.getAllCells()) {
        if ((c.terrainType === 'deep_crater' || c.terrainType === 'lowland') && iceAdded < 6) {
          if (!resources.some(r => r.pos[0] === c.q && r.pos[1] === c.r)) {
            resources.push({
              id: `ai_ice_${iceAdded++}`,
              type: 'ice',
              pos: [c.q, c.r],
              amount: 2500,
              richness: 'high',
              model: 'ice_01',
            })
          }
        }
      }
      operations.push(`Dodano obfite złoża lodu (${resources.filter(r => r.type === 'ice').length} złóż)`)
    } else if (archetype === 'symmetric_arena') {
      // Balanced mirror resources
      const baseRes = generateResources(grid, seed + 30, 2)
      resources = baseRes
      operations.push('Zbalansowano zasoby po obu stronach areny')
    } else if (archetype === 'oasis') {
      resources = generateResources(grid, seed + 40, players)
      let orgAdded = 0
      for (const c of grid.getAllCells()) {
        if (c.terrainType === 'lowland' && orgAdded < 5) {
          if (!resources.some(r => r.pos[0] === c.q && r.pos[1] === c.r)) {
            resources.push({
              id: `ai_org_${orgAdded++}`,
              type: 'organics',
              pos: [c.q, c.r],
              amount: 2000,
              richness: 'high',
              model: 'organics_01',
            })
          }
        }
      }
      operations.push('Wzbogacono kotlinę o złoża biomasy i wody')
    } else {
      resources = generateResources(grid, seed + 50, players)
      operations.push(`Rozmieszczono ${resources.length} zbalansowanych złóż surowców`)
    }

    // Generate Build Nodes & Decor
    const buildNodes = generateBuildNodes(grid, seed + 60, players, spawns)
    const decor = generateDecor(grid, seed + 70)

    // Scatter POI prefabs if requested
    const hasPoiRequest =
      normalized.includes('laborator') || normalized.includes('lab') || normalized.includes('ruin') || normalized.includes('stacj') ||
      normalized.includes('gniazd') || normalized.includes('hive') || normalized.includes('obcy') || normalized.includes('alien') ||
      normalized.includes('wrak') || normalized.includes('freighter') || normalized.includes('rozbit') || normalized.includes('crashed') || normalized.includes('statek')

    if (hasPoiRequest) {
      if (normalized.includes('laborator') || normalized.includes('lab') || normalized.includes('ruin') || normalized.includes('stacj')) {
        const candidate = grid.getAllCells().find(c => (c.terrainType === 'highland' || c.terrainType === 'rocky' || c.terrainType === 'plains') && !decor.some(d => d.pos[0] === c.q && d.pos[1] === c.r))
        if (candidate) {
          decor.push({ model: 'poi_abandoned_lab', pos: [candidate.q, candidate.r], rot: +(rng() * Math.PI * 2).toFixed(2), scale: 1.0 })
          operations.push('Rozmieszczono prefab opuszczonego laboratorium (poi_abandoned_lab)')
        }
      }
      if (normalized.includes('gniazd') || normalized.includes('hive') || normalized.includes('obcy') || normalized.includes('alien')) {
        const candidate = grid.getAllCells().find(c => (c.terrainType === 'lowland' || c.terrainType === 'deep_crater' || c.terrainType === 'plains') && !decor.some(d => d.pos[0] === c.q && d.pos[1] === c.r))
        if (candidate) {
          decor.push({ model: 'poi_alien_hive', pos: [candidate.q, candidate.r], rot: +(rng() * Math.PI * 2).toFixed(2), scale: 1.0 })
          operations.push('Rozmieszczono prefab gniazda obcych (poi_alien_hive)')
        }
      }
      if (normalized.includes('wrak') || normalized.includes('freighter') || normalized.includes('rozbit') || normalized.includes('crashed') || normalized.includes('statek')) {
        const candidate = grid.getAllCells().find(c => (c.terrainType === 'deep_crater' || c.terrainType === 'lowland' || c.terrainType === 'plains') && !decor.some(d => d.pos[0] === c.q && d.pos[1] === c.r))
        if (candidate) {
          decor.push({ model: 'poi_crashed_freighter', pos: [candidate.q, candidate.r], rot: +(rng() * Math.PI * 2).toFixed(2), scale: 1.0 })
          operations.push('Rozmieszczono prefab wraku statku (poi_crashed_freighter)')
        }
      }
    }

    operations.push(`Utworzono ${buildNodes.length} węzłów budowy i ${decor.length} elementów otoczenia`)

    const hexes: HexExportCell[] = grid.getAllCells().map(c => ({
      q: c.q,
      r: c.r,
      terrainType: c.terrainType,
      userType: c.userType,
      decor: c.decor,
    }))

    const mapData: MapExportJSON = {
      meta: {
        name: mapName,
        description,
        version: '2.0',
        gridType: 'hex-flat-top',
        hexSize: HEX_SIZE,
        hexRadius: radius,
        players,
        seed,
      },
      hexes,
      buildNodes,
      resourceNodes: resources,
      spawnPoints: spawns,
      decor,
    }

    const validation = parseMapJSON(mapData)
    if (!validation.ok || !validation.data) {
      throw new Error(`Błąd walidacji schematu mapy: ${validation.error}`)
    }

    return {
      mapData: validation.data,
      summary: `Pomyślnie wygenerowano nową mapę w oparciu o archetyp: ${archetype}.`,
      operationsApplied: operations,
      isFallback: true,
    }
  }

  // ─── Selective Modification ─────────────────────────────────────────────────

  private static executeSelectiveModification(
    normalized: string,
    rawPrompt: string,
    currentMap: MapExportJSON,
    seed: number,
  ): AIMapGenerationResult {
    const radius = currentMap.meta.hexRadius ?? 20
    const grid = new HexGrid(radius, currentMap.meta.seed ?? seed)
    grid.generate()
    grid.fromJSON({ hexes: currentMap.hexes as Partial<import('../../presentation/generator/hex/HexGrid').HexCell>[] })

    const operations: string[] = []
    const rng = makePrng(seed ^ 0xfeed)

    const resourceNodes: ResourceNode[] = JSON.parse(JSON.stringify(currentMap.resourceNodes ?? []))
    let buildNodes: BuildNode[] = JSON.parse(JSON.stringify(currentMap.buildNodes ?? []))
    const spawnPoints: SpawnPoint[] = JSON.parse(JSON.stringify(currentMap.spawnPoints ?? []))
    let decor: DecorItem[] = JSON.parse(JSON.stringify(currentMap.decor ?? []))

    // 1. Terrain Height Adjustments (Directional / Sector)
    if (normalized.includes('podnies') || normalized.includes('raise') || normalized.includes('podwyzsz')) {
      if (normalized.includes('zachod') || normalized.includes('west')) {
        let count = 0
        for (const cell of grid.getAllCells()) {
          const [wx] = hexToWorld(cell.q, cell.r)
          if (wx < -radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, elevateTerrain(cell.terrainType))
            count++
          }
        }
        operations.push(`Podniesiono poziom terenu na zachodnim obszarze (${count} heksów)`)
      } else if (normalized.includes('wschod') || normalized.includes('east')) {
        let count = 0
        for (const cell of grid.getAllCells()) {
          const [wx] = hexToWorld(cell.q, cell.r)
          if (wx > radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, elevateTerrain(cell.terrainType))
            count++
          }
        }
        operations.push(`Podniesiono poziom terenu na wschodnim obszarze (${count} heksów)`)
      } else if (normalized.includes('polnoc') || normalized.includes('north')) {
        let count = 0
        for (const cell of grid.getAllCells()) {
          const [, wz] = hexToWorld(cell.q, cell.r)
          if (wz < -radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, elevateTerrain(cell.terrainType))
            count++
          }
        }
        operations.push(`Podniesiono poziom terenu na północy (${count} heksów)`)
      } else if (normalized.includes('poludnie') || normalized.includes('south')) {
        let count = 0
        for (const cell of grid.getAllCells()) {
          const [, wz] = hexToWorld(cell.q, cell.r)
          if (wz > radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, elevateTerrain(cell.terrainType))
            count++
          }
        }
        operations.push(`Podniesiono poziom terenu na południu (${count} heksów)`)
      } else {
        // Global elevation
        for (const cell of grid.getAllCells()) {
          if (rng() < 0.4) grid.setTerrainType(cell.q, cell.r, elevateTerrain(cell.terrainType))
        }
        operations.push('Podniesiono losowe partie terenu')
      }
    }

    if (normalized.includes('obniz') || normalized.includes('lower') || normalized.includes('zgleb')) {
      if (normalized.includes('centrum') || normalized.includes('center') || normalized.includes('srodek')) {
        let count = 0
        for (const cell of grid.getAllCells()) {
          const dist = hexDistance(0, 0, cell.q, cell.r)
          if (dist < radius * 0.35) {
            grid.setTerrainType(cell.q, cell.r, lowerTerrain(cell.terrainType, 2))
            count++
          }
        }
        operations.push(`Utworzono obniżenie/krater w centrum mapy (${count} heksów)`)
      } else if (normalized.includes('wschod') || normalized.includes('east')) {
        for (const cell of grid.getAllCells()) {
          const [wx] = hexToWorld(cell.q, cell.r)
          if (wx > radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, lowerTerrain(cell.terrainType))
          }
        }
        operations.push('Obniżono poziom terenu na wschodzie')
      } else if (normalized.includes('zachod') || normalized.includes('west')) {
        for (const cell of grid.getAllCells()) {
          const [wx] = hexToWorld(cell.q, cell.r)
          if (wx < -radius * HEX_SIZE * 0.15) {
            grid.setTerrainType(cell.q, cell.r, lowerTerrain(cell.terrainType))
          }
        }
        operations.push('Obniżono poziom terenu na zachodzie')
      }
    }

    // 2. Base Smoothing / Flattening around spawns
    if (
      normalized.includes('wygladz') ||
      normalized.includes('smooth') ||
      normalized.includes('wyrownaj') ||
      normalized.includes('klif') ||
      normalized.includes('bazy') ||
      normalized.includes('spawn')
    ) {
      let smoothedCount = 0
      for (const sp of spawnPoints) {
        for (let ring = 0; ring <= 3; ring++) {
          for (const [rq, rr] of hexRing(sp.pos[0], sp.pos[1], ring)) {
            if (grid.hasCell(rq, rr)) {
              grid.setTerrainType(rq, rr, 'plains')
              smoothedCount++
            }
          }
        }
      }
      operations.push(`Wygładzono klify i wyrównano teren wokół baz (${smoothedCount} heksów)`)
    }

    // 3. Selective Resource Addition
    const isResourcePrompt =
      normalized.includes('zloz') || normalized.includes('surow') || normalized.includes('resource') ||
      normalized.includes('lod') || normalized.includes('ice') || normalized.includes('wod') ||
      normalized.includes('mineral') || normalized.includes('organi') || normalized.includes('biomas') ||
      normalized.includes('energi') || normalized.includes('power')

    if ((normalized.includes('dodaj') || normalized.includes('add')) && isResourcePrompt) {
      let resType: ResourceType = 'minerals'
      let model = 'mineral_pile_01'

      if (normalized.includes('lod') || normalized.includes('ice') || normalized.includes('wod')) {
        resType = 'ice'
        model = 'ice_01'
      } else if (normalized.includes('organi') || normalized.includes('biomas')) {
        resType = 'organics'
        model = 'organics_01'
      } else if (normalized.includes('energi') || normalized.includes('power')) {
        resType = 'energy'
        model = 'energy_01'
      }

      // Parse quantity
      const matchNum = normalized.match(/\b(\d+)\b/)
      const countToAdd = matchNum ? Math.min(12, parseInt(matchNum[1], 10)) : 3

      // Target terrain filter
      let targetTerrain: HexTerrainType[] = ['lowland', 'deep_crater', 'plains']
      if (normalized.includes('nizin') || normalized.includes('lowland')) {
        targetTerrain = ['lowland', 'deep_crater']
      } else if (normalized.includes('szczyt') || normalized.includes('peak') || normalized.includes('gor')) {
        targetTerrain = ['peak', 'rocky']
      } else if (normalized.includes('skal') || normalized.includes('rocky')) {
        targetTerrain = ['rocky', 'highland']
      }

      const candidateCells = grid.getAllCells().filter(
        c => targetTerrain.includes(c.terrainType) && !resourceNodes.some(r => r.pos[0] === c.q && r.pos[1] === c.r)
      )

      let added = 0
      while (added < countToAdd && candidateCells.length > 0) {
        const pickIdx = Math.floor(rng() * candidateCells.length)
        const [picked] = candidateCells.splice(pickIdx, 1)
        resourceNodes.push({
          id: `ai_mod_${resType}_${Date.now() % 10000}_${added}`,
          type: resType,
          pos: [picked.q, picked.r],
          amount: 2000,
          richness: 'med',
          model,
        })
        added++
      }
      operations.push(`Dodano ${added} złóż (${resType}) na wskazanym terenie`)
    }

    // 3b. Selective POI Prefabs Placement (Ruins, Alien Base / Hive, Crashed Freighter)
    const isPoiPrompt =
      normalized.includes('laborator') || normalized.includes('lab') || normalized.includes('ruin') || normalized.includes('stacj') ||
      normalized.includes('gniazd') || normalized.includes('hive') || normalized.includes('obcy') || normalized.includes('alien') ||
      normalized.includes('wrak') || normalized.includes('freighter') || normalized.includes('rozbit') || normalized.includes('crashed') ||
      normalized.includes('statek')

    if (isPoiPrompt) {
      let poiModel = 'poi_abandoned_lab'
      let poiLabel = 'opuszczone laboratorium badawcze'
      let targetTerrain: HexTerrainType[] = ['highland', 'rocky', 'plains']

      if (normalized.includes('gniazd') || normalized.includes('hive') || normalized.includes('obcy') || normalized.includes('alien')) {
        poiModel = 'poi_alien_hive'
        poiLabel = 'gniazdo / bazę obcych'
        targetTerrain = ['lowland', 'deep_crater', 'plains']
      } else if (normalized.includes('wrak') || normalized.includes('freighter') || normalized.includes('rozbit') || normalized.includes('crashed') || normalized.includes('statek')) {
        poiModel = 'poi_crashed_freighter'
        poiLabel = 'wrak transportowca w kraterze'
        targetTerrain = ['deep_crater', 'lowland', 'plains']
      }

      // Explicit terrain override if specified in prompt
      if (normalized.includes('wyzyn') || normalized.includes('highland')) {
        targetTerrain = ['highland', 'rocky']
      } else if (normalized.includes('nizin') || normalized.includes('lowland')) {
        targetTerrain = ['lowland', 'deep_crater']
      } else if (normalized.includes('krater') || normalized.includes('crater')) {
        targetTerrain = ['deep_crater', 'lowland']
      } else if (normalized.includes('rownin') || normalized.includes('plains')) {
        targetTerrain = ['plains']
      }

      const candidateCells = grid.getAllCells().filter(
        c => targetTerrain.includes(c.terrainType) && !decor.some(d => d.pos[0] === c.q && d.pos[1] === c.r)
      )

      if (candidateCells.length > 0) {
        const pickIdx = Math.floor(rng() * candidateCells.length)
        const [picked] = candidateCells.splice(pickIdx, 1)
        decor.push({
          model: poiModel,
          pos: [picked.q, picked.r],
          rot: +(rng() * Math.PI * 2).toFixed(2),
          scale: 1.0,
        })
        operations.push(`Rozmieszczono ${poiLabel} (${poiModel}) na terenie ${targetTerrain.join('/')}`)
      } else {
        const allCells = grid.getAllCells()
        if (allCells.length > 0) {
          const picked = allCells[Math.floor(rng() * allCells.length)]
          decor.push({
            model: poiModel,
            pos: [picked.q, picked.r],
            rot: +(rng() * Math.PI * 2).toFixed(2),
            scale: 1.0,
          })
          operations.push(`Rozmieszczono ${poiLabel} (${poiModel})`)
        }
      }
    }

    // 4. Clear / Adjust Decor
    if (normalized.includes('usun') || normalized.includes('wyczysc') || normalized.includes('clear') || normalized.includes('remove')) {
      if (normalized.includes('dekor') || normalized.includes('decor') || normalized.includes('skal') || normalized.includes('kamien')) {
        decor = []
        operations.push('Usunięto wszystkie elementy dekoracyjne z mapy')
      }
    }

    // 5. Build nodes addition
    if (normalized.includes('wezly budowy') || normalized.includes('build node') || normalized.includes('budow')) {
      const newNodes = generateBuildNodes(grid, seed + 99, spawnPoints.length || 2, spawnPoints)
      buildNodes = [...buildNodes, ...newNodes.slice(0, 4)]
      operations.push(`Dodano nowe węzły pod budowę bazy (${newNodes.slice(0, 4).length})`)
    }

    const hexes: HexExportCell[] = grid.getAllCells().map(c => ({
      q: c.q,
      r: c.r,
      terrainType: c.terrainType,
      userType: c.userType,
      decor: c.decor,
    }))

    const mapData: MapExportJSON = {
      meta: {
        ...currentMap.meta,
        version: '2.0',
        gridType: 'hex-flat-top',
        hexSize: currentMap.meta.hexSize || HEX_SIZE,
        hexRadius: radius,
        players: currentMap.meta.players || 2,
        seed: currentMap.meta.seed || seed,
      },
      hexes,
      buildNodes,
      resourceNodes,
      spawnPoints,
      decor,
    }

    const validation = parseMapJSON(mapData)
    if (!validation.ok || !validation.data) {
      throw new Error(`Błąd walidacji modyfikacji mapy: ${validation.error}`)
    }

    return {
      mapData: validation.data,
      summary: `Pomyślnie zmodyfikowano mapę wg promptu: "${rawPrompt}".`,
      operationsApplied: operations.length > 0 ? operations : ['Zastosowano wytyczne promptu do siatki heksagonalnej'],
      isFallback: true,
    }
  }
}
