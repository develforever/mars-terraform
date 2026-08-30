import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Loader, OrbitControls } from "@react-three/drei";
import { PostProcessingComposer } from "./PostProcessingComposer";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { usePlacement } from "../../../application/hooks/usePlacement";
import { useUIStore } from "../../../application/store/useUIStore";
import { useGameStore } from "../../../application/store/useGameStore";
import { TerrainHexMesh } from "./TerrainHexMesh";
import { Decorations } from "./Decorations";
import { worldToHex } from "../../generator/hex/HexMath";
import { Buildings, DemolishGhost, HoverGhost } from "./Buildings";
import { TerrainHeightContext } from "./TerrainHeightContext";
import { AtmosphereSky } from "./AtmosphereSky";
import { WeatherEffects } from "./WeatherEffects";
import { MeteorShower } from "./MeteorShower";
import { BuildingConnections } from "./BuildingConnections";
import { AlienInvasion } from "./AlienInvasion";
import { MiningLogisticsSystem } from "./MiningLogisticsSystem";
import { UnitsLayer } from "./UnitsLayer";
import { TargetMarker } from "./TargetMarker";
import { RTSSceneController } from "./RTSSceneController";
import { TacticalCameraBridge } from "./TacticalCameraBridge";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OutlineEffectContext } from "./OutlineEffectContext";
import type { OutlineEffect } from "postprocessing";
import MapOverlay from "./MapOverlay";
import { ResourceDepositMarkers } from "./ResourceDepositMarkers";
import { WaterHexMesh } from "./WaterHexMesh";
import { VegetationHexMesh } from "./VegetationHexMesh";

import { registerWebGLContext, unregisterWebGLContext } from "../../utils/webglContextTracker";

const DiagnosticLogger = () => {
    const { gl } = useThree();
    const frameStatsRef = useRef({ calls: 0, triangles: 0 });

    useEffect(() => {
        if (gl?.info) {
            gl.info.autoReset = false;
        }
        if (gl?.getContext) {
            registerWebGLContext(gl.getContext());
        }
        return () => {
            if (gl?.getContext) {
                unregisterWebGLContext(gl.getContext());
            }
        };
    }, [gl]);

    // Priority -1: Reset stats at the start of the frame before RenderPass
    useFrame(() => {
        if (gl?.info) {
            gl.info.reset();
        }
    }, -1);

    // Priority 2: Read accumulated render stats after RenderPass & EffectPass have rendered
    useFrame(() => {
        if (gl?.info?.render) {
            frameStatsRef.current.calls = gl.info.render.calls;
            frameStatsRef.current.triangles = gl.info.render.triangles;
        }
    }, 2);

    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as unknown as { __THREE_RENDERER__?: THREE.WebGLRenderer }).__THREE_RENDERER__ = gl;
        }
        const startTime = Date.now();
        const interval = setInterval(() => {
            const sec = Math.round((Date.now() - startTime) / 1000);
            const calls = frameStatsRef.current.calls;
            const triangles = frameStatsRef.current.triangles;
            const geometries = gl?.info?.memory?.geometries || 0;
            const textures = gl?.info?.memory?.textures || 0;
            const programs = gl?.info?.programs?.length ?? 0;
            console.log(
                `[DIAG-MARS +${sec}s] ` +
                `geometries=${geometries} ` +
                `textures=${textures} ` +
                `programs=${programs} ` +
                `calls=${calls} ` +
                `triangles=${triangles}`
            );
        }, 5000);

        return () => {
            clearInterval(interval);
            if (typeof window !== "undefined" && (window as unknown as { __THREE_RENDERER__?: THREE.WebGLRenderer }).__THREE_RENDERER__ === gl) {
                (window as unknown as { __THREE_RENDERER__?: THREE.WebGLRenderer }).__THREE_RENDERER__ = undefined;
            }
        };
    }, [gl]);
    return null;
};

function SceneCleanup({ isUnmountingRef }: { isUnmountingRef: React.RefObject<boolean> }) {
    const three = useThree();
    const gl = three?.gl;
    const scene = three?.scene;

    useEffect(() => {
        return () => {
            if (!gl || !scene) return;
            isUnmountingRef.current = true;

            // 1. Traverse scene and dispose all geometries, materials, and textures
            if (typeof scene.traverse === "function") {
                scene.traverse((obj) => {
                    const mesh = obj as THREE.Mesh;
                    if (mesh.geometry) {
                        mesh.geometry.dispose();
                    }
                    if (mesh.material) {
                        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        for (const mat of materials) {
                            for (const key of Object.keys(mat)) {
                                const val = (mat as unknown as Record<string, unknown>)[key];
                                if (val && typeof val === "object" && "isTexture" in val && typeof (val as THREE.Texture).dispose === "function") {
                                    (val as THREE.Texture).dispose();
                                }
                            }
                            mat.dispose();
                        }
                    }
                });
            }

            // 2. Dispose render lists and renderer
            gl.renderLists?.dispose?.();
            if (typeof gl.dispose === "function") {
                gl.dispose();
            }

            // 3. Explicitly release WebGL context slot via WEBGL_lose_context extension
            try {
                const rawContext = gl.getContext ? gl.getContext() : null;
                unregisterWebGLContext(rawContext);
                const loseContextExt = rawContext?.getExtension?.("WEBGL_lose_context");
                if (loseContextExt) {
                    loseContextExt.loseContext();
                } else if (typeof gl.forceContextLoss === "function") {
                    gl.forceContextLoss();
                }
            } catch (e) {
                console.warn("Scene3D WebGL context cleanup error:", e);
            }
        };
    }, [gl, scene, isUnmountingRef]);

    return null;
}

