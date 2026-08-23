import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { useMapConfigStore } from "../../../application/store/useMapConfigStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import type { ResourceKey } from "../../../domain/entities/Resources";
import { HintService } from "../../../domain/services/HintService";
import { WeatherAlert } from "./WeatherAlert";
import { DebugOverlay } from "./DebugOverlay";
import { ResourceDetailPanel } from "./ResourceDetailPanel";
import { WeatherService } from "../../../domain/services/WeatherService";
import { ResourceBar } from "./ResourceBar";
import { BuildingPalette } from "./BuildingPalette";
import { GameOverOverlay } from "./GameOverOverlay";
import { WinOverlay } from "./WinOverlay";
import { BuildingDependencyModal } from "./BuildingDependencyModal";
import { ResearchTreeModal } from "./ResearchTreeModal";
import { QuestTrackerWidget } from "./QuestTrackerWidget";
import { QuestLogModal } from "./QuestLogModal";
import { QuestService } from "../../../domain/services/QuestService";
import "./HUD.css";

export function HUD() {
    const { t } = useTranslation();
    const resources      = useGameStore((state) => state.resources);
    const capacity       = useGameStore((state) => state.capacity);
    const lastDelta      = useGameStore((state) => state.lastDelta);
    const sun            = useGameStore((state) => state.sun);
    const terraforming   = useGameStore((state) => state.terraforming);
    const won            = useGameStore((state) => state.won);
    const difficulty     = useGameStore((state) => state.difficulty);
    const alive          = useGameStore((state) => state.alive);
    const selectedBuildingId  = useUIStore((state) => state.selectedBuildingId);
    const setSelectedBuilding = useUIStore((state) => state.setSelectedBuilding);
    const buildMode      = useUIStore((state) => state.buildMode);
    const toggleBuildMode    = useUIStore((state) => state.toggleBuildMode);
    const toggleDemolishMode = useUIStore((state) => state.toggleDemolishMode);
    const cancelBuild    = useUIStore((state) => state.cancelBuild);
    const resetGame      = useGameStore((state) => state.resetGame);
    const resetUI        = useUIStore((state) => state.resetUI);
    const { loadMapFromFile, loaded: mapLoaded, mapName, clearMap } = useMapConfigStore();
    const isHUDVisible   = useUIStore((state) => state.isHUDVisible);
    const toggleHUD      = useUIStore((state) => state.toggleHUD);
    const saveGame       = useGameStore((state) => state.saveGame);
    const loadGame       = useGameStore((state) => state.loadGame);
    const colonyName     = useGameStore((state) => state.colonyName);
    const gameMode       = useGameStore((state) => state.gameMode);
    const alienState     = useGameStore((state) => state.alienState);
    const weather        = useGameStore((state) => state.weather);
    const o2Accumulated  = useGameStore((state) => state.o2Accumulated);
    const placedBuildings = useGameStore((state) => state.placed);
    const resourceNodes  = useGameStore((state) => state.resourceNodes);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const activeQuests   = useGameStore((state) => state.activeQuests);

    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
    const [activePanel, setActivePanel] = useState<ResourceKey | "terraforming" | null>(null);
    const [showDepTree, setShowDepTree] = useState(false);
    const [showResearchTree, setShowResearchTree] = useState(false);
    const [showQuestLog, setShowQuestLog] = useState(false);

    const researchPoints = useGameStore((state) => state.researchPoints);
    const unlockedTechs  = useGameStore((state) => state.unlockedTechs);
    const hasUnclaimedQuests = QuestService.hasUnclaimedRewards(activeQuests);

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

    const handleNewGame = () => {
        resetGame();
        resetUI();
    };

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            if (e.key === "b" || e.key === "B") toggleBuildMode();
            if (e.key === "x" || e.key === "X") toggleDemolishMode();
            if (e.key === "r" || e.key === "R") setShowResearchTree((v) => !v);
            if (e.key === "q" || e.key === "Q") setShowQuestLog((v) => !v);
            if (e.key === "Escape") {
                cancelBuild();
                setActivePanel(null);
                setShowResearchTree(false);
                setShowQuestLog(false);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleBuildMode, toggleDemolishMode, cancelBuild]);

    const hint = useMemo(() => {
        if (!lastDelta) return null;
        return HintService.getSuggestion(resources, capacity, lastDelta);
    }, [resources, capacity, lastDelta]);

    const placeActive    = buildMode === "place";
    const demolishActive = buildMode === "demolish";

    return (
        <div className="hud">
            <DebugOverlay />
            <WeatherAlert />
            {gameMode === "survival" && alienState.wave > 0 && (alienState.ships.length > 0 || alienState.groundUnits.length > 0) && (
                <div className="alien-alert">
                    {alienState.wave === 1 && t("hud.alien.wave1", { count: alienState.ships.length })}
                    {alienState.wave === 2 && t("hud.alien.wave2", { ships: alienState.ships.length, ground: alienState.groundUnits.length })}
                </div>
            )}

            <ResourceBar
                sun={sun}
                resources={resources}
                capacity={capacity}
                terraforming={terraforming}
                lastDelta={lastDelta ?? {}}
                colonyName={colonyName}
                activePanel={activePanel}
                onTogglePanel={togglePanel}
            />

            {activePanel !== null && (
                <ResourceDetailPanel
                    activePanel={activePanel}
                    placed={placedBuildings}
                    definitions={BUILDING_DEFINITIONS}
                    sunFactor={sun}
                    productionModifier={productionModifier}
                    resources={resources}
                    capacity={capacity}
                    terraforming={terraforming}
                    o2Accumulated={o2Accumulated}
                    difficulty={difficulty}
                    lastDelta={lastDelta ?? {}}
                    resourceNodes={resourceNodes}
                    onClose={() => setActivePanel(null)}
                />
            )}

            <div className={`hud-dock ${isHUDVisible ? "hud-dock--visible" : "hud-dock--hidden"}`}>
                {hint && (
                    <div className={`hint-panel ${hint.critical ? "critical" : ""}`}>
                        <span className="hint-icon">{hint.icon}</span>
                        <span className="hint-text">{t(hint.messageKey)}</span>
                    </div>
                )}
                <div className="hud-dock__row hud-dock__row--tools">
                    <button
                        type="button"
                        className="hud-toggle-btn"
                        onClick={toggleHUD}
                        title={isHUDVisible ? t("hud.hidePanel") : t("hud.showPanel")}
                    >
                        {isHUDVisible ? "▼" : "▲"}
                    </button>
                    <button type="button" className={placeActive ? "active" : ""} onClick={toggleBuildMode}>
                        {t("hud.build")} <span aria-hidden="true">&nbsp;(B)</span>
                    </button>
                    <button type="button" className={demolishActive ? "active" : ""} onClick={toggleDemolishMode}>
                        {t("hud.demolish")} <span aria-hidden="true">&nbsp;(X)</span>
                    </button>
                    <button type="button" onClick={cancelBuild}>
                        {t("hud.cancel")} <span aria-hidden="true">&nbsp;(Esc)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => loadMapFromFile().catch(e => alert(e.message))}
                        title="Load map config from generator JSON"
                    >
                        🗺 {mapLoaded ? mapName : 'Load Map'}
                    </button>
                    {mapLoaded && (
                        <button type="button" onClick={clearMap} title="Clear loaded map">
                            ✕ Map
                        </button>
                    )}
                    <button type="button" onClick={() => setShowDepTree(true)}>
                        {t("hud.depTree")}
                    </button>
                    <button
                        type="button"
                        className={showResearchTree ? "active" : ""}
                        onClick={() => setShowResearchTree((v) => !v)}
                        title={`${t("research.title")} (R)`}
                    >
                        🔬 {t("research.title")}
                        {researchPoints > 0 && (
                            <span style={{ marginLeft: 4, color: "#58a6ff", fontSize: "11px" }}>
                                {researchPoints.toFixed(0)} RP
                            </span>
                        )}
                        {unlockedTechs.length > 1 && (
                            <span style={{ marginLeft: 4, color: "#3fb950", fontSize: "11px" }}>
                                ✓{unlockedTechs.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`relative ${showQuestLog ? "active" : ""}`}
                        onClick={() => setShowQuestLog((v) => !v)}
                        title={`${t("quests.openLog")} (Q)`}
                    >
                        📜 {t("quests.questsBtn")}
                        {hasUnclaimedQuests && (
                            <span
                                style={{
                                    marginLeft: 6,
                                    padding: "1px 5px",
                                    borderRadius: "9999px",
                                    backgroundColor: "#238636",
                                    color: "#ffffff",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                                }}
                            >
                                !
                            </span>
                        )}
                    </button>
                    {isAuthenticated && (
                        <>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saveStatus === "saving"}
                                className={saveStatus === "ok" ? "active" : saveStatus === "err" ? "locked" : ""}
                                title={t("hud.save")}
                            >
                                {saveStatus === "saving" ? t("hud.saving")
                                    : saveStatus === "ok" ? t("hud.saved")
                                    : saveStatus === "err" ? t("hud.saveErr")
                                    : t("hud.save")}
                            </button>
                            <button
                                type="button"
                                onClick={handleLoad}
                                disabled={!colonyName}
                                title={t("hud.load")}
                            >
                                {t("hud.load")}
                            </button>
                        </>
                    )}
                </div>

                <BuildingPalette
                    resources={resources}
                    placedBuildings={placedBuildings}
                    selectedBuildingId={selectedBuildingId}
                    demolishActive={demolishActive}
                    onSelect={setSelectedBuilding}
                />
            </div>

            {showDepTree && (
                <BuildingDependencyModal
                    placedBuildings={placedBuildings}
                    onClose={() => setShowDepTree(false)}
                />
            )}

            {showResearchTree && (
                <ResearchTreeModal
                    onClose={() => setShowResearchTree(false)}
                />
            )}

            {showQuestLog && (
                <QuestLogModal
                    onClose={() => setShowQuestLog(false)}
                />
            )}

            <QuestTrackerWidget
                onOpenLog={() => setShowQuestLog(true)}
            />

            {won && (
                <WinOverlay difficulty={difficulty} onPlayAgain={handleNewGame} />
            )}
            {!alive && !won && (
                <GameOverOverlay onNewGame={handleNewGame} />
            )}
        </div>
    );
}
