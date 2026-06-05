/**
 * SlopeMaterial.ts
 *
 * MeshStandardMaterial z:
 *   - DataArrayTexture sampling (do 3 warstw blendowanych per vertex)
 *   - Planar UV z world XZ position (tileable)
 *   - Candy boost (saturacja + luminancja)
 *   - Frost effect na szczytach (worldY > frostRange)
 *   - Slope darkening na urwiskach (zostaje dla klifów)
 */

import * as THREE from 'three'

// ─── Opcje ────────────────────────────────────────────────────────────────────

export interface SlopeMaterialOptions {
  /** DataArrayTexture z warstwami tekstur per terrainType */
  textureArray?: THREE.DataArrayTexture
  /** Rozmiar mapy w world units (do skalowania UV); domyślnie 36 */
  mapScale?: number
  /** Ile repeats na mapę; domyślnie 10.0 */
  tileScale?: number
  /** Frost range [startY, fullY]; domyślnie [2.8, 4.0] */
  frostRange?: [number, number]
  /** Siła szronu 0..1; domyślnie 0.50 */
  frostStrength?: number
  /** Candy saturation multiplier; domyślnie 1.25 */
  candySaturation?: number
  /** Candy brightness multiplier; domyślnie 1.05 */
  candyBrightness?: number
}

// ─── createSlopeMaterial ──────────────────────────────────────────────────────

export function createSlopeMaterial(opts: SlopeMaterialOptions = {}): THREE.MeshStandardMaterial {
  const textureArray    = opts.textureArray   ?? null
  const mapScale        = opts.mapScale       ?? 36.0
  const tileScale       = opts.tileScale      ?? 10.0
  const frostRange      = opts.frostRange     ?? [2.8, 4.0]
  const frostStrength   = opts.frostStrength  ?? 0.50
  const candySaturation = opts.candySaturation ?? 1.30
  const candyBrightness = opts.candyBrightness ?? 1.00

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,   // fallback gdy brak textureArray
    roughness: 0.75,
    metalness: 0.0,
  })

  mat.onBeforeCompile = (shader) => {

    // ── Uniforms ────────────────────────────────────────────────────────────

    if (textureArray) {
      shader.uniforms.uTerrainArray = { value: textureArray }
    }
    shader.uniforms.uMapScale  = { value: mapScale }
    shader.uniforms.uTileScale = { value: tileScale }

    // ── Vertex shader ────────────────────────────────────────────────────────

    shader.vertexShader = shader.vertexShader
      .replace('void main() {', /* glsl */`
varying vec3  vWorldNormal;
varying float vWorldY;
varying vec2  vWorldXZ;
varying vec3  vTerrainIdx;
varying vec3  vTerrainWgt;

attribute vec3 terrainIdx;
attribute vec3 terrainWgt;

void main() {`)
      .replace('#include <project_vertex>', /* glsl */`
#include <project_vertex>
vec4 worldPos   = modelMatrix * vec4(position, 1.0);
vWorldNormal    = normalize(mat3(modelMatrix) * objectNormal);
vWorldY         = worldPos.y;
vWorldXZ        = worldPos.xz;
vTerrainIdx     = terrainIdx;
vTerrainWgt     = terrainWgt;`)

    // ── Fragment shader ──────────────────────────────────────────────────────

    const hasTextures = textureArray !== null

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', /* glsl */`
${hasTextures ? 'uniform sampler2DArray uTerrainArray;' : ''}
uniform float uMapScale;
uniform float uTileScale;

varying vec3  vWorldNormal;
varying float vWorldY;
varying vec2  vWorldXZ;
varying vec3  vTerrainIdx;
varying vec3  vTerrainWgt;

void main() {`)
      .replace('#include <color_fragment>', /* glsl */`
#include <color_fragment>

{
  // ── Planar UV (tile) ───────────────────────────────────────────────────
  vec2 worldUv  = vWorldXZ / uMapScale;          // 0..1 na całą mapę
  vec2 tiledUv  = fract(worldUv * uTileScale);   // tile ×N

  // ── Texture blend ──────────────────────────────────────────────────────
  ${hasTextures ? /* glsl */`
  vec3 col0 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.x)).rgb;
  vec3 col1 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.y)).rgb;
  vec3 col2 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.z)).rgb;
  vec3 texColor = col0 * vTerrainWgt.x
                + col1 * vTerrainWgt.y
                + col2 * vTerrainWgt.z;
  ` : /* glsl */`
  vec3 texColor = diffuseColor.rgb;   // fallback: vertex colors
  `}

  // ── Candy boost ────────────────────────────────────────────────────────
  float luma   = dot(texColor, vec3(0.299, 0.587, 0.114));
  vec3 candy   = mix(vec3(luma), texColor, ${candySaturation.toFixed(3)});
  candy       *= ${candyBrightness.toFixed(3)};
  candy        = clamp(candy, 0.0, 1.0);

  // ── Frost na szczytach ─────────────────────────────────────────────────
  float frostBlend = smoothstep(${frostRange[0].toFixed(3)}, ${frostRange[1].toFixed(3)}, vWorldY);
  vec3  frostCol   = vec3(0.91, 0.86, 0.76);   // kremowy szron
  candy = mix(candy, frostCol, frostBlend * ${frostStrength.toFixed(3)});

  diffuseColor.rgb = candy;
}`)
  }

  return mat
}
