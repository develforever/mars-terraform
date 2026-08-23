import { useFrame } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { WeatherService } from "../../../domain/services/WeatherService";
import { Sun } from "./Sun";

/** Full day/night cycle duration in seconds (real time). */
const DAY_DURATION = 180;
/** Orbit radius of the sun around the scene center. */
const SUN_ORBIT_RADIUS = 800;
/** Reusable vector for sun world position — updated every frame. */
const SUN_POSITION = new THREE.Vector3();

export function AtmosphereSky() {
    const sunRef = useRef<THREE.PointLight>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);
    const hemiRef = useRef<THREE.HemisphereLight>(null);
    const moonLightRef = useRef<THREE.DirectionalLight>(null);
    const starsRef = useRef<THREE.Points>(null);
    const sunGroupRef = useRef<THREE.Group>(null);

    const setSun = useGameStore((state) => state.setSun);
    const terraforming = useGameStore((state) => state.terraforming);
    const o2Accumulated = useGameStore((state) => state.o2Accumulated);
    const weather = useGameStore((state) => state.weather);

    const skySunPosition = useRef<THREE.Vector3>(new THREE.Vector3());

    // Color containers for smooth per-frame lerping
    const currentSkyColor = useMemo(() => new THREE.Color("#0a0814"), []);
    const currentFogColor = useMemo(() => new THREE.Color("#452a2a"), []);
    const currentSunColor = useMemo(() => new THREE.Color("#ffe4c4"), []);
    const currentAmbientColor = useMemo(() => new THREE.Color("#b06040"), []);

    const targetSkyColor = useMemo(() => new THREE.Color(), []);
    const targetFogColor = useMemo(() => new THREE.Color(), []);
    const targetSunColor = useMemo(() => new THREE.Color(), []);
    const targetAmbientColor = useMemo(() => new THREE.Color(), []);

    // Optical Sky shader props ref
    const skyShaderProps = useRef({
        turbidity: 10,
        rayleigh: 0.5,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
    });

    useFrame((state, delta) => {
        // --- Day/night cycle calculation ---
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
            sunGroupRef.current.visible = SUN_POSITION.y > -80;
        }

        // Sky sun direction vector relative to camera
        skySunPosition.current.copy(SUN_POSITION).sub(state.camera.position).normalize();

        // Calculate dynamic atmosphere parameters based on terraforming & weather
        const atmo = WeatherService.getAtmosphereProperties(
            terraforming,
            o2Accumulated,
            weather,
            dayFactor
        );

        targetSkyColor.set(atmo.skyColor);
        targetFogColor.set(atmo.fogColor);
        targetSunColor.set(atmo.sunColor);
        targetAmbientColor.set(atmo.ambientColor);

        // Smooth color transitions
        const lerpAlpha = Math.min(1, delta * 3.5);
        currentSkyColor.lerp(targetSkyColor, lerpAlpha);
        currentFogColor.lerp(targetFogColor, lerpAlpha);
        currentSunColor.lerp(targetSunColor, lerpAlpha);
        currentAmbientColor.lerp(targetAmbientColor, lerpAlpha);

        state.scene.background = currentSkyColor;

        // Dynamic fog
        if (state.scene.fog) {
            state.scene.fog.color.copy(currentFogColor);
            const fog = state.scene.fog as THREE.FogExp2;
            fog.density = THREE.MathUtils.lerp(fog.density, atmo.fogDensity, lerpAlpha);
        }

        // Dynamic point sun light
        if (sunRef.current) {
            sunRef.current.position.copy(SUN_POSITION);
            sunRef.current.color.copy(currentSunColor);
            sunRef.current.intensity = THREE.MathUtils.lerp(
                sunRef.current.intensity,
                atmo.sunIntensity,
                lerpAlpha
            );
        }

        // Dynamic ambient light
        if (ambientRef.current) {
            ambientRef.current.color.copy(currentAmbientColor);
            ambientRef.current.intensity = THREE.MathUtils.lerp(
                ambientRef.current.intensity,
                atmo.ambientIntensity,
                lerpAlpha
            );
        }

        // Fill hemisphere lighting
        if (hemiRef.current) {
            hemiRef.current.color.copy(currentAmbientColor);
            const groundColorTarget = terraforming > 50 ? "#142514" : "#1a0f0a";
            hemiRef.current.groundColor.set(groundColorTarget);
            hemiRef.current.intensity = THREE.MathUtils.lerp(
                hemiRef.current.intensity,
                0.6 + dayFactor * 0.4,
                lerpAlpha
            );
        }

        // Night fill light (moon / planetary reflection)
        if (moonLightRef.current) {
            moonLightRef.current.intensity = (1 - dayFactor) * (terraforming > 50 ? 0.35 : 0.5);
        }

        // Stars visibility
        if (starsRef.current) {
            const isStorm = WeatherService.isDustStorm(weather.type);
            // In terraformed thick atmosphere, stars fade faster during dawn/day
            const maxDayVisibility = 0.3 - (terraforming / 100) * 0.15;
            starsRef.current.visible = dayFactor < maxDayVisibility && !isStorm;
        }

        // Lerp Sky shader optical constants
        skyShaderProps.current.turbidity = THREE.MathUtils.lerp(
            skyShaderProps.current.turbidity,
            atmo.skyTurbidity,
            lerpAlpha
        );
        skyShaderProps.current.rayleigh = THREE.MathUtils.lerp(
            skyShaderProps.current.rayleigh,
            atmo.skyRayleigh,
            lerpAlpha
        );
        skyShaderProps.current.mieCoefficient = THREE.MathUtils.lerp(
            skyShaderProps.current.mieCoefficient,
            atmo.skyMieCoefficient,
            lerpAlpha
        );
        skyShaderProps.current.mieDirectionalG = THREE.MathUtils.lerp(
            skyShaderProps.current.mieDirectionalG,
            atmo.skyMieDirectionalG,
            lerpAlpha
        );
    });

    return (
        <>
            <ambientLight ref={ambientRef} intensity={0.6} color="#b06040" />
            <hemisphereLight ref={hemiRef} color="#b06040" groundColor="#1a0f0a" intensity={0.8} />
            <directionalLight
                ref={moonLightRef}
                intensity={0.5}
                position={[0, 100, 50]}
                color="#b06040"
            />
            <pointLight
                ref={sunRef}
                intensity={2.5}
                color="#ffe4c4"
                castShadow
                shadow-mapSize={[1024, 1024]}
                distance={0}
                decay={0}
            />

            <fogExp2 attach="fog" args={["#452a2a", 0.012]} />

            <Sky
                distance={450000}
                sunPosition={skySunPosition.current}
                mieCoefficient={skyShaderProps.current.mieCoefficient}
                mieDirectionalG={skyShaderProps.current.mieDirectionalG}
                rayleigh={skyShaderProps.current.rayleigh}
                turbidity={skyShaderProps.current.turbidity}
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
                <Sun position={new THREE.Vector3(0, 0, 0)} coreRadius={20} flareSize={380} />
            </group>
        </>
    );
}
