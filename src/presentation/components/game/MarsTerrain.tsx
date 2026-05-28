import { Mesh, type Texture, RepeatWrapping } from "three";
import { forwardRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { TERRAIN_DISPLACEMENT_SCALE } from "../../utils/terrainDisplacement";
import { useGameStore } from "../../../application/store/useGameStore";

interface MarsTerrainProps {
    terrainSize: { x: number; z: number };
    colorMap: Texture;
    displacementMap: Texture;
    visibilityMap?: Texture | null;
}

export const MarsTerrain = forwardRef<Mesh, MarsTerrainProps>(
    ({ terrainSize, colorMap, displacementMap, visibilityMap }, ref) => {
        const uniforms = useMemo(() => ({
            uVisibilityMap: { value: visibilityMap || null },
            uSunFactor: { value: 1.0 },
        }), []); // Keep stable reference

        useEffect(() => {
            uniforms.uVisibilityMap.value = visibilityMap || null;
        }, [visibilityMap, uniforms]);

        // Read sun directly from store each frame — avoids stale React closure
        useFrame(() => {
            uniforms.uSunFactor.value = useGameStore.getState().sun;
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
                    onBeforeCompile={(shader) => {
                        shader.uniforms.uVisibilityMap = uniforms.uVisibilityMap;
                        shader.uniforms.uSunFactor = uniforms.uSunFactor;
                        
                        shader.vertexShader = shader.vertexShader.replace(
                            `#include <common>`,
                            `#include <common>
                             varying vec2 vWorldUv;`
                        );
                        
                        shader.vertexShader = shader.vertexShader.replace(
                            `#include <uv_vertex>`,
                            `#include <uv_vertex>
                             vWorldUv = uv;`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <common>`,
                            `#include <common>
                             uniform sampler2D uVisibilityMap;
                             uniform float uSunFactor;
                             varying vec2 vWorldUv;`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <dithering_fragment>`,
                            `#include <dithering_fragment>
                             float vis = texture2D(uVisibilityMap, vWorldUv).r;
                             // Fog-of-war: minimum 0.35 so unexplored areas are still dimly visible
                             float visMask = 0.35 + vis * 0.65;
                             gl_FragColor.rgb *= visMask;
                             // Moonlight floor: additive grey-blue so night is never black
                             float night = 1.0 - uSunFactor;
                             vec3 moonFloor = vec3(0.06, 0.065, 0.09) * night;
                             gl_FragColor.rgb += moonFloor;
                            `
                        );
                    }}
                />
            </mesh>
        );
    }
);

MarsTerrain.displayName = "MarsTerrain";
