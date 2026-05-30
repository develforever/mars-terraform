import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { BUILDING_DEFINITIONS, BUILDING_SEED } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import type { ResourceKey } from "../../../domain/entities/Resources";
import type { BuildingDefinition } from "../../../domain/entities/Building";
import { HintService } from "../../../domain/services/HintService";
import { DIFFICULTY_LABELS } from "../../../domain/services/TerraformingService";
import { NeighborService } from "../../../domain/services/NeighborService";
import { WeatherAlert } from "./WeatherAlert";
import { DebugOverlay } from "./DebugOverlay";
import { ResourceDetailPanel } from "./ResourceDetailPanel";
import { WeatherService } from "../../../domain/services/WeatherService";
import "./HUD.css";

export function HUD() {
    const resources = useGameStore((state) => state.resources);
    const capacity = useGameStore((state) => state.capacity);
    const lastDelta = useGameStore((state) => state.lastDelta);
    const sun = useGameStore((state) => state.sun);
    const terraforming = useGameStore((state) => state.terraforming);
    const won = useGameStore((state) => state.won);
    const difficulty = useGameStore((state) => state.difficulty);
    const alive = useGameStore((state) => state.alive);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const setSelectedBuilding = useUIStore((state) => state.setSelectedBuilding);
    const buildMode = useUIStore((state) => state.buildMode);
    const toggleBuildMode = useUIStore((state) => state.toggleBuildMode);
    const toggleDemolishMode = useUIStore((state) => state.toggleDemolishMode);
    const cancelBuild = useUIStore((state) => state.cancelBuild);
    const resetGame = useGameStore((state) => state.resetGame);
    const resetUI = useUIStore((state) => state.resetUI);
    const isHUDVisible = useUIStore((state) => state.isHUDVisible);
    const toggleHUD = useUIStore((state) => state.toggleHUD);
    const saveGame = useGameStore((state) => state.saveGame);
    const loadGame = useGameStore((state) => state.loadGame);
    const colonyName = useGameStore((state) => state.colonyName);
    const gameMode = useGameStore((state) => state.gameMode);
    const alienState = useGameStore((state) => state.alienState);
    const weather = useGameStore((state) => state.weather);
    const o2Accumulated = useGameStore((state) => state.o2Accumulated);
    const placedBuildings2 = useGameStore((state) => state.placed);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
    const [activePanel, setActivePanel] = useState<ResourceKey | "terraforming" | null>(null);

    const productionModifier = WeatherService.getProductionModifier(weather);

    const togglePanel = (key: ResourceKey | "terraforming") => {
        setActivePanel((prev) => (prev === key ? null : key));
    };

    const handleSave = async () => {
        setSaveStatus("saving");
        const ok = await saveGame();
        setSaveStatus(ok ? "ok" : "err");
        setTimeout(() => setSaveStatus("idle"), 2000);
    };

    const handleLoad = async () => {
        if (!colonyName) return;
        await loadGame(colonyName);
    };

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            if (e.key === "b" || e.key === "B") toggleBuildMode();
            if (e.key === "x" || e.key === "X") toggleDemolishMode();
            if (e.key === "Escape") {
                cancelBuild();
                setActivePanel(null);
            }
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

    const hint = useMemo(() => {
        if (!lastDelta) return null;
        return HintService.getSuggestion(resources, capacity, lastDelta);
    }, [resources, capacity, lastDelta]);

    const activeBonuses = useMemo(
        () => NeighborService.getAllActiveBonuses(placedBuildings, BUILDING_DEFINITIONS),
        [placedBuildings],
    );

    const renderDelta = (val: number | undefined) => {
        if (!val || val === 0) return null;
        if (val > 0) return <span className="delta-positive">▲{val.toFixed(1)}</span>;
        return <span className="delta-negative">▼{Math.abs(val).toFixed(1)}</span>;
    };

    return (
        <div className="hud">
            <DebugOverlay />
            <WeatherAlert />
            {gameMode === "survival" && alienState.wave > 0 && (
                <div className="alien-alert">
                    {alienState.wave === 1 && `👽 ATAK ORBITALNY — ${alienState.ships.length} statek(i)`}
                    {alienState.wave === 2 && `👾 INWAZJA — ${alienState.ships.length} statk. + ${alienState.groundUnits.length} naziemnych`}
                </div>
            )}
            <div className="bar">
                <span>☀️ {sun.toFixed(2)}</span>
                <button className={`bar-btn${activePanel === "o2" ? " bar-btn--active" : ""}`} onClick={() => togglePanel("o2")}>💨 O₂ {resources.o2.toFixed(1)} {renderDelta(lastDelta?.o2)}</button>
                <button className={`bar-btn${activePanel === "power" ? " bar-btn--active" : ""}`} onClick={() => togglePanel("power")}>⚡ {resources.power.toFixed(1)} / {capacity.power} {renderDelta(lastDelta?.power)}</button>
                <button className={`bar-btn${activePanel === "water" ? " bar-btn--active" : ""}`} onClick={() => togglePanel("water")}>💧 {resources.water.toFixed(1)} / {capacity.water} {renderDelta(lastDelta?.water)}</button>
                <button className={`bar-btn${activePanel === "biomass" ? " bar-btn--active" : ""}`} onClick={() => togglePanel("biomass")}>🧪 {resources.biomass.toFixed(1)} / {capacity.biomass} {renderDelta(lastDelta?.biomass)}</button>
                <button className={`bar-btn terraforming-bar${activePanel === "terraforming" ? " bar-btn--active" : ""}`} onClick={() => togglePanel("terraforming")}>
                    🌍 {terraforming.toFixed(1)}%
                    <span className="terraforming-track">
                        <span
                            className="terraforming-fill"
                            style={{ width: `${terraforming}%` }}
                        />
                    </span>
                </button>
                {colonyName && <span className="bar-colony-name">🏛 {colonyName}</span>}
            </div>

            {activePanel !== null && (
                <ResourceDetailPanel
                    activePanel={activePanel}
                    placed={placedBuildings2}
                    definitions={BUILDING_DEFINITIONS}
                    sunFactor={sun}
                    productionModifier={productionModifier}
                    resources={resources}
                    capacity={capacity}
                    terraforming={terraforming}
                    o2Accumulated={o2Accumulated}
                    difficulty={difficulty}
                    lastDelta={lastDelta}
                    onClose={() => setActivePanel(null)}
                />
            )}

            <div className={`hud-dock ${isHUDVisible ? "hud-dock--visible" : "hud-dock--hidden"}`}>

                {hint && (
                    <div className={`hint-panel ${hint.critical ? "critical" : ""}`}>
                        <span className="hint-icon">{hint.icon}</span>
                        <span className="hint-text">{hint.message}</span>
                    </div>
                )}
                <div className="hud-dock__row hud-dock__row--tools">
                    <button
                        type="button"
                        className="hud-toggle-btn"
                        onClick={toggleHUD}
                        title={isHUDVisible ? "Ukryj panel" : "Pokaż panel"}
                    >
                        {isHUDVisible ? "▼" : "▲"}
                    </button>
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
                    {isAuthenticated && (
                        <>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saveStatus === "saving"}
                                className={saveStatus === "ok" ? "active" : saveStatus === "err" ? "locked" : ""}
                                title="Zapisz grę"
                            >
                                {saveStatus === "saving" ? "Zapisywanie..." : saveStatus === "ok" ? "✓ Zapisano" : saveStatus === "err" ? "✗ Błąd" : "Zapisz"}
                            </button>
                            <button
                                type="button"
                                onClick={handleLoad}
                                disabled={!colonyName}
                                title="Wczytaj grę"
                            >
                                Wczytaj
                            </button>
                        </>
                    )}
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
                                            {def.bonusNeighbors && def.bonusNeighbors.length > 0 && (
                                                    <div className="tooltip-section">
                                                        <div className="tooltip-subtitle">🔗 Bonusy sąsiedztwa</div>
                                                        {def.bonusNeighbors.map((b) => {
                                                            const isActive = activeBonuses.some(
                                                                (ab) => ab.buildingId === placedBuildings.find(p => p.definitionId === def.id)?.id && ab.neighborId === b.neighborId
                                                            );
                                                            return (
                                                                <div key={b.neighborId} className={isActive ? "prod-positive" : ""} style={{ opacity: isActive ? 1 : 0.5 }}>
                                                                    {isActive ? "✓" : "○"} {b.description}
                                                                </div>
                                                            );
                                                        })}
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

            {won && (
                <div className="overlay overlay--win">
                    <div className="panel panel--win">
                        <div className="title">🌍 MARS OŻYWA!</div>
                        <div className="reason">Terraformacja ukończona w trybie <strong>{DIFFICULTY_LABELS[difficulty]}</strong>.</div>
                        <div className="reason" style={{ fontSize: "13px", opacity: 0.7, marginTop: "4px" }}>Twoja kolonia zmieniła oblicze Marsa na zawsze.</div>
                        <button
                            type="button"
                            onClick={() => {
                                resetGame();
                                resetUI();
                            }}
                        >
                            Zagraj ponownie
                        </button>
                    </div>
                </div>
            )}

            {!alive && !won && (
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
