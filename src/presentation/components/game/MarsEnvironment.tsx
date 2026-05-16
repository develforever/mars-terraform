import { useFrame } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";

export function MarsEnvironment() {
    const sunRef = useRef<THREE.DirectionalLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    
    const sunT = useRef(0);
    const skySunPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const dayFogColor = useMemo(() => new THREE.Color("#452a2a"), []);
    const nightFogColor = useMemo(() => new THREE.Color("#020205"), []);
    const currentAtmosphereColor = useMemo(() => new THREE.Color(), []);

    const ambientRef = useRef<THREE.AmbientLight>(null);
    const starsRef = useRef<any>(null);

    useFrame((state, delta) => {
        sunT.current += delta * 0.05;
        const angle = sunT.current % (Math.PI * 2);
        const y = Math.cos(angle);
        const dayFactor = Math.max(0, y);
        setSun(dayFactor);
        
        // Obliczanie pozycji słońca dla nieba i oświetlenia
        const sunPos = new THREE.Vector3(
            Math.sin(angle) * 200,
            20 + 200 * dayFactor,
            Math.cos(angle) * 200
        );
        skySunPosition.current.copy(sunPos);

        if (sunRef.current) {
            sunRef.current.position.copy(sunPos);
            sunRef.current.intensity = 0.5 + 2.0 * dayFactor;
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
        </>
    );
}
