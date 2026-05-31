import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useTerrainHeight } from "./TerrainHeightContext";
import type { ImpactZone } from "../../../domain/services/WeatherService";

export function MeteorShower() {
    const weather = useGameStore((s) => s.weather);
    const getHeight = useTerrainHeight();

    const [pulse, setPulse]       = useState(0);
    const [progress, setProgress] = useState(0);
    const [fade, setFade]         = useState(0);

    const weatherRef = useRef(weather);
    weatherRef.current = weather;

    useFrame((_, delta) => {
        const w = weatherRef.current;
        setPulse((p) => p + delta * 3);
        if (w.type === "meteor_shower") {
            setProgress((p) => {
                const next = Math.min(1, p + delta * 0.55);
                if (next >= 1) setFade((f) => Math.min(1, f + delta * 1.2));
                return next;
            });
        } else if (w.type !== "meteor_warning") {
            setProgress(0);
            setFade(0);
        }
    });

    const zones: ImpactZone[] = weather.impactZones ?? [];
    const isWarning = weather.type === "meteor_warning";
    const isShower  = weather.type === "meteor_shower";

    const ringGeo   = useMemo(() => new THREE.RingGeometry(0.85, 1.0, 32), []);
    const dotGeo    = useMemo(() => new THREE.CircleGeometry(0.18, 16), []);
    const flashGeo  = useMemo(() => new THREE.CircleGeometry(2.5, 32), []);
    const glowGeo   = useMemo(() => new THREE.CircleGeometry(4.0, 32), []);
    const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.6, 12, 12), []);
    const trailGeo  = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 8, 0, 0, 0, 0]), 3));
        return geo;
    }, []);

    if (!isWarning && !isShower) return null;
    if (!zones.length) return null;

    const ringOpacity  = 0.45 + Math.sin(pulse) * 0.35;
    const ringScale    = 1 + Math.sin(pulse * 0.7) * 0.15;
    const flashOpacity = Math.max(0, 1 - fade) * 0.85;
    const flashScale   = 1 + fade * 3;

    return (
        <>
            {isWarning && zones.map((zone, i) => {
                const y = getHeight(zone.x, zone.z) + 2.0;
                return (
                    <group key={i} position={[zone.x, y, zone.z]}>
                        <mesh rotation-x={-Math.PI / 2} geometry={ringGeo}
                            scale={[ringScale * 2.5, ringScale * 2.5, 1]}>
                            <meshBasicMaterial color="#ff2200" transparent opacity={ringOpacity} depthWrite={false} />
                        </mesh>
                        <mesh rotation-x={-Math.PI / 2} geometry={dotGeo}>
                            <meshBasicMaterial color="#ff4400" transparent opacity={ringOpacity * 0.8} depthWrite={false} />
                        </mesh>
                    </group>
                );
            })}

            {isShower && progress < 1 && zones.map((zone, i) => {
                const groundY = getHeight(zone.x, zone.z);
                const currentY = THREE.MathUtils.lerp(40, groundY + 0.5, progress);
                return (
                    <group key={i} position={[zone.x, currentY, zone.z]}>
                        <lineSegments geometry={trailGeo}>
                            <lineBasicMaterial color="#ffaa44" transparent opacity={0.9} depthWrite={false} />
                        </lineSegments>
                        <mesh geometry={sphereGeo}>
                            <meshBasicMaterial color="#ff6600" transparent opacity={0.95} depthWrite={false} />
                        </mesh>
                    </group>
                );
            })}

            {isShower && progress >= 1 && flashOpacity > 0 && zones.map((zone, i) => {
                const y = getHeight(zone.x, zone.z) + 0.2;
                return (
                    <group key={i} position={[zone.x, y, zone.z]}>
                        <mesh rotation-x={-Math.PI / 2} geometry={glowGeo} scale={[flashScale, flashScale, 1]}>
                            <meshBasicMaterial color="#ff4400" transparent opacity={flashOpacity * 0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
                        </mesh>
                        <mesh rotation-x={-Math.PI / 2} geometry={flashGeo} scale={[flashScale, flashScale, 1]}>
                            <meshBasicMaterial color="#ff8800" transparent opacity={flashOpacity} depthWrite={false} />
                        </mesh>
                    </group>
                );
            })}
        </>
    );
}
