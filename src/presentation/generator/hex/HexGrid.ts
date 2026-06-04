/**
 * HexGrid.ts
 * Generates a hex grid with Simplex Noise terrain heights and terrain types.
 * Uses flat-top axial coordinates (q, r).
 */

import { createNoise2D } from 'simplex-noise'
import {
  allMapHexes,
  hexToWorld,
  hexKey,
} from './HexMath'
import type { TileType } from '../../../domain/mapEditorTypes'

// ─── Terrain types ────────────────────────────────────────────────────────────

export type HexTerrainType =
  | 'deep_crater'
  | 'lowland'
  | 'plains'
  | 'highland'
  | 'rocky'
  | 'peak'

// ─── Vertex color per terrain type (marsjańska paleta) ────────────────────────

export const TERRAIN_COLORS: Record<HexTerrainType, [number, number, number]> = {
  deep_crater: [0.239, 0.122, 0.039],  // #3d1f0a
  lowland:     [0.545, 0.227, 0.102],  // #8b3a1a
  plains:      [0.757, 0.267, 0.055],  // #c1440e
  highland:    [0.831, 0.384, 0.165],  // #d4622a
  rocky:       [0.620, 0.502, 0.376],  // #9e8060
  peak:        [0.750, 0.690, 0.580],  // #bfb094
}

// Height per terrain type (world Y, not noise value)
export const TERRAIN_HEIGHT: Record<HexTerrainType, number> = {
  deep_crater: 0.0,
  lowland:     1.2,
  plains:      2.4,
  highland:    3.8,
  rocky:       5.2,
  peak:        7.0,
}

// ─── HexCell ─────────────────────────────────────────────────────────────────

export interface HexCell {
  q: number
  r: number
  height: number          // 0..1 from noise (raw)
  worldY: number          // world Y position (from TERRAIN_HEIGHT)
  terrainType: HexTerrainType
  userType: TileType | null  // null = no user override
  decor: string | null    // model filename (e.g. 'rock_largeA') or null
}

// ─── Seeded PRNG (LCG) for deterministic scatter ─────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// ─── Height → terrain type ────────────────────────────────────────────────────

function heightToTerrainType(h: number): HexTerrainType {
  if (h < 0.15) return 'deep_crater'
  if (h < 0.35) return 'lowland'
  if (h < 0.55) return 'plains'
  if (h < 0.72) return 'highland'
  if (h < 0.88) return 'rocky'
  return 'peak'
}

// ─── HexGrid class ────────────────────────────────────────────────────────────

export class HexGrid {
  private cells: Map<string, HexCell> = new Map()
  readonly radius: number
  readonly seed: number

  // Noise config
  private noiseScale = 0.12      // lower = smoother, larger features
  private noiseOctaves = 3       // detail layers
  private noisePersistence = 0.5 // amplitude falloff per octave

