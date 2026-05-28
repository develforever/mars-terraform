import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface SunProps {
    position: THREE.Vector3;
}

export function Sun({ position }: SunProps) {
    const sunRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    const [colorMap, dispMap] = useTexture([
        "/textures/2k_sun.jpg",
        "/textures/2k_sun_displacement.jpg",
    ]);

    useMemo(() => {
        [colorMap, dispMap].forEach((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(1, 1);
        });
    }, [colorMap, dispMap]);

    useFrame((state) => {
        if (sunRef.current) {
            sunRef.current.position.copy(position);
            sunRef.current.lookAt(state.camera.position);
        }

        if (glowRef.current) {
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
            glowRef.current.scale.set(scale, scale, scale);
            glowRef.current.rotation.z += 0.005;
        }
    });

    return (
        <group ref={sunRef}>
            {/* Główne ciało słońca - Jasne, widoczne z oddali */}
            <mesh>
                <sphereGeometry args={[40, 128, 128]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={dispMap}
                    displacementScale={0.6}
                    emissive={new THREE.Color("#ffffff")}
                    emissiveMap={colorMap}
                    emissiveIntensity={2}
                    roughness={1}
                    metalness={0}
                    fog={false}
                />
            </mesh>

            {/* Wewnętrzna gorąca korona */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[45, 32, 32]} />
                <meshBasicMaterial
                    color="#fff5bb"
                    transparent
                    opacity={0.8}
                    blending={THREE.AdditiveBlending}
                    fog={false}
                />
            </mesh>

            {/* Główna poświata (aura) */}
            <mesh>
                <sphereGeometry args={[80, 32, 32]} />
                <meshBasicMaterial
                    color="#ffcc33"
                    transparent
                    opacity={0.5}
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                    fog={false}
                />
            </mesh>

            {/* Szeroka atmosfera słoneczna */}
            <mesh>
                <sphereGeometry args={[160, 32, 32]} />
                <meshBasicMaterial
                    color="#ff6600"
                    transparent
                    opacity={0.2}
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                    fog={false}
                />
            </mesh>

            {/* Efekt "halo" / Flara - Proceduralna poświata radialna */}
            <mesh>
                <planeGeometry args={[800, 800]} />
                <shaderMaterial
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    fog={false}
                    uniforms={{
                        uColor: { value: new THREE.Color("#ffccaa") },
                        uOpacity: { value: 0.15 }
                    }}
                    vertexShader={`
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `}
                    fragmentShader={`
                        varying vec2 vUv;
                        uniform vec3 uColor;
                        uniform float uOpacity;
                        void main() {
                            float dist = distance(vUv, vec2(0.5));
                            float glow = smoothstep(0.5, 0.0, dist);
                            glow = pow(glow, 2.0); // Bardziej miękkie przejście
                            gl_FragColor = vec4(uColor, glow * uOpacity);
                        }
                    `}
                />
            </mesh>
        </group>
    );
}
