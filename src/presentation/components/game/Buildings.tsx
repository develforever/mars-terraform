import { Suspense, useMemo, useEffect, useRef } from "react";
import { useGLTF, Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { keyFromCell } from "../../../domain/entities/Position";
import { BuildingService } from "../../../domain/services/BuildingService";
import { useTranslation } from "react-i18next";
import { useTerrainHeight } from "./TerrainHeightContext";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import { TERRAIN_BOUNDS } from "../../utils/terrainBounds";
import { useOutlineEffect } from "./OutlineEffectContext";
import { getBuildingModel, MODEL_PATHS } from "./buildingModels";
import { BuildingRangeRing } from "./BuildingRangeRing";
import { BuildingInspectionPopover } from "./BuildingInspectionPopover";

export { BuildingRangeRing, BuildingInspectionPopover };

interface ModelProps {
    path: string;
    scale?: number;
    ghost?: boolean;
}

function Model({ path, scale = 1, ghost = false }: ModelProps) {
    const gltf = useGLTF(path) as { scene: Group };
    const sceneClone = useMemo<Group>(() => {
        const clone = gltf.scene.clone(true);
        // Calculate bounding box to center the model's origin at the bottom center
        const box = new THREE.Box3().setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());
        // Shift children so the group's origin becomes the bottom-center.
        // We must NOT touch clone.position because <primitive object={clone} />
        // would treat that as an extra offset inside the parent group.
        const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
        clone.children.forEach((child) => {
            child.position.add(offset);
        });
        return clone;
    }, [gltf.scene]);

    useEffect(() => {
        if (ghost) {
            sceneClone.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const material = mesh.material as THREE.MeshStandardMaterial;
                    const ghostMaterial = material.clone();
                    ghostMaterial.transparent = true;
                    ghostMaterial.opacity = 0.4;
                    ghostMaterial.color.set("#00ff88");
                    mesh.material = ghostMaterial;
                }
            });
        }
    }, [sceneClone, ghost]);

    useEffect(() => {
        sceneClone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [sceneClone]);

    return (
        <primitive object={sceneClone} scale={scale} />
    );
}

interface BuildingMeshProps {
    defId: string;
    level?: number;
    ghost?: boolean;
}

function BuildingMesh({ defId, level = 1, ghost = false }: BuildingMeshProps) {
    const def = BUILDING_DEFINITIONS[defId];
    const scale = def?.modelScale ?? 2.5;
    const modelPath = getBuildingModel(defId, level) ?? def?.modelPath;

    if (modelPath) {
        return (
            <Suspense fallback={null}>
                <Model path={modelPath} scale={scale} ghost={ghost} />
            </Suspense>
        );
    }

    return (
        <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={def?.color ?? "#fff"} transparent={ghost} opacity={ghost ? 0.4 : 1} />
        </mesh>
    );
}

interface BuildingGroupProps {
    b: PlacedBuilding;
    isSelected: boolean;
    debugOverlayVisible: boolean;
    onClick: (e: ThreeEvent<MouseEvent>, b: PlacedBuilding) => void;
    baseY: number;
}

