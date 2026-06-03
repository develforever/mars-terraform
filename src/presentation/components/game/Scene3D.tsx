import { Canvas } from "@react-three/fiber";
import { Loader, OrbitControls, useTexture } from "@react-three/drei";
import { PostProcessingComposer } from "./PostProcessingComposer";
import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useUIStore } from "../../../application/store/useUIStore";
import { MarsTerrain } from "./MarsTerrain";
import { TERRAIN_BOUNDS } from "../../utils/terrainBounds";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";
import { TerrainHeightContext } from "./TerrainHeightContext";
import { heightFromDisplacement } from "../../utils/terrainDisplacement";
import { MarsEnvironment } from "./MarsEnvironment";
import { VisibilitySystem } from "./VisibilitySystem";
import { TerrainDataSystem } from "./TerrainDataSystem";
import { MeteorShower } from "./MeteorShower";
import { BuildingConnections } from "./BuildingConnections";
import { AlienInvasion } from "./AlienInvasion";
import { OutlineEffectContext } from "./OutlineEffectContext";
import type { OutlineEffect } from "postprocessing";

export function Scene3D() {
    return (
        <>
            <Canvas className="main-canvas" frameloop="always"
                onCreated={({ gl }) => {
                    gl.domElement.addEventListener('webglcontextlost', (e) => {
                        e.preventDefault();
                        console.warn('WebGL context lost');
                    });
                    gl.domElement.addEventListener('webglcontextrestored', () => {
                        console.info('WebGL context restored');
                    });
                }}
                gl={{ antialias: false, powerPreference: "high-performance" }}
                camera={{
                    type: "PerspectiveCamera",
                    fov: 60,
                    position: [0, 60, 25],
                    near: 0.5,
                    far: 1000
                }}>
                <World />
            </Canvas>
            <Loader />
        </>
    );
}

function World() {
    const terrainRef = useRef<THREE.Mesh>(null);
    const buildMode = useUIStore((state: { buildMode: "place" | "demolish" | null }) => state.buildMode);

    const [colorMap, dispMap] = useTexture([
        "/textures/mars_colorx1.png",
        "/textures/mars_displacementx1.png",
    ]);

    const terrainSize = useMemo(() => ({ x: TERRAIN_BOUNDS.sizeX, z: TERRAIN_BOUNDS.sizeZ }), []);

    // Check if displacement texture is loaded
    const isTextureLoaded = !!(dispMap?.image && (dispMap.image as any).width);

    const getTerrainY = useCallback(
        (wx: number, wz: number) => {
            // Only use displacement if texture is loaded
            if (!isTextureLoaded) return 0;
            return heightFromDisplacement(wx, wz, terrainSize, dispMap);
        },
        [dispMap, terrainSize, isTextureLoaded]
    );

    usePlacement({ grid: 1, getHeightAt: getTerrainY, terrainMesh: terrainRef });

    const target = useMemo<[number, number, number]>(() => [0, 0, 0], []);

    const [visibilityMap, setVisibilityMap] = useState<THREE.CanvasTexture | null>(null);
    const [dataMap, setDataMap] = useState<THREE.CanvasTexture | null>(null);
    const [outlineEffect, setOutlineEffect] = useState<OutlineEffect | null>(null);

    return (
        <OutlineEffectContext.Provider value={outlineEffect}>
        <TerrainHeightContext.Provider value={getTerrainY}>

            <MarsEnvironment />

            <VisibilitySystem
                terrainSize={terrainSize}
                onVisibilityMapCreated={setVisibilityMap}
            />

            <TerrainDataSystem
                terrainSize={terrainSize}
                onDataMapCreated={setDataMap}
            />

            <MarsTerrain
                ref={terrainRef}
                terrainSize={terrainSize}
                colorMap={colorMap}
                displacementMap={dispMap}
                visibilityMap={visibilityMap}
                dataMap={dataMap}
            />
            <Buildings />
            <HoverGhost />
            <DemolishGhost />
            <MeteorShower />
            <BuildingConnections />
            <AlienInvasion />

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

            <PostProcessingComposer
                bloomIntensity={1.2}
                bloomThreshold={0.2}
                bloomSmoothing={0.9}
                outline={true}
                onOutlineReady={setOutlineEffect}
            />

        </TerrainHeightContext.Provider>
        </OutlineEffectContext.Provider>
    );
}
