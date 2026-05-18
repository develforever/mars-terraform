import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SunProps {
    position: THREE.Vector3;
}

export function Sun({ position }: SunProps) {
    const sunRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        console.log("Sun component mounted at", position);
    }, []);

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
                <sphereGeometry args={[40, 32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Wewnętrzna gorąca korona */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[45, 32, 32]} />
                <meshBasicMaterial 
                    color="#fff5bb" 
                    transparent 
                    opacity={0.8} 
                    blending={THREE.AdditiveBlending}
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
                />
            </mesh>
            
            {/* Efekt "halo" / Flara - Proceduralna poświata radialna */}
            <mesh>
                <planeGeometry args={[800, 800]} />
                <shaderMaterial
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    uniforms={{
                        uColor: { value: new THREE.Color("#ffccaabb") },
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
