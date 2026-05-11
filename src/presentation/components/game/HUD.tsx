import { useEffect } from "react";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import type { ResourceKey } from "../../../domain/entities/Resources";
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

    const buttons = [
        { id: "hab", label: "Kapsuła" },
        { id: "greenhouse", label: "Szklarnia" },
        { id: "solar", label: "Panel" },
        { id: "ice", label: "Kolektor" },
        { id: "battery", label: "Mag. energii" },
        { id: "watertank", label: "Zbiornik" },
        { id: "silo", label: "Silos" },
        { id: "recycler", label: "Recykler" },
        { id: "rtg", label: "RTG" },
    ];

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

                <div className="hud-dock__row hud-dock__row--palette">
                {buttons.map((b) => {
                    const active = selectedBuildingId === b.id;
                    const ok = canAfford(b.id);
                    const def = BUILDING_DEFINITIONS[b.id];
                    const costEntries = def?.cost
                        ? (Object.entries(def.cost) as [ResourceKey, number][])
                            .filter(([, v]) => v !== undefined && v > 0)
                        : [];
                    const prodEntries = def?.production
                        ? (Object.entries(def.production) as [ResourceKey, number][])
                            .filter(([, v]) => v !== undefined && v !== 0)
                        : [];
                    const capEntries = def?.capacity
                        ? (Object.entries(def.capacity) as [ResourceKey, number][])
                            .filter(([, v]) => v !== undefined && v > 0)
                        : [];
                    return (
                        <div key={b.id} className="tooltip-wrapper">
                            <button
                                type="button"
                                className={active ? "active" : ""}
                                disabled={!ok || demolishActive}
                                onClick={() => setSelectedBuilding(b.id)}
                            >
                                {b.label}
                                {ok ? "" : " · braki"}
                            </button>
                            <div className="tooltip-panel">
                                <div className="tooltip-title">{def?.name ?? b.label}</div>
                                {costEntries.length > 0 && (
                                    <table className="tooltip-table">
                                        <thead><tr><th>Zasób</th><th>Koszt</th><th>Masz</th><th>Brak</th></tr></thead>
                                        <tbody>
                                            {costEntries.map(([key, cost]) => {
                                                const have = resources[key];
                                                const deficit = Math.max(0, cost - have);
                                                return (
                                                    <tr key={key} className={deficit > 0 ? "deficit" : ""}>
                                                        <td>{RESOURCE_LABELS[key]}</td>
                                                        <td>{cost}</td>
                                                        <td>{have.toFixed(1)}</td>
                                                        <td>{deficit > 0 ? deficit.toFixed(1) : "—"}</td>
                                                    </tr>
                                                );
                                            })}
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
