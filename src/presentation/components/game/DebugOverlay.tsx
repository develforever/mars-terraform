import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebugStore } from "../../../application/store/useDebugStore";
import { useGameStore } from "../../../application/store/useGameStore";
import { WeatherService } from "../../../domain/services/WeatherService";
import type { WeatherType } from "../../../domain/services/WeatherService";
import "./DebugOverlay.css";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";

const WEATHER_OPTIONS: WeatherType[] = ["clear", "warning", "dust_storm", "sandstorm", "meteor_warning", "meteor_shower", "polar_aurora"];

export function DebugOverlay() {
    const { t } = useTranslation();
    const { enabled, toggleDebug, showBuildingInfo, toggleBuildingInfo, showFPS, setForcedWeather } = useDebugStore();
    const weather = useGameStore((s) => s.weather);
    const resources = useGameStore((s) => s.resources);
    const terraforming = useGameStore((s) => s.terraforming);
    const o2Accumulated = useGameStore((s) => s.o2Accumulated);
    const sun = useGameStore((s) => s.sun);
    const placed = useGameStore((s) => s.placed);
    const difficulty = useGameStore((s) => s.difficulty);
    const alienState = useGameStore((s) => s.alienState);
    const gameMode = useGameStore((s) => s.gameMode);
    const triggerAlienWave = useGameStore((s) => s.triggerAlienWave);
    const selectedCell = useUIStore((s) => s.hoverCell);
    const setSelectedCell = useUIStore((s) => s.setHoverCell);
    const [selectedCellValue, setSelectedCellValue] = useState<string>("0,0");
    const toggleBuildMode = useUIStore((s) => s.toggleBuildMode);
    const cancelBuild = useUIStore((s) => s.cancelBuild);
    const setSelectedBuilding = useUIStore((s) => s.setSelectedBuilding);
    const debugOverlayVisible = useUIStore((s) => s.debugOverlayVisible);
    const toggleDebugOverlay = useUIStore((s) => s.toggleDebugOverlay);
    const forceMeteorShower = useGameStore((s) => s.forceMeteorShower);
    const [fps, setFps] = useState(0);
    const [meteorCount, setMeteorCount] = useState(10);
    const [alienCount, setAlienCount] = useState(3);
    const [fixtures, setFixtures] = useState<{ id: string; label: string; description: string; apply: (store: typeof useGameStore) => void }[]>([]);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

    useEffect(() => {
        if (import.meta.env.DEV) {
            import("../../../domain/fixtures").then(({ STATE_FIXTURES }) => {
                setFixtures(STATE_FIXTURES);
            }).catch(() => {});
        }
    }, []);

    // FPS counter
    useEffect(() => {
        if (!enabled || !showFPS) return;
        let rafId: number;
        const loop = () => {
            frameCount.current++;
            const now = performance.now();
            if (now - lastTime.current >= 1000) {
                setFps(frameCount.current);
                frameCount.current = 0;
                lastTime.current = now;
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [enabled, showFPS]);

    // Ctrl+D toggle
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "d") {
                e.preventDefault();
                toggleDebug();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleDebug]);

    if (!enabled) {
        return (
            <button
                className="debug-toggle-btn"
                onClick={toggleDebug}
                title={`${t("debug.title")} (Ctrl+D)`}
            >
                🛠
            </button>
        );
    }

    return (
        <div className="debug-overlay">
            <div className="debug-header">
                <span>{t("debug.title")}</span>
                <button onClick={toggleDebug} title={t("debug.close")}>✕</button>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.performance")}</div>
                <div className="debug-row"><span>{t("debug.fps")}</span><span className={fps < 30 ? "debug-warn" : ""}>{fps}</span></div>
                <div className="debug-row"><span>{t("debug.buildings")}</span><span>{placed.length}</span></div>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.gameplay")}</div>
                <div className="debug-row"><span>{t("debug.level")}</span><span>{difficulty}</span></div>
                <div className="debug-row"><span>{t("debug.terraforming")}</span><span>{terraforming.toFixed(2)}%</span></div>
                <div className="debug-row"><span>{t("debug.o2accum")}</span><span>{o2Accumulated.toFixed(1)}</span></div>
                <div className="debug-row"><span>{t("debug.sun")}</span><span>{sun.toFixed(3)}</span></div>
                <div className="debug-row"><span>Power</span><span>{resources.power.toFixed(2)}</span></div>
                <div className="debug-row"><span>Water</span><span>{resources.water.toFixed(2)}</span></div>
                <div className="debug-row"><span>Biomass</span><span>{resources.biomass.toFixed(2)}</span></div>
                <div className="debug-row">
                    <span>3D Debug</span>
                    <button className="debug-btn" onClick={toggleDebugOverlay}>
                        {debugOverlayVisible ? "On" : "Off"}
                    </button>
                </div>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.weather")}</div>
                <div className="debug-row"><span>{t("debug.type")}</span><span>{weather.type}</span></div>
                <div className="debug-row"><span>{t("debug.remaining")}</span><span>{weather.remainingTicks}s</span></div>
                <div className="debug-row"><span>{t("debug.cooldown")}</span><span>{weather.cooldownTicks}s</span></div>
                <div className="debug-row"><span>{t("debug.intensity")}</span><span>{weather.intensity.toFixed(2)}</span></div>
                {weather.impactZones && (
                    <div className="debug-row"><span>{t("debug.zones")}</span><span>{weather.impactZones.length}</span></div>
                )}
                <div className="debug-label" style={{ marginTop: 6 }}>{t("debug.forceWeather")}</div>
                <select
                    className="debug-select"
                    value={weather.type}
                    onChange={(e) => {
                        const type = (e.target.value as WeatherType) || "clear";
                        setForcedWeather(null);
                        switch (type) {
                            case "clear":
                                setWeather({ type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 });
                                break;
                            case "warning":
                                setWeather({ type: "warning", intensity: 0, remainingTicks: 60, cooldownTicks: 0 });
                                break;
                            case "sandstorm":
                            case "dust_storm":
                                setWeather({ type: "dust_storm", intensity: 0.75, remainingTicks: 30, cooldownTicks: 0 });
                                break;
                            case "meteor_warning": {
                                const zones = WeatherService.generateImpactZones();
                                const trajectories = WeatherService.generateTrajectories(zones);
                                setWeather({ type: "meteor_warning", intensity: 0, remainingTicks: 15, impactZones: zones, trajectories, cooldownTicks: 0 });
                                break;
                            }
                            case "meteor_shower": {
                                const zones = WeatherService.generateImpactZones(3);
                                const trajectories = WeatherService.generateTrajectories(zones);
                                setWeather({ type: "meteor_shower", intensity: 1, remainingTicks: 5, impactZones: zones, trajectories, cooldownTicks: 0 });
                                break;
                            }
                            case "polar_aurora":
                                setWeather({ type: "polar_aurora", intensity: 0.85, remainingTicks: 45, cooldownTicks: 0 });
                                break;
                        }
                    }}
                >
                    <option value="clear">{t("debug.normalTick")}</option>
                    {WEATHER_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                    ))}
                </select>
                <div className="debug-row" style={{ marginTop: 6 }}>
                    <span>Meteors</span>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={meteorCount}
                        onChange={(e) => setMeteorCount(parseInt(e.target.value) || 10)}
                        style={{ width: 50 }}
                    />
                    <button className="debug-btn" onClick={() => forceMeteorShower(meteorCount)}>
                        Trigger
                    </button>
                </div>
            </div>

            {import.meta.env.DEV && fixtures.length > 0 && (
                <div className="debug-section">
                    <div className="debug-label">Stan startowy (Fixtures)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                        {fixtures.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className="debug-btn"
                                style={{ fontSize: "11px", padding: "4px 6px", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                onClick={() => {
                                    f.apply(useGameStore);
                                    useGameStore.setState({ isDevFixture: true });
                                }}
                                title={`${f.label} (${f.id}): ${f.description}`}
                            >
                                🎯 {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="debug-section">
                <div className="debug-label">{t("debug.alien")}</div>
                <div className="debug-row"><span>{t("debug.alienWave")}</span><span>{alienState.wave}</span></div>
                <div className="debug-row"><span>{t("debug.alienShips")}</span><span>{alienState.ships.length}</span></div>
                <div className="debug-row"><span>{t("debug.alienGround")}</span><span>{alienState.groundUnits.length}</span></div>
                <div className="debug-row"><span>{t("debug.alienMode")}</span><span>{gameMode}</span></div>
                <div className="debug-row" style={{ marginTop: 6 }}>
                    <span>Count</span>
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={alienCount}
                        onChange={(e) => setAlienCount(parseInt(e.target.value) || 3)}
                        style={{ width: 50 }}
                    />
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="debug-btn" onClick={() => triggerAlienWave(0)}>{t("debug.alienClear")}</button>
                    <button className="debug-btn" onClick={() => triggerAlienWave(1, alienCount)}>{t("debug.alienWave1")}</button>
                    <button className="debug-btn" onClick={() => triggerAlienWave(2, alienCount)}>{t("debug.alienWave2")}</button>
                </div>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.buildings")}</div>
                <label className="debug-check">
                    <input type="checkbox" checked={showBuildingInfo} onChange={toggleBuildingInfo} />
                    {t("debug.showInfo")}
                </label>
                <div className="debug-buildings">
                    {placed.map((b) => (
                        <div key={b.id} className="debug-building-row">
                            <span>{b.definitionId}</span>
                            <span className={b.condition < 30 ? "debug-warn" : ""}>{b.condition}%</span>
                            <span className="debug-pos">{b.position.x},{b.position.z}</span>
                        </div>
                    ))}
                    {placed.length === 0 && <div className="debug-empty">{t("debug.noBuildings")}</div>}
                </div>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.cell")}</div>
                <div className="debug-row"><span>{t("debug.cellSelected")}</span><span>{selectedCell ? `${selectedCell.x},${selectedCell.z}` : "-"}</span></div>
                <div className="debug-row">
                    <span>{t("debug.cellSelected")}</span>
                    <input type="text" value={`${selectedCellValue}`} onChange={(e) => {
                        setSelectedCellValue(e.target.value);
                    }} />
                    <button className="debug-btn" onClick={() => {
                        const [x, z] = selectedCellValue.split(",").map((v) => parseInt(v));
                        if (!isNaN(x) && !isNaN(z)) {
                            cancelBuild()
                            setSelectedBuilding(BUILDING_DEFINITIONS.hab.id);
                            toggleBuildMode();
                            setSelectedCell({ x, z });
                            cancelBuild()
                        }
                    }}>{t("debug.select")}</button>
                    <button className="debug-btn" onClick={() => setSelectedCell(null)}>{t("debug.clearSelection")}</button>
                </div>


            </div>
        </div>
    );
}
