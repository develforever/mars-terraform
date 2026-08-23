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
  biosphere?: number
  waterLevel?: number
}

export function createSlopeMaterial(opts: SlopeMaterialOptions = {}): THREE.MeshStandardMaterial {
  const baseTexture    = opts.baseTexture    ?? null
  const triScale       = opts.triScale       ?? 0.15
  const detailStrength = opts.detailStrength ?? 0.28
  const frostRange     = opts.frostRange     ?? [2.8, 4.0]
  const frostStrength  = opts.frostStrength  ?? 0.42
  const heightRange    = opts.heightRange    ?? [0.0, 4.0]
  const biosphere      = opts.biosphere      ?? 0.0
  const waterLevel     = opts.waterLevel     ?? -0.5

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
    shader.uniforms.uBiosphere      = { value: biosphere }
    shader.uniforms.uWaterLevel     = { value: waterLevel }

    mat.userData.uniforms = shader.uniforms

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
uniform float uBiosphere;
uniform float uWaterLevel;

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

  // Slope obliczany z wektora normalnego
  float slope = 1.0 - clamp(wN.y, 0.0, 1.0);
  float flatness = smoothstep(0.40, 0.12, slope);

  // Biosphere greening: wilgotnosc shoreline + przejscia zieleni
  float heightAboveWater = max(0.0, vWorldY - uWaterLevel);
  float shorelineMoisture = exp(-heightAboveWater * 0.9);
  float altitudeFactor = clamp(1.0 - heightAboveWater / 3.5, 0.0, 1.0);
  float localMoisture = shorelineMoisture * 0.75 + altitudeFactor * 0.25;

  // Stopien zazielenienia (tylko na wzglednie plaskich topach - klify pozostaja skaliste)
  float vegFactor = clamp(uBiosphere * localMoisture * flatness, 0.0, 1.0);

  // Paleta biosfery: #2d5a27, #3e6b2c, #5a8f3d
  vec3 greenLow  = vec3(0.17647, 0.35294, 0.15294); // #2d5a27 ciemna zielen przywodna / mech
  vec3 greenMid  = vec3(0.24314, 0.41961, 0.17255); // #3e6b2c soczysta trawa nizinna
  vec3 greenHigh = vec3(0.35294, 0.56078, 0.23922); // #5a8f3d jasna roslinnosc wyzynna

  vec3 lushGreen = mix(greenLow, greenMid, smoothstep(0.0, 1.2, heightAboveWater));
  lushGreen = mix(lushGreen, greenHigh, smoothstep(1.2, 2.8, heightAboveWater));

  // Płynne przejscie z marsjanskiej rdzy w zyzne zielenie
  base = mix(base, lushGreen, vegFactor * 0.88);

  // Slope-aware skala (klify i strome sciany zachowuja triplanarna ciemna skale)
  float rockF = smoothstep(0.30, 0.72, slope);
  vec3  rock  = base * vec3(0.62, 0.58, 0.55);
  base = mix(base, rock, rockF);

  // Wysokosc — przyciemnij dna
  float h = clamp((vWorldY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 0.001), 0.0, 1.0);
  base *= mix(0.80, 1.0, smoothstep(0.0, 0.4, h));

  // Szron na szczytach (zmniejsza sie wraz z ociepleniem biosfery)
  float frostBlend = smoothstep(${frostRange[0].toFixed(3)}, ${frostRange[1].toFixed(3)}, vWorldY);
  vec3  frostCol   = vec3(0.74, 0.72, 0.68);
  float effFrostStrength = ${frostStrength.toFixed(3)} * max(0.2, 1.0 - uBiosphere * 0.7);
  base = mix(base, frostCol, frostBlend * effFrostStrength);

  diffuseColor.rgb = clamp(base, 0.0, 1.0);
}`)
  }

  return mat
}
