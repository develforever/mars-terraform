import { Suspense, useMemo, useEffect } from "react";
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
import { WeatherService } from "../../../domain/services/WeatherService";
import { NeighborService } from "../../../domain/services/NeighborService";

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
    const scale = def?.modelScale ?? 2.5;

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

    const handleBuildingClick = (e: ThreeEvent<MouseEvent>, building: PlacedBuilding) => {
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
                        
                        {/* Visual foundation base - Wide flat platform to bridge terrain gaps */}
                        <mesh position={[0, -0.35, 0]}>
                            <cylinderGeometry args={[1.0, 1.1, 0.4, 32]} />
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

                        <mesh position={[0, -0.7, 0]}>
                            <cylinderGeometry args={[1.1, 1.2, 0.3, 32]} />
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

export function BuildingInspectionPopover({ building }: { building: PlacedBuilding }) {
    const def = BUILDING_DEFINITIONS[building.definitionId];
    const { t } = useTranslation();
    const placed = useGameStore((state) => state.placed);
    const sunFactor = useGameStore((state) => state.sun);
    const weather = useGameStore((state) => state.weather);

    const productionModifier = WeatherService.getProductionModifier(weather);
    const condFactor = BuildingService.conditionFactor(building.condition);
    const neighborMult = def ? NeighborService.getProductionMultiplier(building, def, placed, BUILDING_DEFINITIONS) : 1;

    const baseValues = def?.production ? Object.entries(def.production) : [];

    const activeBonuses = def?.bonusNeighbors
        ? def.bonusNeighbors.filter((bn) =>
            placed.some((p) => p.id !== building.id && p.definitionId === bn.neighborId &&
                NeighborService.getNeighbors(building, placed).some((n) => n.definitionId === bn.neighborId)
            )
        )
        : [];

    const hasAnyProduction = baseValues.some(([, baseVal]) => {
        let adjusted = baseVal;
        if (def?.tags?.includes("dayScaled") && baseVal > 0) adjusted *= sunFactor;
        adjusted *= productionModifier;
        return adjusted > 0;
    });
    const showModifiers = hasAnyProduction && (
        condFactor < 1 || neighborMult > 1 || (def?.tags?.includes("dayScaled")) || productionModifier < 1
    );

    return (
        <Html position={[0, 3, 0]} center style={{ pointerEvents: "none" }}>
            <div className="building-popover">
                <div className="popover-header">
                    <h3>{def?.name}</h3>
                </div>
                <div className="popover-content">
                    <div className="popover-stat">
                        <div className="stat-label">{t("popover.integrity")}</div>
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
                    {baseValues.length > 0 && (
                        <div className="popover-section">
                            <div className="section-title">{t("popover.production")}</div>
                            {baseValues.map(([res, baseVal]) => {
                                let adjusted = baseVal;
                                if (def?.tags?.includes("dayScaled") && res === "power") {
                                    adjusted *= sunFactor;
                                }
                                adjusted *= productionModifier;
                                const isProduction = adjusted > 0;
                                if (isProduction) {
                                    adjusted *= condFactor * neighborMult;
                                }
                                const hasDiff = Math.abs(adjusted - baseVal) >= 0.001;
                                return (
                                    <div key={res} className="production-item">
                                        <span className="res-name">{res}</span>
                                        {hasDiff ? (
                                            <div className="res-values">
                                                <span className="res-base">{baseVal > 0 ? "+" : ""}{baseVal.toFixed(2)}</span>
                                                <span className="res-arrow">→</span>
                                                <span className={`res-actual ${adjusted > 0 ? "res-actual-pos" : adjusted < 0 ? "res-actual-neg" : ""}`}>
                                                    {adjusted > 0 ? "+" : ""}{adjusted.toFixed(2)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="res-val">{adjusted > 0 ? "+" : ""}{adjusted}</span>
                                        )}
                                    </div>
                                );
                            })}
                            {showModifiers && (
                                <div className="popover-modifiers">
                                    {def?.tags?.includes("dayScaled") && (
                                        <span className="mod-tag">☀️ {Math.round(sunFactor * 100)}%</span>
                                    )}
                                    {condFactor < 1 && (
                                        <span className="mod-tag mod-damage">🔧 {Math.round(condFactor * 100)}%</span>
                                    )}
                                    {neighborMult > 1 && (
                                        <span className="mod-tag mod-bonus">🔗 +{Math.round((neighborMult - 1) * 100)}%</span>
                                    )}
                                    {productionModifier < 1 && (
                                        <span className="mod-tag mod-storm">🌪️ {Math.round(productionModifier * 100)}%</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {activeBonuses.length > 0 && (
                        <div className="popover-section">
                            <div className="section-title">{t("popover.neighborBoost")}</div>
                            {activeBonuses.map((b) => (
                                <div key={b.neighborId} className="boost-item">
                                    <span className="boost-check">✓</span>
                                    <span className="boost-desc">{b.description}</span>
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

    if (hoverCell.x < -TERRAIN_BOUNDS.halfX || hoverCell.x > TERRAIN_BOUNDS.halfX || hoverCell.z < -TERRAIN_BOUNDS.halfZ || hoverCell.z > TERRAIN_BOUNDS.halfZ) {
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
