import { useFrame } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { Sun } from "./Sun";

/** Full day/night cycle duration in seconds (real time). */
const DAY_DURATION = 180;
/** Orbit radius of the sun around the scene center. */
const SUN_ORBIT_RADIUS = 800;
/** Reusable vector for sun world position — updated every frame. */
const SUN_POSITION = new THREE.Vector3();

export function MarsEnvironment() {
    const sunRef = useRef<THREE.PointLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    const sunGroupRef = useRef<THREE.Group>(null);

    const skySunPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const dayFogColor = useMemo(() => new THREE.Color("#452a2a"), []);
    const nightFogColor = useMemo(() => new THREE.Color("#020205"), []);
    const currentAtmosphereColor = useMemo(() => new THREE.Color(), []);

    const ambientRef = useRef<THREE.AmbientLight>(null);
    const starsRef = useRef<any>(null);
    const weather = useGameStore(state => state.weather);
    const sandstormColor = useMemo(() => new THREE.Color("#8b5a2b"), []);

    useFrame((state, delta) => {
        // --- Day/night cycle ---
        const t = (state.clock.elapsedTime % DAY_DURATION) / DAY_DURATION; // 0..1
        const sunAngle = t * Math.PI * 2 - Math.PI / 2; // starts at dawn

        SUN_POSITION.set(
            Math.cos(sunAngle) * SUN_ORBIT_RADIUS,
            Math.sin(sunAngle) * SUN_ORBIT_RADIUS,
            -200,
        );

        // dayFactor: 0 at midnight, 1 at noon (based on sun elevation)
        const dayFactor = Math.max(0, Math.sin(sunAngle + Math.PI / 2));
        setSun(dayFactor);

        if (sunGroupRef.current) {
            sunGroupRef.current.position.copy(SUN_POSITION);
        }

        // Pozycja słońca dla tła nieba - wektor kierunkowy od kamery do słońca
        skySunPosition.current.copy(SUN_POSITION).sub(state.camera.position).normalize();

        if (sunRef.current) {
            sunRef.current.position.copy(SUN_POSITION);
            sunRef.current.intensity = 2.5 * dayFactor;
        }

        // --- Atmosphere color blending ---
        currentAtmosphereColor.copy(nightFogColor).lerp(dayFogColor, dayFactor);

        // Modyfikacja koloru i gęstości przez pogodę (burza piaskowa)
        if (weather.type === "sandstorm") {
            const stormFactor = weather.intensity;
            currentAtmosphereColor.lerp(sandstormColor, stormFactor * 0.7);
        } else if (weather.type === "warning") {
            currentAtmosphereColor.lerp(sandstormColor, 0.2);
        }

        state.scene.background = currentAtmosphereColor;

        if (state.scene.fog) {
            state.scene.fog.color.copy(currentAtmosphereColor);

            const baseDensity = 0.012;
            const stormDensity = 0.04;
            const targetDensity = weather.type === "sandstorm"
                ? baseDensity + (stormDensity - baseDensity) * weather.intensity
                : baseDensity;

            (state.scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(
                (state.scene.fog as THREE.FogExp2).density,
                targetDensity,
                delta * 2
            );
        }

        // --- Ambient light & stars ---
        if (ambientRef.current) {
            ambientRef.current.intensity = 0.05 + dayFactor * 0.35;
        }
        if (starsRef.current) {
            starsRef.current.visible = dayFactor < 0.3 && weather.type !== "sandstorm";
            starsRef.current.rotation.y += delta * 0.01;
        }
    });

    return (
        <>
            <ambientLight ref={ambientRef} intensity={0.2} />
            <pointLight
                ref={sunRef}
                intensity={2.5}
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

            <group ref={sunGroupRef}>
                <Sun position={new THREE.Vector3(0, 0, 0)} />
            </group>
        </>
    );
}
