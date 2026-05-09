import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useCallback, useMemo, useRef } from "react";
import type { Mesh, DirectionalLight } from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";
import { TerrainHeightContext } from "./TerrainHeightContext";
import { heightFromDisplacement } from "../../utils/terrainDisplacement";

export function Scene3D() {
    return (
        <Canvas className="main-canvas" camera={{
            type: "PerspectiveCamera",
            fov: 60,
            position: [0, 60, 25],
        }}>
            <World />
        </Canvas>
    );
}

function World() {
    const terrainRef = useRef<Mesh>(null);
    const sunRef = useRef<DirectionalLight>(null);
    const setSun = useGameStore((state: { setSun: (f: number) => void }) => state.setSun);
    const buildMode = useUIStore((state: { buildMode: "place" | "demolish" | null }) => state.buildMode);

    const [colorMap, dispMap] = useTexture([
        "/textures/mars_colorx1.png",
        "/textures/mars_displacementx1.png",
    ]);

    const terrainSize = useMemo(() => ({ x: 100, z: 50 }), []);

    const getTerrainY = useCallback(
        (wx: number, wz: number) =>
            heightFromDisplacement(wx, wz, terrainSize, dispMap),
        [dispMap, terrainSize]
    );

    const sunT = useRef(0);
    useFrame((_, delta) => {
        sunT.current += delta * 0.1;
        const angle = sunT.current % (Math.PI * 2);
        const y = Math.cos(angle);
        const dayFactor = Math.max(0, y);
        setSun(dayFactor);
        if (sunRef.current) {
            sunRef.current.position.set(Math.sin(angle) * 20, 10 + 20 * dayFactor, 5);
            sunRef.current.intensity = 0.6 + 0.9 * dayFactor;
        }
    });

    usePlacement({ grid: 1, getHeightAt: getTerrainY });

    const target = useMemo<[number, number, number]>(() => [0, 0, 0], []);

    return (
        <TerrainHeightContext.Provider value={getTerrainY}>
            <>
                <ambientLight intensity={0.25} />
                <directionalLight ref={sunRef} position={[10, 15, 5]} intensity={1.2} castShadow />

                <MarsTerrain
                    ref={terrainRef}
                    terrainSize={terrainSize}
                    colorMap={colorMap}
                    displacementMap={dispMap}
                />
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
        </TerrainHeightContext.Provider>
    );
}
