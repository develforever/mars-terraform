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
import { WeatherService } from "../../../domain/services/WeatherService";
import { NeighborService } from "../../../domain/services/NeighborService";
import { useOutlineEffect } from "./OutlineEffectContext";

/** Unique model paths from building definitions for pre-loading. */
const MODEL_PATHS = Array.from(
  new Set(
    Object.values(BUILDING_DEFINITIONS)
      .map((d) => d.modelPath)
      .filter((p): p is string => !!p)
  )
);

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
                <BuildingMesh defId={b.definitionId} />
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
                <BuildingInspectionPopover building={b} />
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

        setInspectedInstance(building.id === inspectedInstanceId ? null : building.id);
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

export function BuildingInspectionPopover({ building }: { building: PlacedBuilding }) {
    const def = BUILDING_DEFINITIONS[building.definitionId];
    const { t } = useTranslation();
    const placed = useGameStore((state) => state.placed);
    const resources = useGameStore((state) => state.resources);
    const sunFactor = useGameStore((state) => state.sun);
    const weather = useGameStore((state) => state.weather);
    const resourceNodes = useGameStore((state) => state.resourceNodes);
    const upgradeBuilding = useGameStore((state) => state.upgradeBuilding);
    const setInspectedInstance = useUIStore((state) => state.setInspectedInstance);

    const currentLevel = building.level ?? 1;
    const productionModifier = WeatherService.getProductionModifier(weather);
    const condFactor = BuildingService.conditionFactor(building.condition);
    const neighborMult = def ? NeighborService.getProductionMultiplier(building, def, placed, BUILDING_DEFINITIONS) : 1;
    const depositMult = def ? BuildingService.getDepositMultiplier(building, def, resourceNodes) : 1;
    const levelMult = def ? BuildingService.getLevelMultiplier(building, def) : 1;
    const extractionRadius = def ? BuildingService.getExtractionRadius(building, def) : 1;
    const depositEfficiency = def ? BuildingService.getDepositEfficiencyAtCell(def, { x: building.position.x, z: building.position.z }, resourceNodes, extractionRadius) : undefined;

    const nextUpgrade = def ? BuildingService.getNextUpgrade(building, def) : undefined;
    const canAffordUpgrade = nextUpgrade ? BuildingService.canAfford(nextUpgrade.cost, resources) : false;

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
        condFactor < 1 || neighborMult > 1 || depositMult > 1 || levelMult > 1 || (def?.tags?.includes("dayScaled")) || productionModifier < 1
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setInspectedInstance(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setInspectedInstance]);

    return (
        <Html position={[0, 3, 0]} center style={{ pointerEvents: "none" }}>
            <div 
                className="building-popover" 
                style={{ pointerEvents: "auto" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="popover-header">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="truncate">{def?.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 border border-cyan-500/50 text-cyan-300 whitespace-nowrap">
                            {t("popover.levelBadge", { level: currentLevel })}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="popover-close-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setInspectedInstance(null);
                        }}
                        aria-label="Zamknij"
                    >
                        ✕
                    </button>
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
                                    adjusted *= condFactor * neighborMult * depositMult * levelMult;
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
                                    {depositMult > 1 && (
                                        <span className="mod-tag mod-deposit">⛏️ +{Math.round((depositMult - 1) * 100)}% ({t("popover.depositYield")})</span>
                                    )}
                                    {levelMult > 1 && (
                                        <span className="mod-tag mod-bonus">⭐ x{levelMult.toFixed(1)} (POZ. {currentLevel})</span>
                                    )}
                                    {productionModifier < 1 && (
                                        <span className="mod-tag mod-storm">🌪️ {Math.round(productionModifier * 100)}%</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {(activeBonuses.length > 0 || (depositEfficiency && depositEfficiency.count > 0)) && (
                        <div className="popover-section">
                            <div className="section-title">{t("popover.neighborBoost")}</div>
                            {depositEfficiency && depositEfficiency.count > 0 && (
                                <div className="boost-item">
                                    <span className="boost-check">💎</span>
                                    <span className="boost-desc">
                                        {t("popover.depositConnected", {
                                            count: depositEfficiency.count,
                                            type: depositEfficiency.depositType,
                                            bonus: Math.round((depositMult - 1) * 100),
                                        })}
                                    </span>
                                </div>
                            )}
                            {activeBonuses.map((b) => (
                                <div key={b.neighborId} className="boost-item">
                                    <span className="boost-check">✓</span>
                                    <span className="boost-desc">{b.description}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upgrades section */}
                    <div className="popover-section mt-2 pt-2 border-t border-white/10">
                        <div className="section-title flex justify-between items-center text-[10px] uppercase text-zinc-400 font-bold mb-1.5">
                            <span>{t("popover.upgrades")}</span>
                            <span className="text-zinc-500 font-mono">{currentLevel}/3</span>
                        </div>

                        {currentLevel >= 3 || !nextUpgrade ? (
                            <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                                <span>⭐</span>
                                <span>{t("popover.maxLevel", { level: currentLevel })}</span>
                            </div>
                        ) : (
                            <div className="bg-black/30 border border-white/10 rounded-lg p-2 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-zinc-200">
                                        {t("popover.upgradeTo", { level: nextUpgrade.level })}
                                    </span>
                                    <span className="font-mono text-cyan-400 font-bold">
                                        x{nextUpgrade.productionMultiplier.toFixed(1)}
                                    </span>
                                </div>

                                {nextUpgrade.extractionRadius && (
                                    <div className="text-[11px] text-zinc-300 flex items-center gap-1">
                                        <span className="text-cyan-400">📏</span>
                                        <span>{t("popover.extractionRadius", { radius: nextUpgrade.extractionRadius })}</span>
                                    </div>
                                )}

                                {nextUpgrade.unlockedUnit && (
                                    <div className="text-[11px] text-emerald-300 flex items-center gap-1">
                                        <span>{nextUpgrade.unlockedUnit === "rover" ? "🚙" : "🛸"}</span>
                                        <span>
                                            {t("popover.unlockedUnit", {
                                                unit: nextUpgrade.unlockedUnit === "rover"
                                                    ? t("popover.units.rover")
                                                    : t("popover.units.drone"),
                                            })}
                                        </span>
                                    </div>
                                )}

                                {/* Cost preview */}
                                <div className="mt-1 flex flex-wrap gap-1 items-center">
                                    <span className="text-[10px] text-zinc-400 mr-1">{t("popover.upgradeCost")}</span>
                                    {Object.entries(nextUpgrade.cost).map(([res, costVal]) => {
                                        if (costVal === undefined) return null;
                                        const resKey = res as keyof typeof resources;
                                        const hasEnough = resources[resKey] >= costVal;
                                        return (
                                            <span
                                                key={res}
                                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                                                    hasEnough
                                                        ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                                                        : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                                                }`}
                                            >
                                                {res}: {costVal}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Upgrade Button */}
                                <button
                                    type="button"
                                    disabled={!canAffordUpgrade}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        upgradeBuilding(building.id);
                                    }}
                                    className={`mt-1 w-full py-1.5 px-3 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 pointer-events-auto ${
                                        canAffordUpgrade
                                            ? "bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white shadow-md shadow-cyan-600/30 cursor-pointer"
                                            : "bg-zinc-800 text-zinc-500 border border-zinc-700/40 cursor-not-allowed"
                                    }`}
                                >
                                    {t("popover.upgrade")}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Html>
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
