import { useFrame } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { Sun } from "./Sun";

export function MarsEnvironment() {
    const sunRef = useRef<THREE.PointLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    
    const skySunPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const dayFogColor = useMemo(() => new THREE.Color("#452a2a"), []);
    const nightFogColor = useMemo(() => new THREE.Color("#020205"), []);
    const currentAtmosphereColor = useMemo(() => new THREE.Color(), []);

    const ambientRef = useRef<THREE.AmbientLight>(null);
    const starsRef = useRef<any>(null);
    const weather = useGameStore(state => state.weather);
    const sandstormColor = useMemo(() => new THREE.Color("#8b5a2b"), []);

    useFrame((state, delta) => {
        const sunPos = new THREE.Vector3(0, 150, -800);
        // Pozycja słońca dla tła nieba - wektor kierunkowy od kamery do słońca
        skySunPosition.current.copy(sunPos).sub(state.camera.position).normalize();

        // Stały dayFactor dla poprawnej widoczności
        const dayFactor = 1.0;
        setSun(dayFactor);

        if (sunRef.current) {
            sunRef.current.position.copy(sunPos);
            sunRef.current.intensity = 3.0;
        }

        // Atmosfera uśredniona
        currentAtmosphereColor.copy(nightFogColor).lerp(dayFogColor, 0.5);
        
        // Modyfikacja koloru i gęstości przez pogodę (burza piaskowa)
        if (weather.type === "sandstorm") {
            const stormFactor = weather.intensity;
            currentAtmosphereColor.lerp(sandstormColor, stormFactor * 0.7);
        } else if (weather.type === "warning") {
            // Delikatne zmatowienie atmosfery przed burzą
            currentAtmosphereColor.lerp(sandstormColor, 0.2);
        }

        state.scene.background = currentAtmosphereColor;
        
        if (state.scene.fog) {
            state.scene.fog.color.copy(currentAtmosphereColor);
            
            // Zwiększenie gęstości mgły podczas burzy
            const baseDensity = 0.012;
            const stormDensity = 0.04;
            const targetDensity = weather.type === "sandstorm" 
                ? baseDensity + (stormDensity - baseDensity) * weather.intensity 
                : baseDensity;
            
            // Płynne przejście gęstości
            (state.scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(
                (state.scene.fog as THREE.FogExp2).density,
                targetDensity,
                delta * 2
            );
        }

        // Dynamiczne oświetlenie otoczenia i gwiazdy
        if (ambientRef.current) {
            ambientRef.current.intensity = 0.4;
        }
        if (starsRef.current) {
            // Ukryj gwiazdy podczas burzy
            starsRef.current.visible = weather.type !== "sandstorm";
            starsRef.current.rotation.y += delta * 0.01;
        }
    });

    return (
        <>
            <ambientLight ref={ambientRef} intensity={0.2} />
            <pointLight 
                ref={sunRef} 
                position={[0, 150, -800]} 
                intensity={3.0} 
                castShadow 
                shadow-mapSize={[2048, 2048]} 
                distance={0}
                decay={0}
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
                radius={20000} 
                depth={5000} 
                count={15000} 
                factor={20} 
                saturation={0} 
                fade 
                speed={1} 
            />

            <Sun position={new THREE.Vector3(0, 150, -800)} />
        </>
    );
}
