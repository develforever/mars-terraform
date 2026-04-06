import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { Mesh, DirectionalLight } from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";

interface Scene3DProps {
    onClick?: () => void;
}

export function Scene3D({ onClick }: Scene3DProps) {
    return (
        <Canvas className="main-canvas" camera={{
            type: "PerspectiveCamera",
            fov: 60,
            position: [0, 60, 25],
        }}>
            <World onClick={onClick} />
        </Canvas>
    );
}

function World(_props: Scene3DProps) {
    const terrainRef = useRef<Mesh>(null);
    const sunRef = useRef<DirectionalLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    const buildMode = useUIStore((state: { buildMode: "place" | "demolish" | null }) => state.buildMode);

    // Terrain size reference
    const terrainSize = useMemo(() => ({ x: 100, z: 50 }), []);

    // Sun animation
    const t = useRef(0);
    useFrame((_, delta) => {
        t.current += delta * 0.1;
        const angle = t.current % (Math.PI * 2);
        const y = Math.cos(angle);
        const dayFactor = Math.max(0, y);
        setSun(dayFactor);
        if (sunRef.current) {
            sunRef.current.position.set(Math.sin(angle) * 20, 10 + 20 * dayFactor, 5);
            sunRef.current.intensity = 0.6 + 0.9 * dayFactor;
        }
    });

    // Get terrain height at position
    const getHeightAt = (_x: number, _z: number): number => {
        if (!terrainRef.current) return 0;
        // Simplified - return 0 for flat terrain
        return 0;
    };

    usePlacement({ grid: 1, getHeightAt });

    const target = useMemo<[number, number, number]>(() => [0, 0, 0], []);

    return (
        <>
            <ambientLight intensity={0.25} />
            <directionalLight ref={sunRef} position={[10, 15, 5]} intensity={1.2} castShadow />

            <MarsTerrain ref={terrainRef} terrainSize={terrainSize} />
            <GridOverlay terrainSize={terrainSize} />
            <Buildings />
            <HoverGhost />
            <DemolishGhost />

            <OrbitControls
                enabled={buildMode === null}
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={500}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI / 2.15}
                minAzimuthAngle={-Math.PI / 2}
                maxAzimuthAngle={Math.PI / 2}
                target={target}
            />
        </>
    );
}
