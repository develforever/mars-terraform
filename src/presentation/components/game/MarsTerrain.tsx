import { Mesh, type Texture, RepeatWrapping } from "three";
import { forwardRef, useMemo, useEffect } from "react";
import { TERRAIN_DISPLACEMENT_SCALE } from "../../utils/terrainDisplacement";

interface MarsTerrainProps {
    terrainSize: { x: number; z: number };
    colorMap: Texture;
    displacementMap: Texture;
    visibilityMap?: Texture | null;
}

export const MarsTerrain = forwardRef<Mesh, MarsTerrainProps>(
    ({ terrainSize, colorMap, displacementMap, visibilityMap }, ref) => {
        const uniforms = useMemo(() => ({
            uVisibilityMap: { value: visibilityMap || null }
        }), []); // Keep stable reference

        useEffect(() => {
            uniforms.uVisibilityMap.value = visibilityMap || null;
        }, [visibilityMap, uniforms]);

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
                             varying vec2 vWorldUv;`
                        );

                        shader.fragmentShader = shader.fragmentShader.replace(
                            `#include <dithering_fragment>`,
                            `#include <dithering_fragment>
                             float vis = texture2D(uVisibilityMap, vWorldUv).r;
                             gl_FragColor.rgb *= (0.15 + vis * 0.85);
                            `
                        );
                    }}
                />
            </mesh>
        );
    }
);

MarsTerrain.displayName = "MarsTerrain";