export const Scene3D = () => {
    const [sceneKey, setSceneKey] = useState(0);
    const [contextLost, setContextLost] = useState(false);
    const [tooFrequentLoss, setTooFrequentLoss] = useState(false);
    const lastLossTimeRef = useRef<number>(0);
    const isUnmountingRef = useRef<boolean>(false);
    const saveGame = useGameStore((state) => state.saveGame);

    useEffect(() => {
        isUnmountingRef.current = false;
        return () => {
            isUnmountingRef.current = true;
        };
    }, []);

    const handleSaveAndReload = useCallback(() => {
        saveGame();
        window.location.reload();
    }, [saveGame]);

    return (
        <div className="relative w-full h-full">
            {contextLost && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 text-white p-6 select-none">
                    {tooFrequentLoss ? (
                        <div className="bg-red-950/90 border border-red-500 rounded-lg p-6 max-w-md text-center shadow-2xl">
                            <h3 className="text-lg font-bold text-red-400 mb-2">⚠️ Wielokrotna utrata kontekstu WebGL</h3>
                            <p className="text-sm text-zinc-300 mb-4">
                                Sterownik GPU zresetował kontekst graficzny kilkukrotnie w krótkim czasie.
                                Zalecamy zapisanie stanu gry i odświeżenie karty przeglądarki.
                            </p>
                            <button
                                onClick={handleSaveAndReload}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow transition-colors"
                            >
                                💾 Zapisz grę i odśwież stronę
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-zinc-900/90 border border-cyan-500/50 rounded-lg px-5 py-3 shadow-xl">
                            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-cyan-200 font-mono text-sm">Wznawianie renderera 3D...</span>
                        </div>
                    )}
                </div>
            )}

            <Canvas
                key={sceneKey}
                className="main-canvas"
                frameloop="always"
                dpr={[1, 1.5]}
                onCreated={({ gl }) => {
                    if (typeof window !== "undefined") {
                        (window as unknown as { __THREE_RENDERER__?: THREE.WebGLRenderer }).__THREE_RENDERER__ = gl;
                        (window as unknown as { __SCENE_MOUNT_COUNT__?: number }).__SCENE_MOUNT_COUNT__ =
                            ((window as unknown as { __SCENE_MOUNT_COUNT__?: number }).__SCENE_MOUNT_COUNT__ ?? 0) + 1;
                    }
                    gl.domElement.addEventListener('webglcontextlost', (e) => {
                        if (isUnmountingRef.current) return;
                        e.preventDefault();
                        console.warn('WebGL context lost - attempting recovery');
                        const now = Date.now();
                        if (lastLossTimeRef.current > 0 && now - lastLossTimeRef.current < 60000) {
                            setTooFrequentLoss(true);
                        }
                        lastLossTimeRef.current = now;
                        setContextLost(true);
                    });
                    gl.domElement.addEventListener('webglcontextrestored', () => {
                        if (isUnmountingRef.current) return;
                        console.info('WebGL context restored - rebuilding scene graph');
                        setContextLost(false);
                        setSceneKey((prev) => prev + 1);
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
                <DiagnosticLogger />
                <SceneCleanup isUnmountingRef={isUnmountingRef} />
                <World />
            </Canvas>
            <Loader />
        </div>
    );
};

const World = () => {
    const terrainRef = useRef<THREE.Mesh>(null);
    const buildMode = useUIStore((state: { buildMode: "place" | "demolish" | null }) => state.buildMode);
    const hexGrid = useGameStore((state) => state.hexGrid);
    const placed = useGameStore((state) => state.placed);
    const colonyName = useGameStore((state) => state.colonyName);
    const { camera } = useThree();

    const getTerrainY = useCallback(
        (wx: number, wz: number) => {
            if (!hexGrid) return 0;
            const [q, r] = worldToHex(wx, wz);
            const cell = hexGrid.getCell(q, r);
            return cell ? cell.worldY : 0;
        },
        [hexGrid]
    );

    usePlacement({ grid: 1, getHeightAt: getTerrainY, terrainMesh: terrainRef });

    const controlsRef = useRef<OrbitControlsImpl>(null);
    const [outlineEffect, setOutlineEffect] = useState<OutlineEffect | null>(null);

    const centerHab = placed.find((b) => b.id === "colony-center-hab");
    const hasCenteredRef = useRef(false);

    useEffect(() => {
        hasCenteredRef.current = false;
    }, [colonyName]);

    useFrame(() => {
        if (!hasCenteredRef.current && centerHab) {
            const { x, y = 0, z } = centerHab.position;
            if (controlsRef.current) {
                controlsRef.current.target.set(x, y, z);
                controlsRef.current.update();
            }
            camera.position.set(x, y + 26, z + 20);
            useUIStore.getState().setCameraFrustum([], { x, y, z });
            hasCenteredRef.current = true;
        }
    });

    return (
        <OutlineEffectContext.Provider value={outlineEffect}>
        <TerrainHeightContext.Provider value={getTerrainY}>

            <AtmosphereSky />
            <WeatherEffects />

            <TerrainHexMesh
                ref={terrainRef}
                hexGrid={hexGrid}
            />
            <WaterHexMesh />
            <VegetationHexMesh hexGrid={hexGrid} />
            <Decorations />
            <Buildings />
            <HoverGhost />
            <DemolishGhost />
            <MeteorShower />
            <BuildingConnections />
            <AlienInvasion />
            <MiningLogisticsSystem />
            <UnitsLayer />
            <TargetMarker />
            <RTSSceneController />
            <TacticalCameraBridge controlsRef={controlsRef} />
            <MapOverlay />
            <ResourceDepositMarkers />

            <OrbitControls
                ref={controlsRef}
                enabled={buildMode === null}
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={90}
                minPolarAngle={0}
                maxPolarAngle={Math.PI / 2.1}
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
};
