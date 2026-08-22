/**
 * ProceduralPlacement.ts
 *
 * Deterministyczne, seeded rozsiewanie dodatkow (decor, resource, ...).
 * Ten sam seed = ten sam wynik. Czyta teren z HexGrid by stawiac sensownie.
 */

import type { HexGrid } from '../hex/HexGrid'
import { worldToHex, hexRing, HEX_SIZE } from '../hex/HexMath'
import type { DecorItem, ResourceNode, ResourceType, Richness, SpawnPoint, BuildNode } from '../../../domain/mapEditorTypes'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Decor ──────────────────────────────────────────────────────────────────

const DECOR_BY_TERRAIN: Record<string, string[]> = {
  deep_crater: ['rock_01', 'wreck'],
  lowland:     ['rocks', 'rock_01'],
  plains:      ['rock_01', 'rocks'],
  highland:    ['rock_01', 'rocks', 'boulder'],
  rocky:       ['boulder', 'rocks', 'rock_01'],
  peak:        ['crystal', 'boulder', 'rock_01'],
}
const DECOR_PROB: Record<string, number> = {
  deep_crater: 0.04, lowland: 0.05, plains: 0.04, highland: 0.08, rocky: 0.12, peak: 0.10,
}

export function generateDecor(grid: HexGrid, seed: number): DecorItem[] {
  const rng = mulberry32(seed)
  const out: DecorItem[] = []
  for (const c of grid.getAllCells()) {
    const p = DECOR_PROB[c.terrainType] ?? 0.05
    if (rng() > p) continue
    const opts = DECOR_BY_TERRAIN[c.terrainType] ?? ['rock_01']
    const model = opts[Math.floor(rng() * opts.length)]
    out.push({ model, pos: [c.q, c.r], rot: rng() * Math.PI * 2, scale: 0.6 + rng() * 0.8 })
  }
  return out
}

// ─── Resources ──────────────────────────────────────────────────────────────

function pickResourceTypeForTerrain(terrainType: string, r: number): ResourceType {
  if (terrainType === 'deep_crater' || terrainType === 'lowland') {
    // Kratery i niziny: głównie lód wodny i minerały uderzeniowe
    if (r < 0.55) return 'ice'
    if (r < 0.85) return 'minerals'
    if (r < 0.93) return 'organics'
    return 'energy'
  }
  if (terrainType === 'rocky' || terrainType === 'peak') {
    // Skały i szczyty: bogate minerały i energia geotermalna/solarna
    if (r < 0.50) return 'minerals'
    if (r < 0.75) return 'energy'
    if (r < 0.90) return 'ice'
    return 'organics'
  }
  // Równiny i wyżyny: zrównoważone złoża
  if (r < 0.40) return 'minerals'
  if (r < 0.65) return 'ice'
  if (r < 0.85) return 'organics'
  return 'energy'
}

const RES_MODEL: Record<ResourceType, string> = {
  minerals: 'mineral_pile_01',
  ice:      'ice_01',
  organics: 'organics_01',
  energy:   'energy_01',
}

export function generateResources(grid: HexGrid, seed: number, players: number): ResourceNode[] {
  const rng = mulberry32((seed ^ 0x55aa) >>> 0)
  const cells = grid.getAllCells()
  if (cells.length === 0) return []

  // Preferencyjne wybieranie komórek nizin, kraterów i wyżyn
  const count = Math.min(cells.length, Math.max(8, players * 4 + 4))
  const used = new Set<string>()
  const out: ResourceNode[] = []
  let i = 0
  let guard = 0

  while (out.length < count && guard < count * 40) {
    guard++
    const c = cells[Math.floor(rng() * cells.length)]
    const key = `${c.q},${c.r}`
    if (used.has(key)) continue
    used.add(key)

    const type = pickResourceTypeForTerrain(c.terrainType, rng())
    const rr = rng()
    const richness: Richness = rr < 0.25 ? 'high' : rr < 0.60 ? 'med' : 'low'
    const range = richness === 'high' ? [2000, 3500] : richness === 'med' ? [1000, 2000] : [500, 1000]
    const amount = Math.round((range[0] + rng() * (range[1] - range[0])) / 100) * 100

    out.push({ id: `rg${i++}`, type, pos: [c.q, c.r], amount, richness, model: RES_MODEL[type] })
  }
  return out
}


// ─── Helper: najblizszy heks spelniajacy warunek (spirala) ───────────────────

function findNearestValid(
  grid: HexGrid, q: number, r: number, valid: (q: number, r: number) => boolean,
): [number, number] | null {
  const maxRing = grid.radius * 2
  for (let ring = 0; ring <= maxRing; ring++) {
    for (const [cq, cr] of hexRing(q, r, ring)) {
      if (valid(cq, cr)) return [cq, cr]
    }
  }
  return null
}

// ─── Spawny (zbalansowane na ringu) ──────────────────────────────────────────

export function generateSpawns(grid: HexGrid, seed: number, players: number): SpawnPoint[] {
  const rng = mulberry32((seed ^ 0x00a1) >>> 0)
  const out: SpawnPoint[] = []
  const worldR = grid.radius * HEX_SIZE * 0.95

  const valid = (q: number, r: number): boolean => {
    if (!grid.hasCell(q, r)) return false
    const c = grid.getCell(q, r)!
    if (c.terrainType === 'deep_crater' || c.terrainType === 'peak') return false
    return !out.some(s => s.pos[0] === q && s.pos[1] === r)
  }

  for (let i = 0; i < players; i++) {
    const angle = (i / players) * Math.PI * 2 + (rng() - 0.5) * 0.5
    const [q0, r0] = worldToHex(Math.cos(angle) * worldR, Math.sin(angle) * worldR)
    const pos = findNearestValid(grid, q0, r0, valid) ?? [q0, r0]
    out.push({ player: i + 1, pos: [pos[0], pos[1]] })
  }
  return out
}

// ─── Wezly budowy (przy spawnach + neutralne) ────────────────────────────────

export function generateBuildNodes(
  grid: HexGrid, seed: number, players: number, spawns: SpawnPoint[],
): BuildNode[] {
  const rng = mulberry32((seed ^ 0x00b2) >>> 0)
  const out: BuildNode[] = []
  let id = 0

  const valid = (q: number, r: number): boolean => {
    if (!grid.hasCell(q, r)) return false
    const c = grid.getCell(q, r)!
    if (c.terrainType === 'deep_crater' || c.terrainType === 'peak') return false
    if (out.some(b => b.pos[0] === q && b.pos[1] === r)) return false
    return !spawns.some(s => s.pos[0] === q && s.pos[1] === r)
  }

  // przy kazdym spawnie
  for (const s of spawns) {
    const dq = rng() < 0.5 ? 1 : -1
    const found = findNearestValid(grid, s.pos[0] + dq, s.pos[1], valid)
    if (found) out.push({ id: `bg${id++}`, pos: [found[0], found[1]], footprint: [1, 1], allowedTypes: ['colony', 'greenhouse'] })
  }

  // neutralne na wewnetrznym ringu
  const worldR = grid.radius * HEX_SIZE * 0.45
  const n = Math.max(2, players)
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.6
    const [q0, r0] = worldToHex(Math.cos(angle) * worldR, Math.sin(angle) * worldR)
    const found = findNearestValid(grid, q0, r0, valid)
    if (found) out.push({ id: `bg${id++}`, pos: [found[0], found[1]], footprint: [1, 1], allowedTypes: ['colony'] })
  }
  return out
}
