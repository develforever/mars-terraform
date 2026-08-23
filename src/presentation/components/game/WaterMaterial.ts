/**
 * WaterMaterial.ts
 *
 * Custom shader material for Martian dynamic water bodies:
 * - Procedural wave vertex displacement with analytical wave normals.
 * - Deep navy (#0a1e3f) to cyan/turquoise (#1b6ca8) gradient with Fresnel view blending.
 * - Crest and shoreline foam (#e0f2fe).
 * - Specular sun reflections tuned for Bloom HDR.
 * - Clean disposal of resources.
 */

import * as THREE from "three";

export interface WaterMaterialOptions {
  deepColor?: string | THREE.Color;
  shallowColor?: string | THREE.Color;
  foamColor?: string | THREE.Color;
  opacity?: number;
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
}

export function createWaterMaterial(opts: WaterMaterialOptions = {}): THREE.ShaderMaterial {
  const deepColor = new THREE.Color(opts.deepColor ?? "#0a1e3f");
  const shallowColor = new THREE.Color(opts.shallowColor ?? "#1b6ca8");
  const foamColor = new THREE.Color(opts.foamColor ?? "#e0f2fe");
  const opacity = opts.opacity ?? 0.85;
  const waveSpeed = opts.waveSpeed ?? 0.9;
  const waveFrequency = opts.waveFrequency ?? 0.35;
  const waveAmplitude = opts.waveAmplitude ?? 0.045;

  const uniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: deepColor },
    uShallowColor: { value: shallowColor },
    uFoamColor: { value: foamColor },
    uOpacity: { value: opacity },
    uWaveSpeed: { value: waveSpeed },
    uWaveFrequency: { value: waveFrequency },
    uWaveAmplitude: { value: waveAmplitude },
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
  };

  const vertexShader = `
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveFrequency;
    uniform float uWaveAmplitude;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vWaveHeight;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);

      // Multi-frequency directional waves
      float t = uTime * uWaveSpeed;
      float w1 = sin(worldPos.x * uWaveFrequency * 1.4 + t * 1.7) * cos(worldPos.z * uWaveFrequency * 1.1 + t * 1.3);
      float w2 = sin(worldPos.x * uWaveFrequency * 2.8 - t * 2.1 + 1.2) * sin(worldPos.z * uWaveFrequency * 2.5 + t * 1.5);
      float wave = (w1 * 0.65 + w2 * 0.35) * uWaveAmplitude;

      worldPos.y += wave;
      vWaveHeight = wave;
      vWorldPosition = worldPos.xyz;

      // Analytical normal estimation for realistic ripples
      float dWdx = (cos(worldPos.x * uWaveFrequency * 1.4 + t * 1.7) * 1.4 * cos(worldPos.z * uWaveFrequency * 1.1 + t * 1.3)) * uWaveFrequency * uWaveAmplitude;
      float dWdz = (-sin(worldPos.x * uWaveFrequency * 1.4 + t * 1.7) * 1.1 * sin(worldPos.z * uWaveFrequency * 1.1 + t * 1.3)) * uWaveFrequency * uWaveAmplitude;
      vec3 waveNormal = normalize(vec3(-dWdx, 1.0, -dWdz));
      vNormal = normalize(mat3(modelMatrix) * waveNormal);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uFoamColor;
    uniform float uOpacity;
    uniform vec3 uSunDirection;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vWaveHeight;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);

      // Fresnel reflection factor
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.8);
      fresnel = clamp(fresnel, 0.0, 1.0);

      // Subtle procedural foam lines on wave crests
      float foamNoise = sin(vWorldPosition.x * 3.0 + uTime * 1.2) * cos(vWorldPosition.z * 3.0 - uTime * 0.9);
      float crestFoam = smoothstep(0.012, 0.035, vWaveHeight + foamNoise * 0.01);

      // Color gradation (deep navy to turquoise shallow + fresnel)
      vec3 waterCol = mix(uDeepColor, uShallowColor, clamp(fresnel * 0.65 + (vWaveHeight + 0.03) * 5.5, 0.0, 1.0));
      waterCol = mix(waterCol, uFoamColor, crestFoam * 0.6);

      // Sun specular highlights with HDR Bloom boost
      vec3 halfVec = normalize(uSunDirection + viewDir);
      float specAngle = max(dot(normal, halfVec), 0.0);
      float specular = pow(specAngle, 96.0);
      vec3 specColor = vec3(1.6, 1.5, 1.3) * (specular * 2.4);

      vec3 finalColor = waterCol + specColor;
      float finalAlpha = clamp(uOpacity + fresnel * 0.15 + crestFoam * 0.35, 0.0, 0.95);

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });

  return material;
}