function BuildingGroup({ b, isSelected, debugOverlayVisible, onClick, baseY }: BuildingGroupProps) {
    const groupRef = useRef<THREE.Group>(null);
    const outlineEffect = useOutlineEffect();
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!outlineEffect) return;
        const currentGroup = groupRef.current;

        rafRef.current = requestAnimationFrame(() => {
            if (!currentGroup) return;

            // Only outline GLTF model meshes, not foundation cylinders
            const modelGroup = currentGroup.children.find(
                (c) => (c as THREE.Group).userData?.isModelGroup
            );
            const target = modelGroup ?? currentGroup;

            const meshes: THREE.Mesh[] = [];
            target.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
            });

            meshes.forEach((m) => outlineEffect.selection.delete(m));

            if (isSelected) {
                meshes.forEach((m) => outlineEffect.selection.add(m));
            }
        });

        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            if (outlineEffect && currentGroup) {
                const modelGroup = currentGroup.children.find(
                    (c) => (c as THREE.Group).userData?.isModelGroup
                );
                const target = modelGroup ?? currentGroup;
                target.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        outlineEffect.selection.delete(child as THREE.Mesh);
                    }
                });
            }
        };
    }, [isSelected, outlineEffect]);

    return (
        <group
            ref={groupRef}
            position={[b.position.x, baseY, b.position.z]}
            onClick={(e) => onClick(e, b)}
        >
            {debugOverlayVisible && (
                <>
                    <axesHelper args={[1.5]} />
                    <Html position={[0, 2, 0]} center style={{ color: "#ffffff", fontSize: 12, pointerEvents: "none" }}>
                        <div>Bld: {b.position.x}, {b.position.z}</div>
                    </Html>
                </>
            )}
            {/* Rendered higher to be clearly on top of the foundation */}
            <group position={[0, -0.1, 0]} userData={{ isModelGroup: true }}>
                <BuildingMesh defId={b.definitionId} level={b.level ?? 1} />
            </group>

            {/* Visual foundation base */}
            <mesh position={[0, -0.35, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.0, 1.1, 0.4, 32]} />
                <meshStandardMaterial
                    color={isSelected ? "#00ffff" : "#3a3a3a"}
                    emissive={isSelected ? "#003333" : "#000000"}
                    metalness={0.8}
                    roughness={0.2}
                />
            </mesh>

            <mesh position={[0, -0.7, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.1, 1.2, 0.3, 32]} />
                <meshStandardMaterial color="#1a1a1a" />
            </mesh>

            {isSelected && (
                <>
                    <BuildingRangeRing building={b} />
                    <BuildingInspectionPopover building={b} />
                </>
            )}
        </group>
    );
}

export function Buildings() {
    const placed = useGameStore((state) => state.placed);
    const inspectedInstanceId = useUIStore((state) => state.inspectedInstanceId);
    const setInspectedInstance = useUIStore((state) => state.setInspectedInstance);
    const buildMode = useUIStore((state) => state.buildMode);
    const terrainY = useTerrainHeight();
    const demolishBuilding = useGameStore((state) => state.demolishBuilding);
    const debugOverlayVisible = useUIStore((state) => state.debugOverlayVisible);

    useEffect(() => {
        MODEL_PATHS.forEach((path) => useGLTF.preload(path));
    }, []);

    const handleBuildingClick = (e: ThreeEvent<MouseEvent>, building: PlacedBuilding) => {
        e.stopPropagation();

        if (buildMode === "demolish") {
            demolishBuilding({ x: building.position.x, z: building.position.z });
            return;
        }

        if (buildMode !== null) return;

        setInspectedInstance(building.id);
    };

    return (
        <>
            {placed.map((b) => {
                const baseY = terrainY(b.position.x, b.position.z) + 0.3;
                return (
                    <BuildingGroup
                        key={b.id}
                        b={b}
                        isSelected={b.id === inspectedInstanceId}
                        debugOverlayVisible={debugOverlayVisible}
                        onClick={handleBuildingClick}
                        baseY={baseY}
                    />
                );
            })}
        </>
    );
}

