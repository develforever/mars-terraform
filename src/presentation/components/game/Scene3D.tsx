import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useUIStore } from "../../../application/store/useUIStore";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";
import { TerrainHeightContext } from "./TerrainHeightContext";
import { heightFromDisplacement } from "../../utils/terrainDisplacement";
import { MarsEnvironment } from "./MarsEnvironment";

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
    const terrainRef = useRef<THREE.Mesh>(null);
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

    usePlacement({ grid: 1, getHeightAt: getTerrainY });

    const target = useMemo<[number, number, number]>(() => [0, 0, 0], []);

    return (
        <TerrainHeightContext.Provider value={getTerrainY}>
            <>
                <MarsEnvironment />

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
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2.1}
                    target={target}
                />
            </>
        </TerrainHeightContext.Provider>
    );
}
