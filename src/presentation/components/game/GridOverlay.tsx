import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUIStore } from "../../../application/store/useUIStore";

interface GridOverlayProps {
    terrainSize: { x: number; z: number };
    visibilityMap?: THREE.Texture | null;
}

export function GridOverlay({ terrainSize, visibilityMap }: GridOverlayProps) {
    const uniforms = useMemo(() => ({
        uVisibilityMap: { value: visibilityMap || null },
        uGridColor:     { value: new THREE.Color("#6f6f6f") },
        uSectionColor:  { value: new THREE.Color("#ff5c1a") },
        uSize:          { value: new THREE.Vector2(terrainSize.x, terrainSize.z) },
        uHoverCell:     { value: new THREE.Vector2(-9999, -9999) },
        uBuildMode:     { value: 0 }, // 0=none, 1=place, 2=demolish
    }), [terrainSize.x, terrainSize.z, visibilityMap]);

    useEffect(() => {
        uniforms.uVisibilityMap.value = visibilityMap || null;
    }, [visibilityMap, uniforms]);

    // Push hover cell and build mode to shader every frame
    useFrame(() => {
        const { hoverCell, buildMode } = useUIStore.getState();
        uniforms.uHoverCell.value.set(
            hoverCell ? hoverCell.x : -9999,
            hoverCell ? hoverCell.z : -9999
        );
        uniforms.uBuildMode.value = buildMode === "place" ? 1 : buildMode === "demolish" ? 2 : 0;
    });

    return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}>
            <planeGeometry args={[terrainSize.x, terrainSize.z]} />
            <shaderMaterial
                transparent
                uniforms={uniforms}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform sampler2D uVisibilityMap;
                    uniform vec3 uGridColor;
                    uniform vec3 uSectionColor;
                    uniform vec2 uSize;
                    uniform vec2 uHoverCell;
                    uniform int  uBuildMode;
                    varying vec2 vUv;

                    float grid(vec2 uv, float res) {
                        vec2 g = fract(uv * res);
                        return 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y))
                                   * smoothstep(1.0, 0.95, max(g.x, g.y));
                    }

                    void main() {
                        vec2 worldPos = (vUv - 0.5) * uSize; // world-space XZ
                        vec2 gridUv   = vUv * uSize;

                        float g1 = grid(gridUv, 1.0);
                        float g2 = grid(gridUv, 0.2);

                        float vis = texture2D(uVisibilityMap, vUv).r;

                        vec3 color = mix(uGridColor, uSectionColor, g2);
                        float alpha = max(g1 * 0.3, g2 * 0.6) * (0.2 + vis * 0.8);

                        // Hover cell highlight
                        if (uBuildMode > 0) {
                            vec2 cellCenter = floor(worldPos) + 0.5;
                            vec2 hoverCenter = floor(uHoverCell) + 0.5;
                            float dist = length(cellCenter - hoverCenter);
                            if (dist < 0.6) {
                                // Exact hover cell
                                vec3 hoverColor = uBuildMode == 1
                                    ? vec3(0.0, 1.0, 0.53)   // green for place
                                    : vec3(1.0, 0.13, 0.13);  // red for demolish
                                gl_FragColor = vec4(hoverColor, 0.35);
                                return;
                            } else if (dist < 1.5) {
                                // Adjacent ring — subtle tint
                                vec3 ringColor = uBuildMode == 1
                                    ? vec3(0.0, 0.8, 0.4)
                                    : vec3(0.9, 0.1, 0.1);
                                color = mix(color, ringColor, 0.25);
                                alpha = max(alpha, 0.12);
                            }
                        }

                        if (alpha < 0.01) discard;
                        gl_FragColor = vec4(color, alpha);
                    }
                `}
            />
        </mesh>
    );
}
