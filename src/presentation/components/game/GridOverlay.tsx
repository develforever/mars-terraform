import { useMemo, useEffect } from "react";
import * as THREE from "three";

interface GridOverlayProps {
    terrainSize: { x: number; z: number };
    visibilityMap?: THREE.Texture | null;
}

export function GridOverlay({ terrainSize, visibilityMap }: GridOverlayProps) {
    const uniforms = useMemo(() => ({
        uVisibilityMap: { value: visibilityMap || null },
        uGridColor: { value: new THREE.Color("#6f6f6f") },
        uSectionColor: { value: new THREE.Color("#ff5c1a") },
        uSize: { value: new THREE.Vector2(terrainSize.x, terrainSize.z) }
    }), []); // Stable reference

    useEffect(() => {
        uniforms.uVisibilityMap.value = visibilityMap || null;
    }, [visibilityMap, uniforms]);

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
                    varying vec2 vUv;

                    float grid(vec2 uv, float res) {
                        vec2 grid = fract(uv * res);
                        return 1.0 - smoothstep(0.0, 0.05, min(grid.x, grid.y)) * smoothstep(1.0, 0.95, max(grid.x, grid.y));
                    }

                    void main() {
                        vec2 gridUv = vUv * uSize;
                        
                        float g1 = grid(gridUv, 1.0);
                        float g2 = grid(gridUv, 0.2); // Section every 5 units
                        
                        float vis = texture2D(uVisibilityMap, vUv).r;
                        
                        vec3 color = mix(uGridColor, uSectionColor, g2);
                        float alpha = max(g1 * 0.3, g2 * 0.6) * (0.2 + vis * 0.8);
                        
                        if (alpha < 0.01) discard;
                        
                        gl_FragColor = vec4(color, alpha);
                    }
                `}
            />
        </mesh>
    );
}