export function HoverGhost() {
    const { t } = useTranslation();
    const hoverCell = useUIStore((state) => state.hoverCell);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const buildMode = useUIStore((state) => state.buildMode);
    const resources = useGameStore((state) => state.resources);
    const placedBuildings = useGameStore((state) => state.placed);
    const resourceNodes = useGameStore((state) => state.resourceNodes);
    const terrainY = useTerrainHeight();
    const debugOverlayVisible = useUIStore((state) => state.debugOverlayVisible);

    if (!hoverCell || !selectedBuildingId || buildMode !== "place") {
        return null;
    }

    if (hoverCell.x < -TERRAIN_BOUNDS.halfX || hoverCell.x > TERRAIN_BOUNDS.halfX || hoverCell.z < -TERRAIN_BOUNDS.halfZ || hoverCell.z > TERRAIN_BOUNDS.halfZ) {
        return null;
    }

    const def = BUILDING_DEFINITIONS[selectedBuildingId];
    const canAfford = def ? BuildingService.canAfford(def.cost, resources) : false;
    const reqsMet = def ? BuildingService.hasRequirements(def, placedBuildings) : false;
    const depositEfficiency = def ? BuildingService.getDepositEfficiencyAtCell(def, hoverCell, resourceNodes) : undefined;
    const baseY = terrainY(hoverCell.x, hoverCell.z) + 0.3;

    const isValid = canAfford && reqsMet;

    return (
        <group position={[hoverCell.x, baseY, hoverCell.z]}>
            {debugOverlayVisible && (
                <>
                    <axesHelper args={[1.5]} />
                    <Html position={[0, 2, 0]} center style={{ color: "#00ff88", fontSize: 12, pointerEvents: "none" }}>
                        <div>Ghost: {hoverCell.x}, {hoverCell.z}</div>
                    </Html>
                </>
            )}
            <group position={[0, -0.1, 0]}>
                <BuildingMesh defId={selectedBuildingId} ghost={true} />
            </group>
            
            {/* Area confirmation box */}
            <mesh position={[0, 0.7, 0]}>
                <boxGeometry args={[1.05, 1.2, 1.05]} />
                <meshStandardMaterial 
                    color={isValid ? "#00ff88" : "#ff3355"} 
                    transparent 
                    opacity={0.2} 
                    depthWrite={false}
                />
            </mesh>

            {/* Pedestal preview */}
            <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[1.0, 1.1, 0.4, 32]} />
                <meshStandardMaterial 
                    color={isValid ? (depositEfficiency && depositEfficiency.count > 0 ? "#38bdf8" : "#00ff88") : "#ff3355"} 
                    transparent 
                    opacity={depositEfficiency && depositEfficiency.count > 0 ? 0.4 : 0.2} 
                    depthWrite={false}
                />
            </mesh>

            {/* Extraction deposit efficiency indicator tag */}
            {def?.extractsDeposit && (
                <Html position={[0, 2.2, 0]} center style={{ pointerEvents: "none" }}>
                    <div
                        className={`px-2 py-1 rounded text-xs font-mono font-bold whitespace-nowrap shadow-xl flex items-center gap-1.5 select-none border transition-all duration-200 ${
                            depositEfficiency && depositEfficiency.count > 0
                                ? "bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-cyan-500/40 scale-105"
                                : "bg-zinc-900/90 border-zinc-600 text-zinc-300"
                        }`}
                    >
                        <span>{depositEfficiency && depositEfficiency.count > 0 ? "✨" : "⛏️"}</span>
                        <span>
                            {depositEfficiency && depositEfficiency.count > 0
                                ? `+${Math.round((depositEfficiency.multiplier - 1) * 100)}% ${t("hud.yieldBonus", "Wydajność")} (${depositEfficiency.count} ${depositEfficiency.depositType})`
                                : `100% ${t("hud.yieldBonus", "Wydajność")} (${t("hud.noDepositsNearby", "Brak złóż w sąsiedztwie")})`}
                        </span>
                    </div>
                </Html>
            )}
        </group>
    );
}

export function DemolishGhost() {
    const hoverCell = useUIStore((state) => state.hoverCell);
    const buildMode = useUIStore((state) => state.buildMode);
    const occupied = useGameStore((state) => state.occupied);
    const terrainY = useTerrainHeight();

    if (!hoverCell || buildMode !== "demolish") return null;

    const key = keyFromCell(hoverCell.x, hoverCell.z);
    const isOccupied = !!occupied[key];

    if (!isOccupied) return null;

    const cx = hoverCell.x;
    const cz = hoverCell.z;
    const baseY = terrainY(cx, cz) + 0.51;

    return (
        <mesh position={[cx, baseY, cz]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff3355" transparent opacity={0.35} />
        </mesh>
    );
}
