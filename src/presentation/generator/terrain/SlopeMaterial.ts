/**
 * SlopeMaterial.ts
 *
 * Produkcyjny materiel terenu (Preview generatora = przyszly renderer rozgrywki).
 *
 * Podejscie (hybryda — spojne z trybem plaskim edycji):
 *   BAZA   = kolor biomu z palety (vertex color = TERRAIN_COLORS, blendowany
 *            per-vertex). Te same deep-rust kolory co tryb plaski -> brak
 *            rozjazdu miedzy widokami, brak widocznego kafelkowania.
 *   DETAL  = tekstura Marsa (2k_mars.jpg) probkowana TRIPLANAR, uzyta tylko
 *            jako modulacja jasnosci (+-20%) — daje fakture/relief bez
 *            powtarzajacych sie kraterow.
 *   SLOPE  = strome powierzchnie (klify/rampy) -> ciemniejsza, odsycona skala.
 *   HEIGHT = dna przyciemnione, szczyty + szron.
 *
 * Triplanar = zero rozciagania na pionowych sciankach klifow.
 */

import * as THREE from 'three'

export interface SlopeMaterialOptions {
  baseTexture?: THREE.Texture
  triScale?: number
  detailStrength?: number
  frostRange?: [number, number]
  frostStrength?: number
  heightRange?: [number, number]
}

export function createSlopeMaterial(opts: SlopeMaterialOptions = {}): THREE.MeshStandardMaterial {
  const baseTexture    = opts.baseTexture    ?? null
  const triScale       = opts.triScale       ?? 0.15
  const detailStrength = opts.detailStrength ?? 0.28
  const frostRange     = opts.frostRange     ?? [2.8, 4.0]
  const frostStrength  = opts.frostStrength  ?? 0.42
  const heightRange    = opts.heightRange    ?? [0.0, 4.0]

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  })

  const hasBase = baseTexture !== null

  mat.onBeforeCompile = (shader) => {
    if (baseTexture) shader.uniforms.uBaseMap = { value: baseTexture }
    shader.uniforms.uTriScale       = { value: triScale }
    shader.uniforms.uDetailStrength = { value: detailStrength }
    shader.uniforms.uHeightRange    = { value: new THREE.Vector2(heightRange[0], heightRange[1]) }

    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `
varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying float vWorldY;

void main() {`)
      .replace('#include <project_vertex>', `
#include <project_vertex>
vec4 _wp     = modelMatrix * vec4(position, 1.0);
vWorldPos    = _wp.xyz;
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
vWorldY      = _wp.y;`)

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `
${hasBase ? 'uniform sampler2D uBaseMap;' : ''}
uniform float uTriScale;
uniform float uDetailStrength;
uniform vec2  uHeightRange;

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying float vWorldY;

void main() {`)
      .replace('#include <color_fragment>', `
#include <color_fragment>
{
  vec3 wN = normalize(vWorldNormal);

  // Baza = kolor biomu (vertex color, deep-rust paleta)
  vec3 base = diffuseColor.rgb;

  ${hasBase ? `
  // Detal z tekstury Marsa (triplanar) — tylko modulacja jasnosci
  vec3 bw = abs(wN);
  bw = max(bw - 0.2, 0.0);
  bw /= dot(bw, vec3(1.0)) + 0.0001;
  float dxv = dot(texture2D(uBaseMap, vWorldPos.zy * uTriScale).rgb, vec3(0.3333));
  float dyv = dot(texture2D(uBaseMap, vWorldPos.xz * uTriScale).rgb, vec3(0.3333));
  float dzv = dot(texture2D(uBaseMap, vWorldPos.xy * uTriScale).rgb, vec3(0.3333));
  float detail = dxv * bw.x + dyv * bw.y + dzv * bw.z;
  base *= mix(1.0 - uDetailStrength, 1.0 + uDetailStrength, detail);
  ` : ``}

  // Slope-aware skala
  float slope = 1.0 - clamp(wN.y, 0.0, 1.0);
  float rockF = smoothstep(0.30, 0.72, slope);
  vec3  rock  = base * vec3(0.62, 0.58, 0.55);
  base = mix(base, rock, rockF);

  // Wysokosc — przyciemnij dna
  float h = clamp((vWorldY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 0.001), 0.0, 1.0);
  base *= mix(0.80, 1.0, smoothstep(0.0, 0.4, h));

  // Szron na szczytach
  float frostBlend = smoothstep(${frostRange[0].toFixed(3)}, ${frostRange[1].toFixed(3)}, vWorldY);
  vec3  frostCol   = vec3(0.74, 0.72, 0.68);
  base = mix(base, frostCol, frostBlend * ${frostStrength.toFixed(3)});

  diffuseColor.rgb = clamp(base, 0.0, 1.0);
}`)
  }

  return mat
}
