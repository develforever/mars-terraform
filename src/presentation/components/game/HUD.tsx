import { useEffect, useMemo } from "react";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS, BUILDING_SEED } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import type { ResourceKey } from "../../../domain/entities/Resources";
import type { BuildingDefinition } from "../../../domain/entities/Building";
import "./HUD.css";

export function HUD() {
    const resources = useGameStore((state) => state.resources);
    const capacity = useGameStore((state) => state.capacity);
    const sun = useGameStore((state) => state.sun);
    const alive = useGameStore((state) => state.alive);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const setSelectedBuilding = useUIStore((state) => state.setSelectedBuilding);
    const buildMode = useUIStore((state) => state.buildMode);
    const toggleBuildMode = useUIStore((state) => state.toggleBuildMode);
    const toggleDemolishMode = useUIStore((state) => state.toggleDemolishMode);
    const cancelBuild = useUIStore((state) => state.cancelBuild);
    const resetGame = useGameStore((state) => state.resetGame);
    const resetUI = useUIStore((state) => state.resetUI);

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            if (e.key === "b" || e.key === "B") toggleBuildMode();
            if (e.key === "x" || e.key === "X") toggleDemolishMode();
            if (e.key === "Escape") cancelBuild();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleBuildMode, toggleDemolishMode, cancelBuild]);

    const CATEGORY_LABELS: Record<string, string> = {
        living: "Mieszkalne",
        production: "Produkcja",
        storage: "Magazyny",
        infrastructure: "Logistyka",
        defense: "Obrona",
    };

    const buildingsByCategory = useMemo(() => {
        const groups: Record<string, BuildingDefinition[]> = {};
        BUILDING_SEED.forEach((b) => {
            if (!groups[b.category]) groups[b.category] = [];
            groups[b.category].push(b);
        });
        return groups;
    }, []);

    const placedBuildings = useGameStore((state) => state.placed);

    const RESOURCE_LABELS: Record<ResourceKey, string> = {
        o2: "O₂",
        power: "⚡",
        water: "💧",
        biomass: "🧪",
    };

    const placeActive = buildMode === "place";
    const demolishActive = buildMode === "demolish";

    const canAfford = (defId: string): boolean => {
        const def = BUILDING_DEFINITIONS[defId];
        return def ? BuildingService.canAfford(def.cost, resources) : false;
    };

    const checkRequirements = (def: BuildingDefinition): boolean => {
        return BuildingService.hasRequirements(def, placedBuildings);
    };

    return (
        <div className="hud">
            <div className="bar">
                <span>☀️ {sun.toFixed(2)}</span>
                <span>💨 O₂ {resources.o2.toFixed(1)}</span>
                <span>⚡ {resources.power.toFixed(1)} / {capacity.power}</span>
                <span>💧 {resources.water.toFixed(1)} / {capacity.water}</span>
                <span>🧪 {resources.biomass.toFixed(1)} / {capacity.biomass}</span>
            </div>

            <div className="hud-dock">
                <div className="hud-dock__row hud-dock__row--tools">
                    <button
                        type="button"
                        className={placeActive ? "active" : ""}
                        onClick={toggleBuildMode}
                    >
                        Buduj <span aria-hidden="true">&nbsp;(B)</span>
                    </button>
                    <button
                        type="button"
                        className={demolishActive ? "active" : ""}
                        onClick={toggleDemolishMode}
                    >
                        Rozbiórka <span aria-hidden="true">&nbsp;(X)</span>
                    </button>
                    <button type="button" onClick={cancelBuild}>
                        Anuluj <span aria-hidden="true">&nbsp;(Esc)</span>
                    </button>
                </div>

                <div className="hud-dock__categories">
                    {(Object.entries(buildingsByCategory) as [string, BuildingDefinition[]][]).map(([cat, items]) => (
                        <div key={cat} className="hud-dock__category-group">
                            <div className="category-label">{CATEGORY_LABELS[cat] || cat}</div>
                            <div className="hud-dock__row hud-dock__row--palette">
                                {items.map((def: BuildingDefinition) => {
                                    const active = selectedBuildingId === def.id;
                                    const affordable = canAfford(def.id);
                                    const reqsMet = checkRequirements(def);
                                    const costEntries = (Object.entries(def.cost) as [ResourceKey, number][])
                                        .filter(([, v]) => v !== undefined && v > 0);
                                    const prodEntries = (Object.entries(def.production || {}) as [ResourceKey, number][])
                                        .filter(([, v]) => v !== undefined && v !== 0);
                                    const capEntries = (Object.entries(def.capacity || {}) as [ResourceKey, number][])
                                        .filter(([, v]) => v !== undefined && v > 0);

                                    return (
                                        <div key={def.id} className="tooltip-wrapper">
                                            <button
                                                type="button"
                                                className={`${active ? "active" : ""} ${!reqsMet ? "locked" : ""}`}
                                                disabled={!affordable || !reqsMet || demolishActive}
                                                onClick={() => setSelectedBuilding(def.id)}
                                            >
                                                {def.name}
                                                {!affordable && reqsMet ? " · braki" : ""}
                                                {!reqsMet ? " 🔒" : ""}
                                            </button>
                                            <div className="tooltip-panel">
                                                <div className="tooltip-title">{def.name}</div>
                                                
                                                {!reqsMet && (
                                                    <div className="tooltip-section requirements-section">
                                                        <div className="tooltip-subtitle">Wymagania</div>
                                                        <div className="deficit">
                                                            Wymaga: {def.dependsOn?.map((id: string) => BUILDING_DEFINITIONS[id]?.name || id).join(", ")}
                                                        </div>
                                                    </div>
                                                )}

                                                {costEntries.length > 0 && (
                                                    <table className="tooltip-table">
                                                        <thead><tr><th>Zasób</th><th>Koszt</th><th>Masz</th></tr></thead>
                                                        <tbody>
                                                            {costEntries.map(([key, cost]) => (
                                                                <tr key={key} className={resources[key] < cost ? "deficit" : ""}>
                                                                    <td>{RESOURCE_LABELS[key]}</td>
                                                                    <td>{cost}</td>
                                                                    <td>{resources[key].toFixed(1)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                                {prodEntries.length > 0 && (
                                                    <div className="tooltip-section">
                                                        <div className="tooltip-subtitle">Produkcja</div>
                                                        {prodEntries.map(([key, val]) => (
                                                            <div key={key} className={val > 0 ? "prod-positive" : "prod-negative"}>
                                                                {RESOURCE_LABELS[key]} {val > 0 ? "+" : ""}{val}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {capEntries.length > 0 && (
                                                    <div className="tooltip-section">
                                                        <div className="tooltip-subtitle">Pojemność</div>
                                                        {capEntries.map(([key, val]) => (
                                                            <div key={key}>
                                                                {RESOURCE_LABELS[key]} +{val}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!alive && (
                <div className="overlay">
                    <div className="panel">
                        <div className="title">KONIEC GRY</div>
                        <div className="reason">Zabrakło tlenu.</div>
                        <button
                            type="button"
                            onClick={() => {
                                resetGame();
                                resetUI();
                            }}
                        >
                            Nowa gra
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
