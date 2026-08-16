import { Mesh, type Texture, RepeatWrapping, Vector2 } from "three";
import { forwardRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { TERRAIN_DISPLACEMENT_SCALE } from "../../utils/terrainDisplacement";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";

interface MarsTerrainProps {
    terrainSize: { x: number; z: number };
    colorMap: Texture;
    displacementMap: Texture;
    visibilityMap?: Texture | null;
    dataMap?: Texture | null;
}

const GRID_VERT = `
  varying vec2 vWorldUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalWorld;
  varying float vEdgeDist;

  void insertAfterCommon() {
    vWorldUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vEdgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  }
`;

const GRID_FRAG = `
  uniform sampler2D uVisibilityMap;
  uniform sampler2D uDataMap;
  uniform float uSunFactor;
  uniform vec2 uSize;
  uniform vec2 uHoverCell;
  uniform int uBuildMode;

  varying vec2 vWorldUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalWorld;
  varying float vEdgeDist;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float gridLine(vec2 pos, float res) {
    vec2 g = fract(pos * res);
    return 1.0 - smoothstep(0.0, 0.04, min(g.x, g.y)) * smoothstep(1.0, 0.96, max(g.x, g.y));
  }

  vec4 triplanarSample(sampler2D map, vec3 wPos, vec3 wNorm) {
    vec3 b = abs(wNorm);
    b = max(b - 0.2, 0.0);
    b /= dot(b, vec3(1.0)) + 0.0001;
    vec4 cx = texture2D(map, wPos.yz * 0.05);
    vec4 cy = texture2D(map, wPos.xz * 0.05);
    vec4 cz = texture2D(map, wPos.xy * 0.05);
    return cx * b.x + cy * b.y + cz * b.z;
  }

  void applyTerrainEffects(inout vec4 color) {
    // 1. Visibility / fog-of-war
    float vis = texture2D(uVisibilityMap, vWorldUv).r;
    float visMask = 0.35 + vis * 0.65;
    color.rgb *= visMask;

    // 2. Moonlight floor (warm mars tones)
    float night = 1.0 - uSunFactor;
    vec3 moonFloor = vec3(0.10, 0.05, 0.03) * night;
    color.rgb += moonFloor;

    // 3. Edge fade into fog
    float edgeFade = smoothstep(0.0, 0.06, vEdgeDist);
    color.a *= edgeFade;

    // 4. Integrated grid on terrain
    float g1 = gridLine(vWorldPos.xz, 1.0);
    float g2 = gridLine(vWorldPos.xz, 0.2);
    vec3 gridCol = mix(vec3(0.44, 0.44, 0.44), vec3(1.0, 0.36, 0.1), g2);
    float buildFactor = (uBuildMode > 0) ? 1.0 : 0.08;
    float gridAlpha = max(g1 * 0.25, g2 * 0.45) * (0.15 + vis * 0.85) * buildFactor;
    color.rgb = mix(color.rgb, gridCol, gridAlpha * edgeFade);

    // 5. Cell highlight
    if (uBuildMode > 0) {
      vec2 cellCenter = floor(vWorldPos.xz) + 0.5;
      vec2 hoverCenter = floor(uHoverCell) + 0.5;
      float dist = length(cellCenter - hoverCenter);
      if (dist < 0.6) {
        vec3 hcol = (uBuildMode == 1) ? vec3(0.15, 0.78, 0.47) : vec3(1.0, 0.13, 0.13);
        color.rgb = mix(color.rgb, hcol, 0.18);
      } else if (dist < 1.5) {
        vec3 rcol = (uBuildMode == 1) ? vec3(0.12, 0.65, 0.35) : vec3(0.9, 0.1, 0.1);
        color.rgb = mix(color.rgb, rcol, 0.08);
      }
    }

    // 6. Data map overlay (building positions, ranges, alien danger)
    vec4 data = texture2D(uDataMap, vWorldUv);
    if (data.a > 0.01) {
      // Red channel = danger zones (aliens)
      if (data.r > 0.01) {
        color.rgb = mix(color.rgb, vec3(1.0, 0.2, 0.2), data.r * 0.5 * edgeFade);
      }
      // Green channel = building positions / hover range
      if (data.g > 0.01) {
        color.rgb = mix(color.rgb, vec3(0.15, 0.78, 0.47), data.g * 0.15 * edgeFade);
      }
      // Blue channel = subtle range rings
      if (data.b > 0.01) {
        color.rgb = mix(color.rgb, vec3(0.5, 0.8, 1.0), data.b * 0.3 * edgeFade);
      }
    }
  }
`;

export const MarsTerrain = forwardRef<Mesh, MarsTerrainProps>(
    ({ terrainSize, colorMap, displacementMap, visibilityMap, dataMap }, ref) => {
        const uniforms = useMemo(() => ({
            uVisibilityMap: { value: visibilityMap || null },
            uDataMap: { value: dataMap || null },
            uSunFactor: { value: 1.0 },
            uSize: { value: new Vector2(terrainSize.x, terrainSize.z) },
            uHoverCell: { value: new Vector2(-9999, -9999) },
            uBuildMode: { value: 0 },
        }), [dataMap, terrainSize.x, terrainSize.z, visibilityMap]);

        useEffect(() => {
            uniforms.uVisibilityMap.value = visibilityMap || null;
        }, [visibilityMap, uniforms]);

        useEffect(() => {
            uniforms.uDataMap.value = dataMap || null;
        }, [dataMap, uniforms]);

        useFrame(() => {
            uniforms.uSunFactor.value = useGameStore.getState().sun;
            const { hoverCell, buildMode } = useUIStore.getState();
            uniforms.uHoverCell.value.set(
                hoverCell ? hoverCell.x : -9999,
                hoverCell ? hoverCell.z : -9999
            );
            uniforms.uBuildMode.value =
                buildMode === "place" ? 1 : buildMode === "demolish" ? 2 : 0;
        });

        useMemo(() => {
            [colorMap, displacementMap].forEach((t) => {
                t.wrapS = t.wrapT = RepeatWrapping;
                t.repeat.set(1, 1);
            });
        }, [colorMap, displacementMap]);

        return (
            <mesh ref={ref} rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[terrainSize.x, terrainSize.z, 256, 256]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={displacementMap}
                    displacementScale={TERRAIN_DISPLACEMENT_SCALE}
                    roughness={0.9}
                    metalness={0.1}
                    transparent
                    onBeforeCompile={(shader) => {
                        shader.uniforms.uVisibilityMap = uniforms.uVisibilityMap;
                        shader.uniforms.uDataMap = uniforms.uDataMap;
                        shader.uniforms.uSunFactor = uniforms.uSunFactor;
                        shader.uniforms.uSize = uniforms.uSize;
                        shader.uniforms.uHoverCell = uniforms.uHoverCell;
                        shader.uniforms.uBuildMode = uniforms.uBuildMode;

                        shader.vertexShader = shader.vertexShader.replace(
                            `#include <common>`,
                            `#include <common>
                             ${GRID_VERT}`
                        );
                        shader.vertexShader = shader.vertexShader.replace(
                            `#include <uv_vertex>`,
                            `#include <uv_vertex>
                             insertAfterCommon();`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <map_fragment>`,
                            `#ifdef USE_MAP
                                vec4 sampledDiffuseColor = triplanarSample(map, vWorldPos, vNormalWorld);
                                sampledDiffuseColor = sRGBTransferOETF(sampledDiffuseColor);
                                diffuseColor *= sampledDiffuseColor;
                                float detail = noise(vWorldPos.xz * 12.0) * 0.08 + 0.92;
                                diffuseColor.rgb *= detail;
                            #endif`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <common>`,
                            `#include <common>
                             ${GRID_FRAG}`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <dithering_fragment>`,
                            `#include <dithering_fragment>
                             applyTerrainEffects(gl_FragColor);`
                        );
                    }}
                />
            </mesh>
        );
    }
);

MarsTerrain.displayName = "MarsTerrain";
