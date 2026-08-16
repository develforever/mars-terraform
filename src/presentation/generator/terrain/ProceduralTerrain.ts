/**
 * ProceduralTerrain.ts
 *
 * Deterministyczna proceduralna generacja typow terenu z seeda.
 * Ten sam seed = ta sama mapa (seeded PRNG + simplex-noise).
 *
 * Warstwy:
 *   1. fBm (3 oktawy) -> pole wysokosci [0,1] -> pasma typow terenu,
 *   2. kratery (kilka z seeda) wciskaja teren w dol (deep_crater),
 *   3. szum szorstkosci -> laty 'rocky' na rowninach.
 *
 * Nie rusza geometrii ani worldY bezposrednio — ustawia tylko terrainType
 * (HexGrid.setTerrainType sam aktualizuje worldY wg poziomu).
 */

import { createNoise2D } from 'simplex-noise'
import { hexToWorld } from '../hex/HexMath'
import type { HexGrid, HexTerrainType } from '../hex/HexGrid'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Crater { cx: number; cz: number; radius: number }

export function applyProceduralTerrain(grid: HexGrid, seed: number): void {
  const noiseElev  = createNoise2D(mulberry32(seed))
  const noiseRough = createNoise2D(mulberry32((seed ^ 0x9e3779b9) >>> 0))
  const rng        = mulberry32((seed ^ 0x1234567) >>> 0)

  const cells = grid.getAllCells()
  if (cells.length === 0) return

  // ── Kratery ───────────────────────────────────────────────────────────────
  const nCraters = 2 + Math.floor(rng() * 4)
  const craters: Crater[] = []
  for (let i = 0; i < nCraters; i++) {
    const cell = cells[Math.floor(rng() * cells.length)]
    const [cx, cz] = hexToWorld(cell.q, cell.r)
    craters.push({ cx, cz, radius: 4 + rng() * 8 })
  }

  const ELEV_SCALE = 0.045  // niska czestotliwosc = duze formy terenu

  for (const cell of cells) {
    const [x, z] = hexToWorld(cell.q, cell.r)

    // fBm 3 oktawy -> [0,1]
    let e = 0, amp = 0.5, freq = ELEV_SCALE, norm = 0
    for (let o = 0; o < 3; o++) {
      e += amp * (noiseElev(x * freq, z * freq) * 0.5 + 0.5)
      norm += amp; amp *= 0.5; freq *= 2
    }
    e /= norm

    // depresja od kraterow
    let craterDepth = 0
    for (const c of craters) {
      const dx = x - c.cx, dz = z - c.cz
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d < c.radius) craterDepth = Math.max(craterDepth, 1 - d / c.radius)
    }
    e -= craterDepth * 0.5

    let type: HexTerrainType
    if (craterDepth > 0.6)   type = 'deep_crater'
    else if (e < 0.30)       type = 'lowland'
    else if (e < 0.60)       type = 'plains'
    else if (e < 0.74)       type = 'highland'
    else if (e < 0.87)       type = 'rocky'
    else                     type = 'peak'

    // laty rocky na rowninach
    const rough = noiseRough(x * 0.08, z * 0.08) * 0.5 + 0.5
    if (type === 'plains' && rough > 0.80) type = 'rocky'

    grid.setTerrainType(cell.q, cell.r, type)
  }
}
