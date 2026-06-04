/**
 * SlopeMaterial.ts
 *
 * MeshStandardMaterial z shader slope-blending + efektem szronu.
 * Używa vertex colors + world-space normals (brak tekstur).
 *
 * slope = dot(worldNormal, up)
 *   ≈ 1.0  → płasko  → kolor biome (vertex colors)
 *   ≈ 0.0  → pionowo → cliffColor (ciemny bazalt)
 *
 * frost (szron): worldY > frostStart → jasny odcień na szczytach
 */

import * as THREE from 'three'

// ─── Opcje ────────────────────────────────────────────────────────────────────

export interface SlopeMaterialOptions {
  /** smoothstep [stromy, łagodny] → [0,1]; domyślnie [0.30, 0.65] */
  cliffBlend?: [number, number]
  /** Kolor urwisk (ciemny bazalt marsjański) */
  cliffColor?: THREE.Color
  /** Zakres worldY dla szronu [start_Y, full_Y]; domyślnie [2.8, 4.0] */
  frostRange?: [number, number]
  /** Kolor szronu/lodu */
  frostColor?: THREE.Color
  /** Siła szronu 0..1; domyślnie 0.55 */
  frostStrength?: number
}

// ─── createSlopeMaterial ──────────────────────────────────────────────────────

export function createSlopeMaterial(opts: SlopeMaterialOptions = {}): THREE.MeshStandardMaterial {
  const cliffBlend    = opts.cliffBlend    ?? [0.30, 0.65]
  const cliffColor    = opts.cliffColor    ?? new THREE.Color(0x1a0c05)
  const frostRange    = opts.frostRange    ?? [2.8, 4.0]
  const frostColor    = opts.frostColor    ?? new THREE.Color(0xcec4b0)
  const frostStrength = opts.frostStrength ?? 0.55

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
  })

  mat.onBeforeCompile = (shader) => {
    // ── Vertex shader ──────────────────────────────────────────────────────
    // Dodaj varyings + oblicz worldNormal i worldY

    shader.vertexShader = shader.vertexShader
      // Deklaracje varyings (przed void main)
      .replace(
        'void main() {',
        /* glsl */`
varying vec3 vWorldNormal;
varying float vWorldY;

void main() {`,
      )
      // Oblicz wartości po #include <project_vertex>
      .replace(
        '#include <project_vertex>',
        /* glsl */`
#include <project_vertex>
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
vWorldY = (modelMatrix * vec4(position, 1.0)).y;`,
      )

    // ── Fragment shader ────────────────────────────────────────────────────
    // Deklaracje varyings (przed void main)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */`
varying vec3 vWorldNormal;
varying float vWorldY;

void main() {`,
      )
      // Slope + frost blending po obliczeniu diffuseColor
      .replace(
        '#include <color_fragment>',
        /* glsl */`
#include <color_fragment>

{
  // slope: 1.0 = płasko, 0.0 = pionowo (urwisko)
  float slope = clamp(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
  float slopeBlend = smoothstep(${cliffBlend[0].toFixed(3)}, ${cliffBlend[1].toFixed(3)}, slope);

  vec3 cliffCol = vec3(${cliffColor.r.toFixed(4)}, ${cliffColor.g.toFixed(4)}, ${cliffColor.b.toFixed(4)});
  diffuseColor.rgb = mix(cliffCol, diffuseColor.rgb, slopeBlend);

  // frost: jasny odcień na wysokich partiach (tylko płaskie powierzchnie)
  float frostBlend = smoothstep(${frostRange[0].toFixed(3)}, ${frostRange[1].toFixed(3)}, vWorldY);
  vec3 frostCol = vec3(${frostColor.r.toFixed(4)}, ${frostColor.g.toFixed(4)}, ${frostColor.b.toFixed(4)});
  diffuseColor.rgb = mix(diffuseColor.rgb, frostCol, frostBlend * ${frostStrength.toFixed(3)} * slopeBlend);
}`,
      )
  }

  return mat
}
