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
            
            {/* Efekt "halo" / Flara - bardzo duży, by dawać efekt blasku na całą scenę */}
            <mesh>
                <planeGeometry args={[800, 800]} />
                <meshBasicMaterial
                    transparent
                    opacity={0.15}
                    color="#ffddaa"
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
