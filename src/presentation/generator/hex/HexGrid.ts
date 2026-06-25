/**
 * HexGrid.ts
 * Generates a flat hex grid (height = 0). All hexes start as 'plains'.
 * terrainType is set manually by the user.
 * Uses flat-top axial coordinates (q, r).
 */

import {
  allMapHexes,
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

// ─── Vertex color per terrain type (Martian palette) ─────────────────────────

export const TERRAIN_COLORS: Record<HexTerrainType, [number, number, number]> = {
  deep_crater: [0.180, 0.090, 0.063],  // #2e1710 — cień krateru
  lowland:     [0.353, 0.184, 0.125],  // #5a2f20 — ciemna rdza
  plains:      [0.490, 0.271, 0.188],  // #7d4530 — rdzawa terakota (baza Marsa)
  highland:    [0.580, 0.345, 0.235],  // #94583c — jaśniejsza rdza
  rocky:       [0.420, 0.290, 0.227],  // #6b4a3a — szarobrązowa skała
  peak:        [0.659, 0.510, 0.416],  // #a8826a — pylisty jasny rdzawy
}

// ─── World height per terrain type ───────────────────────────────────────────

export const TERRAIN_HEIGHT: Record<HexTerrainType, number> = {
  deep_crater: 0.0,
  lowland:     0.6,
  plains:      1.2,
  highland:    2.0,
  rocky:       2.8,
  peak:        4.0,
}

// ─── HexCell ─────────────────────────────────────────────────────────────────

export interface HexCell {
  q: number
  r: number
  height: number
  worldY: number
  terrainType: HexTerrainType
  userType: TileType | null
  decor: string | null
}

// ─── Seeded PRNG for deterministic scatter ────────────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// ─── HexGrid class ────────────────────────────────────────────────────────────

export class HexGrid {
  private cells: Map<string, HexCell> = new Map()
  readonly radius: number
  readonly seed: number

  constructor(radius: number, seed: number) {
    this.radius = radius
    this.seed = seed
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  // All hexes start flat (height=0, worldY=0) with terrainType='plains'.
  // The user paints terrainType manually.

  generate(): void {
    this.cells.clear()
    const rand = makePrng(this.seed ^ 0xdeadbeef)
    void rand // available for future decor scatter

    for (const [q, r] of allMapHexes(this.radius)) {
      this.cells.set(hexKey(q, r), {
        q, r,
        height: 0,
        worldY: TERRAIN_HEIGHT['plains'],
        terrainType: 'plains',
        userType: null,
        decor: null,
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

  setTerrainType(q: number, r: number, type: HexTerrainType): void {
    const key = hexKey(q, r)
    const cell = this.cells.get(key)
    if (!cell) return
    this.cells.set(key, { ...cell, terrainType: type, worldY: TERRAIN_HEIGHT[type] })
  }

  setDecor(q: number, r: number, decor: string | null): void {
    const key = hexKey(q, r)
    const cell = this.cells.get(key)
    if (!cell) return
    this.cells.set(key, { ...cell, decor })
  }

  // ── Snapshot for undo ─────────────────────────────────────────────────────

  snapshot(): Map<string, HexCell> {
    const copy = new Map<string, HexCell>()
    for (const [k, v] of this.cells) copy.set(k, { ...v })
    return copy
  }

  restoreSnapshot(snap: Map<string, HexCell>): void {
    this.cells = new Map(snap)
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  toJSON(): object {
    const hexes = Array.from(this.cells.values()).map(c => ({
      q: c.q,
      r: c.r,
      terrainType: c.terrainType,
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

  fromJSON(data: { hexes: Partial<HexCell>[] }): void {
    this.cells.clear()
    for (const h of data.hexes) {
      if (h.q === undefined || h.r === undefined) continue
      const key = hexKey(h.q, h.r)
      const tt = (h.terrainType as HexTerrainType) ?? 'plains'
      this.cells.set(key, {
        q: h.q,
        r: h.r,
        height: 0,
        worldY: TERRAIN_HEIGHT[tt],
        terrainType: tt,
        userType: (h.userType as TileType) ?? null,
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
}