  constructor(radius: number, seed: number) {
    this.radius = radius
    this.seed = seed
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  generate(): void {
    this.cells.clear()

    // Create noise function with seeded alea
    const noise2D = createNoise2D(this.aleaRng(this.seed))
    const rand = makePrng(this.seed ^ 0xdeadbeef)

    for (const [q, r] of allMapHexes(this.radius)) {
      const [wx, wz] = hexToWorld(q, r)

      // Multi-octave noise
      let h = 0
      let amplitude = 0.1
      let frequency = this.noiseScale
      let maxH = 0

      for (let oct = 0; oct < this.noiseOctaves; oct++) {
        h += ((noise2D(wx * frequency, wz * frequency) + 1) / 2) * amplitude
        maxH += amplitude
        amplitude *= this.noisePersistence
        frequency *= 2
      }

      h = h / maxH // normalize to 0..1

      // Edge falloff — lower terrain near map boundary for natural border
      const distFromCenter = Math.sqrt(q * q + r * r + q * r)
      const edgeFactor = 1 - Math.pow(distFromCenter / (this.radius * 0.95), 3)
      h *= Math.max(0, edgeFactor)

      const terrainType = heightToTerrainType(h)
      const worldY = TERRAIN_HEIGHT[terrainType]

      // Auto-decor on rocky/peak hexes
      let decor: string | null = null
      if (terrainType === 'peak' && rand() < 0.4) {
        decor = ['rock_largeA', 'rock_largeB', 'rock_crystalsLargeA', 'rock_crystalsLargeB'][Math.floor(rand() * 4)]
      } else if (terrainType === 'rocky' && rand() < 0.25) {
        decor = ['rock.glb', 'rocks_smallA', 'rocks_smallB', 'rock_crystals'][Math.floor(rand() * 4)]
      } else if (terrainType === 'deep_crater' && rand() < 0.15) {
        decor = ['crater', 'meteor_half'][Math.floor(rand() * 2)]
      }

      this.cells.set(hexKey(q, r), {
        q, r,
        height: h,
        worldY: worldY,
        terrainType,
        userType: null,
        decor,
      })
    }
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getCell(q: number, r: number): HexCell | undefined {
    return this.cells.get(hexKey(q, r))
  }

  hasCell(q: number, r: number): boolean {
    return this.cells.has(hexKey(q, r))
  }

  getAllCells(): HexCell[] {
    return Array.from(this.cells.values())
  }

  getCellCount(): number {
    return this.cells.size
  }

  // ── User paint ────────────────────────────────────────────────────────────

  setUserType(q: number, r: number, type: TileType | null): void {
    const key = hexKey(q, r)
    const cell = this.cells.get(key)
    if (!cell) return
    this.cells.set(key, { ...cell, userType: type })
  }

  setDecor(q: number, r: number, decor: string | null): void {
    const key = hexKey(q, r)
    const cell = this.cells.get(key)
    if (!cell) return
    this.cells.set(key, { ...cell, decor })
  }

  // Snapshot for undo
  snapshot(): Map<string, HexCell> {
    const copy = new Map<string, HexCell>()
    for (const [k, v] of this.cells) copy.set(k, { ...v })
    return copy
  }

  restoreSnapshot(snap: Map<string, HexCell>): void {
    this.cells = new Map(snap)
  }

  // ── Config ────────────────────────────────────────────────────────────────

  setNoiseConfig(scale: number, octaves: number, persistence: number): void {
    this.noiseScale = scale
    this.noiseOctaves = octaves
    this.noisePersistence = persistence
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  toJSON(): object {
    const hexes = Array.from(this.cells.values()).map(c => ({
      q: c.q,
      r: c.r,
      terrainType: c.terrainType,
      height: Math.round(c.height * 1000) / 1000,
      userType: c.userType,
      decor: c.decor,
    }))
    return {
      version: 2,
      gridType: 'hex-flat-top',
      radius: this.radius,
      seed: this.seed,
      hexes,
    }
  }

  fromJSON(data: ReturnType<HexGrid['toJSON']> & { hexes: HexCell[] }): void {
    this.cells.clear()
    for (const h of data.hexes) {
      const key = hexKey(h.q, h.r)
      this.cells.set(key, {
        q: h.q,
        r: h.r,
        height: h.height,
        worldY: TERRAIN_HEIGHT[h.terrainType],
        terrainType: h.terrainType,
        userType: h.userType ?? null,
        decor: h.decor ?? null,
      })
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getTerrainStats(): Record<HexTerrainType, number> {
    const stats: Record<HexTerrainType, number> = {
      deep_crater: 0, lowland: 0, plains: 0,
      highland: 0, rocky: 0, peak: 0,
    }
    for (const cell of this.cells.values()) {
      stats[cell.terrainType]++
    }
    return stats
  }

  getUserTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {
      build: 0, resource: 0, blocked: 0, spawn: 0, empty: 0,
    }
    for (const cell of this.cells.values()) {
      const t = cell.userType ?? 'empty'
      stats[t] = (stats[t] ?? 0) + 1
    }
    return stats
  }

  // ── Private: seeded alea for createNoise2D ────────────────────────────────

  private aleaRng(seed: number): () => number {
    // Simple seeded RNG compatible with simplex-noise v4 prng parameter
    let s = seed >>> 0
    return () => {
      s ^= s << 13
      s ^= s >> 17
      s ^= s << 5
      return ((s >>> 0) / 0x100000000)
    }
  }
}
