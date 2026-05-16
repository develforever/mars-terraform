import { useFrame } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { Sun } from "./Sun";

export function MarsEnvironment() {
    const sunRef = useRef<THREE.DirectionalLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    
    const sunT = useRef(Math.PI * 1.2); // Start w pozycji widocznej w tle
    const skySunPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const dayFogColor = useMemo(() => new THREE.Color("#452a2a"), []);
    const nightFogColor = useMemo(() => new THREE.Color("#020205"), []);
    const currentAtmosphereColor = useMemo(() => new THREE.Color(), []);

    const ambientRef = useRef<THREE.AmbientLight>(null);
    const starsRef = useRef<any>(null);

    useFrame((state, delta) => {
        // Normalna prędkość czasu
        sunT.current += delta * 0.05;
        const angle = sunT.current;
        
        // Pełna orbita 3D wokół Marsa
        const distance = 800;
        const sunPos = new THREE.Vector3(
            Math.sin(angle) * distance,
            Math.sin(angle * 0.5) * distance * 0.5, // Lekkie nachylenie orbity
            Math.cos(angle) * distance
        );
        
        skySunPosition.current.copy(sunPos);

        // Obliczanie jasności na podstawie pozycji słońca (kiedy jest nad horyzontem Marsa względem środka)
        // Dla uproszczenia w kosmosie sun jest zawsze jasny, ale oświetlenie planety zależy od kąta.
        const dayFactor = Math.max(0, sunPos.y / distance + 0.5);
        setSun(dayFactor);

        if (sunRef.current) {
            sunRef.current.position.copy(sunPos);
            sunRef.current.intensity = 0.5 + 2.5 * dayFactor;
        }

        // Dynamiczna atmosfera i tło
        currentAtmosphereColor.copy(nightFogColor).lerp(dayFogColor, dayFactor);
        state.scene.background = currentAtmosphereColor;
        if (state.scene.fog) {
            state.scene.fog.color.copy(currentAtmosphereColor);
        }

        // Dynamiczne oświetlenie otoczenia i gwiazdy
        if (ambientRef.current) {
            ambientRef.current.intensity = 0.1 + 0.3 * dayFactor;
        }
        if (starsRef.current) {
            starsRef.current.visible = dayFactor < 0.2;
            starsRef.current.rotation.y += delta * 0.01;
        }
    });

    return (
        <>
            <ambientLight ref={ambientRef} intensity={0.2} />
            <directionalLight 
                ref={sunRef} 
                position={[10, 15, 5]} 
                intensity={1.5} 
                castShadow 
                shadow-mapSize={[1024, 1024]} 
            />

            <fogExp2 attach="fog" args={["#000000", 0.012]} />

            <Sky 
                distance={450000} 
                sunPosition={skySunPosition.current} 
                mieCoefficient={0.005}
                mieDirectionalG={0.8}
                rayleigh={0.5}
                turbidity={10}
            />

            <Stars 
                ref={starsRef} 
                radius={150} 
                depth={50} 
                count={5000} 
                factor={4} 
                saturation={0} 
                fade 
                speed={1} 
            />

            <Sun position={skySunPosition.current} />
        </>
    );
}
