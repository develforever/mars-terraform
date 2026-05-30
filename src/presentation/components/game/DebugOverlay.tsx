import { useEffect, useRef, useState } from "react";
import { useDebugStore } from "../../../application/store/useDebugStore";
import { useGameStore } from "../../../application/store/useGameStore";
import type { WeatherType } from "../../../domain/services/WeatherService";
import "./DebugOverlay.css";

const WEATHER_OPTIONS: WeatherType[] = ["clear", "warning", "sandstorm", "meteor_warning", "meteor_shower"];

export function DebugOverlay() {
    const { enabled, toggleDebug, showBuildingInfo, toggleBuildingInfo, showFPS, forcedWeather, setForcedWeather } = useDebugStore();
    const weather = useGameStore((s) => s.weather);
    const resources = useGameStore((s) => s.resources);
    const terraforming = useGameStore((s) => s.terraforming);
    const o2Accumulated = useGameStore((s) => s.o2Accumulated);
    const sun = useGameStore((s) => s.sun);
    const placed = useGameStore((s) => s.placed);
    const difficulty = useGameStore((s) => s.difficulty);

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
                title="Panel debug (Ctrl+D)"
            >
                🛠
            </button>
        );
    }

    return (
        <div className="debug-overlay">
            <div className="debug-header">
                <span>🛠 DEBUG</span>
                <button onClick={toggleDebug} title="Zamknij (Ctrl+D)">✕</button>
            </div>

            <div className="debug-section">
                <div className="debug-label">Wydajność</div>
                <div className="debug-row"><span>FPS</span><span className={fps < 30 ? "debug-warn" : ""}>{fps}</span></div>
                <div className="debug-row"><span>Budynki</span><span>{placed.length}</span></div>
            </div>

            <div className="debug-section">
                <div className="debug-label">Rozgrywka</div>
                <div className="debug-row"><span>Poziom</span><span>{difficulty}</span></div>
                <div className="debug-row"><span>Terraformacja</span><span>{terraforming.toFixed(2)}%</span></div>
                <div className="debug-row"><span>O₂ akum.</span><span>{o2Accumulated.toFixed(1)}</span></div>
                <div className="debug-row"><span>Słońce</span><span>{sun.toFixed(3)}</span></div>
                <div className="debug-row"><span>Power</span><span>{resources.power.toFixed(2)}</span></div>
                <div className="debug-row"><span>Water</span><span>{resources.water.toFixed(2)}</span></div>
                <div className="debug-row"><span>Biomass</span><span>{resources.biomass.toFixed(2)}</span></div>
            </div>

            <div className="debug-section">
                <div className="debug-label">Pogoda</div>
                <div className="debug-row"><span>Typ</span><span>{weather.type}</span></div>
                <div className="debug-row"><span>Pozostało</span><span>{weather.remainingTicks}s</span></div>
                <div className="debug-row"><span>Cooldown</span><span>{weather.cooldownTicks}s</span></div>
                <div className="debug-row"><span>Intensywność</span><span>{weather.intensity.toFixed(2)}</span></div>
                {weather.impactZones && (
                    <div className="debug-row"><span>Strefy</span><span>{weather.impactZones.length}</span></div>
                )}
                <div className="debug-label" style={{ marginTop: 6 }}>Wymuś pogodę</div>
                <select
                    className="debug-select"
                    value={forcedWeather ?? ""}
                    onChange={(e) => setForcedWeather((e.target.value as WeatherType) || null)}
                >
                    <option value="">— normalny tick —</option>
                    {WEATHER_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                    ))}
                </select>
            </div>

            <div className="debug-section">
                <div className="debug-label">Budynki</div>
                <label className="debug-check">
                    <input type="checkbox" checked={showBuildingInfo} onChange={toggleBuildingInfo} />
                    Pokaż info nad budynkami
                </label>
                <div className="debug-buildings">
                    {placed.map((b) => (
                        <div key={b.id} className="debug-building-row">
                            <span>{b.definitionId}</span>
                            <span className={b.condition < 30 ? "debug-warn" : ""}>{b.condition}%</span>
                            <span className="debug-pos">{b.position.x},{b.position.z}</span>
                        </div>
                    ))}
                    {placed.length === 0 && <div className="debug-empty">Brak budynków</div>}
                </div>
            </div>
        </div>
    );
}
