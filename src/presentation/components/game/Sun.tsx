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
            {/* Główne ciało słońca - EKSTREMALNIE JASNE I DUŻE (radius 100) */}
            <mesh>
                <sphereGeometry args={[100, 32, 32]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Wewnętrzna gorąca korona */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[30, 32, 32]} />
                <meshBasicMaterial 
                    color="#fff5bb" 
                    transparent 
                    opacity={0.8} 
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Główna poświata (aura) */}
            <mesh>
                <sphereGeometry args={[60, 32, 32]} />
                <meshBasicMaterial 
                    color="#ffcc33" 
                    transparent 
                    opacity={0.4} 
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Szeroka atmosfera słoneczna */}
            <mesh>
                <sphereGeometry args={[120, 32, 32]} />
                <meshBasicMaterial 
                    color="#ff6600" 
                    transparent 
                    opacity={0.15} 
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                />
            </mesh>
            
            {/* Efekt "halo" - duży płaski billboard */}
            <mesh>
                <planeGeometry args={[500, 500]} />
                <meshBasicMaterial
                    transparent
                    opacity={0.08}
                    color="#ffddaa"
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
