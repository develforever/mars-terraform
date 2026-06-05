/**
 * TerrainTextureLoader.ts
 *
 * Tworzy THREE.DataArrayTexture z 6 warstw tekstur terenu.
 *
 * Wersja A (aktywna): proceduralne Canvas 2D — nie wymaga plików.
 * Wersja B (docelowa): ładowanie z public/textures/mars/*.jpg
 *
 * Indeksy warstw:
 *   0 = deep_crater   ciemny rdzawy krater
 *   1 = lowland       ciemny brązowo-czerwony piasek
 *   2 = plains        jasny pomarańcz, wydmy  ← główny
 *   3 = highland      ciemniejszy pomarańcz, drobna skała
 *   4 = rocky         brązowy kamień
 *   5 = peak          kremowy piasek / szron
 */

import * as THREE from 'three'

export const TERRAIN_TEX_COUNT = 6
const TEX_SIZE = 256  // px per layer

// ─── Mapowanie terrainType → indeks warstwy ───────────────────────────────────

export const TERRAIN_TEX_INDEX: Record<string, number> = {
  deep_crater: 0,
  lowland:     1,
  plains:      2,
  highland:    3,
  rocky:       4,
  peak:        5,
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void

function renderToRGBA(painter: Painter): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  painter(ctx, TEX_SIZE)
  return new Uint8Array(ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data)
}

