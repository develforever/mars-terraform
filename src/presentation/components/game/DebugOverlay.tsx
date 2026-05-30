import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebugStore } from "../../../application/store/useDebugStore";
import { useGameStore } from "../../../application/store/useGameStore";
import type { WeatherType } from "../../../domain/services/WeatherService";
import "./DebugOverlay.css";

const WEATHER_OPTIONS: WeatherType[] = ["clear", "warning", "sandstorm", "meteor_warning", "meteor_shower"];

export function DebugOverlay() {
    const { t } = useTranslation();
    const { enabled, toggleDebug, showBuildingInfo, toggleBuildingInfo, showFPS, forcedWeather, setForcedWeather } = useDebugStore();
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

    const [fps, setFps] = useState(0);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

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
                    value={forcedWeather ?? ""}
                    onChange={(e) => setForcedWeather((e.target.value as WeatherType) || null)}
                >
                    <option value="">{t("debug.normalTick")}</option>
                    {WEATHER_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                    ))}
                </select>
            </div>

            <div className="debug-section">
                <div className="debug-label">{t("debug.alien")}</div>
                <div className="debug-row"><span>{t("debug.alienWave")}</span><span>{alienState.wave}</span></div>
                <div className="debug-row"><span>{t("debug.alienShips")}</span><span>{alienState.ships.length}</span></div>
                <div className="debug-row"><span>{t("debug.alienGround")}</span><span>{alienState.groundUnits.length}</span></div>
                <div className="debug-row"><span>{t("debug.alienMode")}</span><span>{gameMode}</span></div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="debug-btn" onClick={() => triggerAlienWave(0)}>{t("debug.alienClear")}</button>
                    <button className="debug-btn" onClick={() => triggerAlienWave(1)}>{t("debug.alienWave1")}</button>
                    <button className="debug-btn" onClick={() => triggerAlienWave(2)}>{t("debug.alienWave2")}</button>
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
        </div>
    );
}
