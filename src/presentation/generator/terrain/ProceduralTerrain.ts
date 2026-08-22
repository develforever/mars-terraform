/**
 * ProceduralTerrain.ts
 *
 * Deterministyczna proceduralna generacja ukształtowania terenu Marsa z seeda.
 * Zapewnia 100% determinizm (ten sam seed = identyczna mapa heksów, klifów i wysokości).
 *
 * Warstwy generowania:
 *   1. 4-oktawowe fBm (fractional Brownian motion) -> makro-rzeźba terenu,
 *   2. Ridged noise (3 oktawy) -> formowanie ciągłych pasm górskich i grani,
 *   3. Deterministyczne kratery marsjańskie:
 *      - centralna radialna depresja (dno krateru / deep_crater / lowland),
 *      - podwyższony wał krateru (elevated rim / highland / rocky),
 *   4. Szum mikroszorstkości -> łaty 'rocky' na zboczach i równinach,
 *   5. Deterministyczne przypisanie wysokości worldY i typów komórek HexGrid.
 */

import { createNoise2D } from 'simplex-noise'
import { hexToWorld } from '../hex/HexMath'
import type { HexGrid, HexTerrainType } from '../hex/HexGrid'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MartianCrater {
  cx: number
  cz: number
  radius: number
  depth: number
  rimHeight: number
}

export interface ProceduralTerrainOptions {
  octaves?: number
  baseFrequency?: number
  mountainStrength?: number
  craterCount?: number
}

export function applyProceduralTerrain(
  grid: HexGrid,
  seed: number,
  options?: ProceduralTerrainOptions,
): void {
  const cells = grid.getAllCells()
  if (cells.length === 0) return

  const rngMain = mulberry32(seed)
  const rngNoise1 = mulberry32((seed ^ 0xa5a5a5a5) >>> 0)
  const rngNoise2 = mulberry32((seed ^ 0x5a5a5a5a) >>> 0)
  const rngRough = mulberry32((seed ^ 0x9e3779b9) >>> 0)

  const noiseMacro = createNoise2D(rngNoise1)
  const noiseRidged = createNoise2D(rngNoise2)
  const noiseRough = createNoise2D(rngRough)

  const octaves = options?.octaves ?? 4
  const baseFreq = options?.baseFrequency ?? 0.032
  const mountainStrength = options?.mountainStrength ?? 0.38

  // ── 1. Deterministyczne kratery marsjańskie z podwyższonym wałem ─────────────
  const autoCraterCount = Math.max(2, Math.floor(grid.radius * 0.22) + Math.floor(rngMain() * 3))
  const nCraters = options?.craterCount ?? autoCraterCount
  const craters: MartianCrater[] = []

  // Dobór pozycji kraterów z równomiernym rozkładem z seeda
  const cellPool = [...cells]
  for (let i = 0; i < nCraters && cellPool.length > 0; i++) {
    const pickIdx = Math.floor(rngMain() * cellPool.length)
    const [picked] = cellPool.splice(pickIdx, 1)
    const [cx, cz] = hexToWorld(picked.q, picked.r)
    const radius = 4.5 + rngMain() * 7.5
    const depth = 0.55 + rngMain() * 0.45
    const rimHeight = 0.25 + rngMain() * 0.30

    craters.push({ cx, cz, radius, depth, rimHeight })
  }

  // ── 2. Generowanie wysokości i typów pól ────────────────────────────────────
  for (const cell of cells) {
    const [x, z] = hexToWorld(cell.q, cell.r)

    // A. 4-oktawowe fBm (makro-teren) w zakresie [0, 1]
    let macroElev = 0
    let amp = 1.0
    let freq = baseFreq
    let norm = 0

    for (let o = 0; o < octaves; o++) {
      macroElev += amp * (noiseMacro(x * freq, z * freq) * 0.5 + 0.5)
      norm += amp
      amp *= 0.5
      freq *= 2.0
    }
    macroElev /= norm

    // B. Ridged multifractal noise (pasma górskie i ostre granie)
    let ridgeVal = 0
    let rAmp = 1.0
    let rFreq = baseFreq * 1.5
    let rNorm = 0

    for (let o = 0; o < 3; o++) {
      const n = noiseRidged(x * rFreq, z * rFreq)
      const r = 1.0 - Math.abs(n)
      ridgeVal += rAmp * Math.pow(r, 1.5)
      rNorm += rAmp
      rAmp *= 0.5
      rFreq *= 2.0
    }
    ridgeVal /= rNorm

    // Łączenie makro-terenu z pasmami górskimi
    let elevation = (1 - mountainStrength) * macroElev + mountainStrength * ridgeVal

    // C. Wpływ kraterów (radialne zagłębienie + podwyższony wał)
    let maxDepression = 0
    let maxRim = 0

    for (const crater of craters) {
      const dx = x - crater.cx
      const dz = z - crater.cz
      const dist = Math.sqrt(dx * dx + dz * dz)
      const u = dist / crater.radius

      if (u < 1.0) {
        // Wnętrze krateru: paraboliczne zagłębienie ku dołowi
        const dep = crater.depth * Math.pow(1.0 - u * u, 1.2)
        maxDepression = Math.max(maxDepression, dep)
      }

      // Podwyższony wał (wąski pierścień w okolicach u = 1.0)
      const rimDist = Math.abs(u - 1.0)
      if (rimDist < 0.45) {
        const rimCurve = Math.exp(-Math.pow(rimDist / 0.18, 2))
        const rim = crater.rimHeight * rimCurve
        maxRim = Math.max(maxRim, rim)
      }
    }

    elevation = elevation - maxDepression * 0.85 + maxRim * 0.65
    elevation = Math.max(0, Math.min(1, elevation))

    // D. Kwalifikacja typu terenu na podstawie profilu geologicznego
    let type: HexTerrainType

    if (maxDepression > 0.40) {
      // Głębia krateru uderzeniowego
      type = 'deep_crater'
    } else if (maxRim > 0.18 && elevation > 0.48) {
      // Wyniesiony wał krateru
      type = elevation > 0.70 ? 'rocky' : 'highland'
    } else if (elevation < 0.28) {
      // Niziny / kaniony
      type = 'lowland'
    } else if (elevation < 0.54) {
      // Podstawowe równiny marsjańskie
      type = 'plains'
    } else if (elevation < 0.68) {
      // Wyżyny
      type = 'highland'
    } else if (elevation < 0.80) {
      // Pasma skaliste
      type = 'rocky'
    } else {
      // Najwyższe szczyty i granie
      type = 'peak'
    }

    // E. Mikroszorstkość dla skalistych wychodni na równinach
    const rough = noiseRough(x * 0.08, z * 0.08) * 0.5 + 0.5
    if (type === 'plains' && rough > 0.82) {
      type = 'rocky'
    }

    // Ustawienie typu i skorelowanego worldY
    grid.setTerrainType(cell.q, cell.r, type)
  }
}


