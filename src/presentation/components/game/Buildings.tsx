import { Suspense, useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { keyFromCell } from "../../../domain/entities/Position";
import { BuildingService } from "../../../domain/services/BuildingService";
import { useTerrainHeight } from "./TerrainHeightContext";

interface ModelProps {
    path: string;
    scale?: number;
    ghost?: boolean;
}

function Model({ path, scale = 1, ghost = false }: ModelProps) {
    const gltf = useGLTF(path) as { scene: Group };
    const sceneClone = useMemo<Group>(() => gltf.scene.clone(true), [gltf.scene]);

    useEffect(() => {
        // Calculate bounding box to center the model's origin at the bottom center
        const box = new THREE.Box3().setFromObject(sceneClone);
        const center = box.getCenter(new THREE.Vector3());
        
        // Shift the model so its origin is at the bottom center
        sceneClone.position.x = -center.x;
        sceneClone.position.y = -box.min.y;
        sceneClone.position.z = -center.z;

        if (ghost) {
            sceneClone.traverse((child) => {
                if ((child as any).isMesh) {
                    const material = (child as any).material as THREE.MeshStandardMaterial;
                    const ghostMaterial = material.clone();
                    ghostMaterial.transparent = true;
                    ghostMaterial.opacity = 0.4;
                    ghostMaterial.color.set("#00ff88");
                    (child as any).material = ghostMaterial;
                }
            });
        }
    }, [sceneClone, ghost]);

    return (
        <primitive object={sceneClone} scale={scale} />
    );
}

interface BuildingMeshProps {
    defId: string;
    ghost?: boolean;
}

function BuildingMesh({ defId, ghost = false }: BuildingMeshProps) {
    const def = BUILDING_DEFINITIONS[defId];

    const scale = useMemo(() => {
        switch (defId) {
            case "hab": return 2.5;
            case "greenhouse": return 2.5;
            case "solar": return 3.0;
            case "watertank": return 2.5;
            case "silo": return 2.5;
            case "rtg": return 3.0;
            case "mine": return 3.0;
            case "extractor": return 2.5;
            case "factory": return 3.0;
            default: return 2.5;
        }
    }, [defId]);

    if (def?.modelPath) {
        return (
            <Suspense fallback={null}>
                <Model path={def.modelPath} scale={scale} ghost={ghost} />
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

export function Buildings() {
    const placed = useGameStore((state) => state.placed);
    const inspectedInstanceId = useUIStore((state) => state.inspectedInstanceId);
    const setInspectedInstance = useUIStore((state) => state.setInspectedInstance);
    const buildMode = useUIStore((state) => state.buildMode);
    const terrainY = useTerrainHeight();
    const demolishBuilding = useGameStore((state) => state.demolishBuilding);

    const handleBuildingClick = (e: any, building: PlacedBuilding) => {
        e.stopPropagation();
        
        if (buildMode === "demolish") {
            demolishBuilding({ x: building.position.x, z: building.position.z });
            return;
        }
        
        // Only allow selection if not in build mode
        if (buildMode !== null) return;
        
        setInspectedInstance(building.id === inspectedInstanceId ? null : building.id);
    };

    return (
        <>
            {placed.map((b) => {
                const isSelected = b.id === inspectedInstanceId;
                // Sample live terrain height so buildings always sit on the
                // displaced surface, regardless of when the texture was decoded.
                // Increased offset to account for foundation base height
                const baseY = terrainY(b.position.x, b.position.z) + 0.3;
                
                return (
                    <group 
                        key={b.id} 
                        position={[b.position.x, baseY, b.position.z]}
                        onClick={(e) => handleBuildingClick(e, b)}
                    >
                        {/* Rendered higher to be clearly on top of the foundation */}
                        <group position={[0, -0.1, 0]}>
                            <BuildingMesh defId={b.definitionId} />
                        </group>
                        
                        {/* Visual foundation base - Thicker pedestal to bridge terrain gaps */}
                        <mesh position={[0, -0.6, 0]}>
                            <cylinderGeometry args={[0.8, 0.9, 1.0, 32]} />
                            <meshStandardMaterial 
                                color={isSelected ? "#00ffff" : "#3a3a3a"} 
                                emissive={isSelected ? "#003333" : "#000000"}
                                metalness={0.8} 
                                roughness={0.2} 
                            />
                        </mesh>
                        
                        {/* Selection Ring */}
                        {isSelected && (
                            <mesh position={[0, 0.35, 0]} rotation-x={-Math.PI / 2}>
                                <ringGeometry args={[0.9, 1.1, 32]} />
                                <meshBasicMaterial color="#00ffff" transparent opacity={0.5} side={THREE.DoubleSide} />
                            </mesh>
                        )}

                        <mesh position={[0, -1.3, 0]}>
                            <cylinderGeometry args={[0.9, 1.0, 0.3, 32]} />
                            <meshStandardMaterial color="#1a1a1a" />
                        </mesh>

                        {/* Popover logic */}
                        {isSelected && (
                             <BuildingInspectionPopover building={b} />
                        )}
                    </group>
                );
            })}
        </>
    );
}

import { Html } from "@react-three/drei";
import type { PlacedBuilding } from "../../../domain/entities/Building";

export function BuildingInspectionPopover({ building }: { building: PlacedBuilding }) {
    const def = BUILDING_DEFINITIONS[building.definitionId];
    return (
        <Html distanceFactor={15} position={[0, 3, 0]} center>
            <div className="building-popover">
                <div className="popover-header">
                    <h3>{def?.name}</h3>
                </div>
                <div className="popover-content">
                    <div className="popover-stat">
                        <div className="stat-label">Integralność strukturalna</div>
                        <div className="progress-bar-container">
                            <div className="progress-bar-bg">
                                <div 
                                    className="progress-bar-fill" 
                                    style={{ 
                                        width: `${building.condition}%`, 
                                        backgroundColor: building.condition < 30 ? "#ff3355" : "#00ff88" 
                                    }} 
                                />
                            </div>
                            <span className="stat-value">{building.condition}%</span>
                        </div>
                    </div>
                    {def?.production && (
                        <div className="popover-section">
                            <div className="section-title">Produkcja / s</div>
                            {Object.entries(def.production).map(([res, val]) => (
                                <div key={res} className="production-item">
                                    <span className="res-name">{res}</span>
                                    <span className="res-val">{val > 0 ? "+" : ""}{val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Html>
    );
}

export function HoverGhost() {
    const hoverCell = useUIStore((state) => state.hoverCell);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const buildMode = useUIStore((state) => state.buildMode);
    const resources = useGameStore((state) => state.resources);
    const placedBuildings = useGameStore((state) => state.placed);
    const terrainY = useTerrainHeight();

    if (!hoverCell || !selectedBuildingId || buildMode !== "place") return null;

    // Terrain bounds: x: 100 (from -50 to 50), z: 50 (from -25 to 25)
    const halfX = 50;
    const halfZ = 25;
    if (hoverCell.x < -halfX || hoverCell.x > halfX || hoverCell.z < -halfZ || hoverCell.z > halfZ) {
        return null;
    }

    const def = BUILDING_DEFINITIONS[selectedBuildingId];
    const canAfford = def ? BuildingService.canAfford(def.cost, resources) : false;
    const reqsMet = def ? BuildingService.hasRequirements(def, placedBuildings) : false;
    const baseY = terrainY(hoverCell.x, hoverCell.z) + 0.3;

    const isValid = canAfford && reqsMet;

    return (
        <group position={[hoverCell.x, baseY, hoverCell.z]}>
            <group position={[0, -0.1, 0]}>
                <BuildingMesh defId={selectedBuildingId} ghost={true} />
            </group>
            
            {/* Area confirmation box */}
            <mesh position={[0, 0.7, 0]}>
                <boxGeometry args={[1, 1.2, 1]} />
                <meshStandardMaterial 
                    color={isValid ? "#00ff88" : "#ff3355"} 
                    transparent 
                    opacity={0.2} 
                    depthWrite={false}
                />
            </mesh>

            {/* Pedestal preview */}
            <mesh position={[0, -0.8, 0]}>
                <cylinderGeometry args={[0.8, 0.9, 1.0, 32]} />
                <meshStandardMaterial 
                    color={isValid ? "#00ff88" : "#ff3355"} 
                    transparent 
                    opacity={0.2} 
                    depthWrite={false}
                />
            </mesh>
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

    const cx = Math.round(hoverCell.x);
    const cz = Math.round(hoverCell.z);
    const baseY = terrainY(cx, cz) + 0.51;

    return (
        <mesh position={[cx, baseY, cz]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff3355" transparent opacity={0.35} />
        </mesh>
    );
}