// Szum w stylu RNG (deterministyczny, bez importu)
function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453
  return n - Math.floor(n)
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  baseColor: [number, number, number],
  variance: number,
  freq: number,
  seed: number,
) {
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = pseudoNoise(x * freq / size, y * freq / size, seed)
      const v = (n - 0.5) * variance
      const i = (y * size + x) * 4
      img.data[i + 0] = Math.round(Math.min(255, Math.max(0, baseColor[0] + v)))
      img.data[i + 1] = Math.round(Math.min(255, Math.max(0, baseColor[1] + v * 0.8)))
      img.data[i + 2] = Math.round(Math.min(255, Math.max(0, baseColor[2] + v * 0.6)))
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

// Wavy dune lines
function drawDunes(
  ctx: CanvasRenderingContext2D,
  size: number,
  baseColor: [number, number, number],
  stripeColor: [number, number, number],
  freq: number,
) {
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin((x / size) * Math.PI * freq + (y / size) * Math.PI * 2.3) * 0.5 + 0.5
      const noise = pseudoNoise(x * 3.1 / size, y * 2.7 / size, 42) * 0.3
      const t = Math.pow(Math.max(0, wave + noise - 0.4), 1.5)
      const i = (y * size + x) * 4
      img.data[i + 0] = Math.round(baseColor[0] * (1 - t) + stripeColor[0] * t)
      img.data[i + 1] = Math.round(baseColor[1] * (1 - t) + stripeColor[1] * t)
      img.data[i + 2] = Math.round(baseColor[2] * (1 - t) + stripeColor[2] * t)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

// Circles = craters
function drawCraters(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: [number, number, number],
  rim: [number, number, number],
) {
  const img = ctx.createImageData(size, size)
  const craterCenters = [
    [0.25, 0.3, 0.12], [0.7, 0.65, 0.08], [0.45, 0.75, 0.05],
    [0.8, 0.2, 0.07],  [0.1, 0.7, 0.06],
  ]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let t = 0
      for (const [cx, cy, r] of craterCenters) {
        const dx = (x / size) - cx, dy = (y / size) - cy
        const d = Math.sqrt(dx * dx + dy * dy) / r
        if (d < 1.0) t = Math.max(t, 1.0 - d)
        // Rim highlight
        const rimD = Math.abs(d - 1.0) * 4.0
        if (rimD < 1.0) t = Math.max(t, (1.0 - rimD) * 0.5)
      }
      const noise = (pseudoNoise(x * 5 / size, y * 5 / size, 7) - 0.5) * 30
      const i = (y * size + x) * 4
      img.data[i + 0] = Math.min(255, Math.max(0, Math.round(base[0] * (1 - t) + rim[0] * t + noise)))
      img.data[i + 1] = Math.min(255, Math.max(0, Math.round(base[1] * (1 - t) + rim[1] * t + noise * 0.8)))
      img.data[i + 2] = Math.min(255, Math.max(0, Math.round(base[2] * (1 - t) + rim[2] * t + noise * 0.6)))
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

// ─── 6 warstw proceduralnych ──────────────────────────────────────────────────

const LAYER_PAINTERS: Painter[] = [
  // 0: deep_crater — głęboki rdzawy krater, mocny kontrast
  (ctx, size) => {
    drawNoise(ctx, size, [70, 20, 8], 30, 6, 1)
    drawCraters(ctx, size, [60, 15, 5], [145, 55, 18])
  },
  // 1: lowland — ciemny rdzawo-brązowy piasek
  (ctx, size) => drawNoise(ctx, size, [190, 90, 30], 40, 5, 2),

  // 2: plains — Candy Mars #E86010, głęboki pomarańcz, intensywne fale piasku (GŁÓWNY)
  (ctx, size) => drawDunes(ctx, size, [232, 96, 16], [255, 128, 32], 10),

  // 3: highland — nasycony ciemny pomarańcz, skalna faktura
  (ctx, size) => drawDunes(ctx, size, [200, 85, 20], [230, 110, 35], 7),

  // 4: rocky — głęboki brąz z wyraźnymi pęknięciami
  (ctx, size) => {
    drawNoise(ctx, size, [150, 70, 20], 45, 8, 5)
    // Pęknięcia jako ciemne linie (simplified)
    const d = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < d.data.length; i += 4) {
      const x = (i / 4) % size
      const y = Math.floor(i / 4 / size)
      const crack = Math.abs(Math.sin(x * 0.15 + y * 0.08)) < 0.08 ? 0.45 : 1.0
      d.data[i]     = Math.round(d.data[i] * crack)
      d.data[i + 1] = Math.round(d.data[i + 1] * crack)
      d.data[i + 2] = Math.round(d.data[i + 2] * crack)
    }
    ctx.putImageData(d, 0, 0)
  },

  // 5: peak — kremowy jasny z wyraźną fakturą
  (ctx, size) => drawDunes(ctx, size, [235, 215, 175], [252, 240, 210], 5),
]

// ─── createProceduralTerrainTextures ─────────────────────────────────────────

/**
 * Tworzy DataArrayTexture z 6 proceduralnie generowanych warstw.
 * Nie wymaga żadnych plików — działa od razu.
 */
export function createProceduralTerrainTextures(): THREE.DataArrayTexture {
  const size = TEX_SIZE
  const layers = TERRAIN_TEX_COUNT
  const data = new Uint8Array(size * size * 4 * layers)

  for (let l = 0; l < layers; l++) {
    const rgba = renderToRGBA(LAYER_PAINTERS[l])
    data.set(rgba, l * size * size * 4)
  }

  const tex = new THREE.DataArrayTexture(data, size, size, layers)
  tex.format    = THREE.RGBAFormat
  tex.type      = THREE.UnsignedByteType
  tex.wrapS     = THREE.RepeatWrapping
  tex.wrapT     = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

// ─── loadTerrainTextureArray (Wersja B — z plików) ───────────────────────────

/**
 * Ładuje tablicę plików tekstur i pakuje w DataArrayTexture.
 * Użyj gdy masz gotowe assety w public/textures/mars/.
 */
export async function loadTerrainTextureArray(
  paths: string[],
  size = 512,
): Promise<THREE.DataArrayTexture> {
  const layers = paths.length
  const data = new Uint8Array(size * size * 4 * layers)

  for (let l = 0; l < layers; l++) {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => res(i)
      i.onerror = rej
      i.src = paths[l]
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, size, size)
    const rgba = new Uint8Array(ctx.getImageData(0, 0, size, size).data)
    data.set(rgba, l * size * size * 4)
  }

  const tex = new THREE.DataArrayTexture(data, size, size, layers)
  tex.format    = THREE.RGBAFormat
  tex.type      = THREE.UnsignedByteType
  tex.wrapS     = THREE.RepeatWrapping
  tex.wrapT     = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
