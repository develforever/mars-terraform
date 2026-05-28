import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useUIStore } from "../../../application/store/useUIStore";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { TERRAIN_BOUNDS } from "../../utils/terrainBounds";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";
import { TerrainHeightContext } from "./TerrainHeightContext";
import { heightFromDisplacement } from "../../utils/terrainDisplacement";
import { MarsEnvironment } from "./MarsEnvironment";
import { VisibilitySystem } from "./VisibilitySystem";
import { useState } from "react";

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
    const buildMode = useUIStore((state: { buildMode: "place" | "demolish" | null }) => state.buildMode);
    const cancelBuild = useUIStore((state) => state.cancelBuild);

    const [colorMap, dispMap] = useTexture([
        "/textures/mars_colorx1.png",
        "/textures/mars_displacementx1.png",
    ]);

    const terrainSize = useMemo(() => ({ x: TERRAIN_BOUNDS.sizeX, z: TERRAIN_BOUNDS.sizeZ }), []);

    // Check if displacement texture is loaded
    const isTextureLoaded = useMemo(() => {
        return !!(dispMap?.image && (dispMap.image as any).width);
    }, [dispMap]);

    // Cancel build mode if texture is not loaded
    useEffect(() => {
        if (!isTextureLoaded && buildMode !== null) {
            cancelBuild();
        }
    }, [isTextureLoaded, buildMode, cancelBuild]);

    const getTerrainY = useCallback(
        (wx: number, wz: number) => {
            // Only use displacement if texture is loaded
            if (!isTextureLoaded) return 0;
            return heightFromDisplacement(wx, wz, terrainSize, dispMap);
        },
        [dispMap, terrainSize, isTextureLoaded]
    );

    usePlacement({ grid: 1, getHeightAt: getTerrainY });

    const target = useMemo<[number, number, number]>(() => [0, 0, 0], []);

    const [visibilityMap, setVisibilityMap] = useState<THREE.CanvasTexture | null>(null);

    return (
        <TerrainHeightContext.Provider value={getTerrainY}>
            <>
                <MarsEnvironment />
                
                <VisibilitySystem 
                    terrainSize={terrainSize} 
                    onVisibilityMapCreated={setVisibilityMap} 
                />

                <MarsTerrain
                    terrainSize={terrainSize}
                    colorMap={colorMap}
                    displacementMap={dispMap}
                    visibilityMap={visibilityMap}
                />
                <GridOverlay terrainSize={terrainSize} visibilityMap={visibilityMap} />
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
