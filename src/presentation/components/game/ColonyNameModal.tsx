import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { generateLocalNames } from "../../../domain/services/ColonyNameGenerator";
import { authClient } from "../../../application/service/authService";
import { mapApiService, type MapSummaryResponse } from "../../../application/service/mapApiService";
import { parseMapJSON } from "../../generator/schema/mapSchema";
import type { MapExportJSON } from "../../../domain/mapEditorTypes";
import "./ColonyNameModal.css";

interface ColonyNameModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export function ColonyNameModal({ onConfirm, onCancel }: ColonyNameModalProps) {
    const { t } = useTranslation();
    const [colonyName, setColonyName] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);

    // Map selection state
    const [mapSource, setMapSource] = useState<"procedural" | "cloud">("procedural");
    const [proceduralSeed, setProceduralSeed] = useState<number>(42);
    const [cloudMaps, setCloudMaps] = useState<MapSummaryResponse[]>([]);
    const [selectedCloudMapId, setSelectedCloudMapId] = useState<number | null>(null);
    const [selectedMapData, setSelectedMapData] = useState<MapExportJSON | null>(null);
    const [isLoadingMaps, setIsLoadingMaps] = useState(false);
    const [isLoadingMapDetail, setIsLoadingMapDetail] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    const navigate = useNavigate();
    const startNewGame = useGameStore((s) => s.startNewGame);
    const difficulty = useGameStore((s) => s.difficulty);
    const gameMode = useGameStore((s) => s.gameMode);
    const resetUI = useUIStore((s) => s.resetUI);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const setLaunching = useUIStore((s) => s.setLaunching);

    const fetchCloudMaps = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingMaps(true);
        setMapError(null);
        try {
            const data = await mapApiService.listMaps();
            setCloudMaps(data);
        } catch (err) {
            setMapError(err instanceof Error ? err.message : "Nie udało się pobrać listy map z chmury.");
        } finally {
            setIsLoadingMaps(false);
        }
    }, [isAuthenticated]);

    const handleSelectCloudMap = async (mapId: number) => {
        setSelectedCloudMapId(mapId);
        setIsLoadingMapDetail(true);
        setMapError(null);
        try {
            const detail = await mapApiService.getMap(mapId);
            let rawData: unknown;
            try {
                rawData = typeof detail.data === "string" ? JSON.parse(detail.data) : detail.data;
            } catch {
                setMapError("Błąd dekodowania danych mapy.");
                setIsLoadingMapDetail(false);
                return;
            }

            const parsed = parseMapJSON(rawData);
            if (!parsed.ok || !parsed.data) {
                setMapError(`Nieprawidłowa mapa: ${parsed.error}`);
                setIsLoadingMapDetail(false);
                return;
            }

            setSelectedMapData(parsed.data);
        } catch (err) {
            setMapError(err instanceof Error ? err.message : "Nie udało się załadować zawartości mapy.");
        } finally {
            setIsLoadingMapDetail(false);
        }
    };

    const handleConfirm = () => {
        if (!colonyName.trim() || isLaunching) return;
        setIsLaunching(true);
        resetUI();
        const mapPayload = mapSource === "procedural" ? null : selectedMapData;
        startNewGame(colonyName.trim(), difficulty, gameMode, mapPayload, mapSource === "procedural" ? proceduralSeed : undefined);
        setLaunching(true);
        onConfirm(); // Close modal immediately — show 3D scene behind

        setTimeout(() => {
            setLaunching(false);
            navigate("/mars");
        }, 3000);
    };

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        try {
            if (isAuthenticated) {
                const token = authClient.getToken();
                const res = await fetch("/api/colony-names/generate", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                if (res.ok) {
                    const data = await res.json() as { names: string[] };
                    setSuggestions(data.names);
                    return;
                }
            }
            setSuggestions(generateLocalNames(5));
        } catch {
            setSuggestions(generateLocalNames(5));
        } finally {
            setIsGenerating(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        handleGenerate();
    }, [handleGenerate]);

    if (isLaunching) {
        return (
            <div className="colony-modal colony-modal--launching">
                <div className="colony-modal__launch-content">
                    <div className="colony-modal__launch-ring" />
                    <div className="colony-modal__launch-icon">🚀</div>
                    <div className="colony-modal__launch-text">
                        {t("modal.colony.launching")}
                    </div>
                    <div className="colony-modal__launch-name">{colonyName}</div>
                    <div className="colony-modal__launch-bar">
                        <div className="colony-modal__launch-progress" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="colony-modal">
            <h2 className="colony-modal__title">{t("modal.colony.title")}</h2>
            <p className="colony-modal__subtitle">
                {isAuthenticated ? t("modal.colony.aiActive") : t("modal.colony.localGen")}
            </p>

            {/* Input + generate button */}
            <div className="colony-modal__input-row">
                <input
                    className="colony-modal__input"
                    type="text"
                    placeholder={t("modal.colony.placeholder")}
                    value={colonyName}
                    onChange={(e) => setColonyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                    autoFocus
                    disabled={isLaunching}
                />
                <button
                    className="colony-modal__gen-btn"
                    onClick={handleGenerate}
                    disabled={isGenerating || isLaunching}
                    title={isAuthenticated ? t("modal.colony.genAI") : t("modal.colony.genLocal")}
                >
                    {isGenerating ? "⏳" : isAuthenticated ? "🤖" : "🎲"}
                </button>
            </div>

            {/* Suggestions grid */}
            {suggestions.length > 0 && (
                <div className="colony-modal__suggestions">
                    <div className="colony-modal__suggestions-grid">
                        {suggestions.slice(0, 4).map((name) => (
                            <button
                                key={name}
                                onClick={() => setColonyName(name)}
                                disabled={isLaunching}
                                className={`colony-modal__suggestion-btn${colonyName === name ? " colony-modal__suggestion-btn--selected" : ""}`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                    {suggestions[4] && (
                        <button
                            onClick={() => setColonyName(suggestions[4])}
                            disabled={isLaunching}
                            className={`colony-modal__suggestion-btn${colonyName === suggestions[4] ? " colony-modal__suggestion-btn--selected" : ""}`}
                        >
                            {suggestions[4]}
                        </button>
                    )}
                </div>
            )}

            {/* Map Selection Section */}
            <div className="colony-modal__section">
                <div className="colony-modal__section-title">Wybór Mapy (Map Selection)</div>
                <div className="colony-modal__map-sources">
                    <button
                        type="button"
                        className={`colony-modal__map-source-btn ${mapSource === "procedural" ? "colony-modal__map-source-btn--active" : ""}`}
                        onClick={() => {
                            setMapSource("procedural");
                            setSelectedMapData(null);
                            setMapError(null);
                        }}
                        disabled={isLaunching}
                    >
                        <span className="colony-modal__map-source-icon">🌋</span>
                        <span>Procedural Mars</span>
                    </button>
                    <button
                        type="button"
                        className={`colony-modal__map-source-btn ${mapSource === "cloud" ? "colony-modal__map-source-btn--active" : ""}`}
                        onClick={() => {
                            setMapSource("cloud");
                            setMapError(null);
                            if (isAuthenticated && cloudMaps.length === 0) {
                                fetchCloudMaps();
                            }
                        }}
                        disabled={isLaunching}
                    >
                        <span className="colony-modal__map-source-icon">☁</span>
                        <span>Cloud Maps</span>
                    </button>
                </div>

                {mapSource === "procedural" && (
                    <div className="colony-modal__procedural-section">
                        <div className="colony-modal__seed-row">
                            <label htmlFor="procedural-seed-input" className="colony-modal__seed-label">
                                Seed:
                            </label>
                            <input
                                id="procedural-seed-input"
                                type="number"
                                className="colony-modal__seed-input"
                                value={proceduralSeed}
                                onChange={(e) => setProceduralSeed(Number(e.target.value))}
                                disabled={isLaunching}
                            />
                            <button
                                type="button"
                                className="colony-modal__seed-dice-btn"
                                onClick={() => setProceduralSeed(Math.floor(Math.random() * 99999))}
                                disabled={isLaunching}
                                title="Wylosuj seed"
                            >
                                🎲
                            </button>
                        </div>
                    </div>
                )}

                {mapSource === "cloud" && (
                    <div className="colony-modal__cloud-section">
                        {!isAuthenticated ? (
                            <div className="colony-modal__notice">
                                🔒 Zaloguj się, aby wybrać zapisaną mapę z chmury.
                            </div>
                        ) : isLoadingMaps ? (
                            <div className="colony-modal__loading">⏳ Pobieranie listy map...</div>
                        ) : cloudMaps.length === 0 ? (
                            <div className="colony-modal__notice">
                                🗺️ Brak zapisanych map w chmurze. Użyj edytora map do ich stworzenia.
                            </div>
                        ) : (
                            <div className="colony-modal__select-row">
                                <select
                                    aria-label="Wybierz mapę z chmury"
                                    className="colony-modal__select"
                                    value={selectedCloudMapId ?? ""}
                                    onChange={(e) => handleSelectCloudMap(Number(e.target.value))}
                                    disabled={isLaunching || isLoadingMapDetail}
                                >
                                    <option value="" disabled>-- Wybierz mapę z chmury --</option>
                                    {cloudMaps.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.players} graczy)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isLoadingMapDetail && (
                            <div className="colony-modal__loading">⏳ Ładowanie zawartości mapy...</div>
                        )}

                        {selectedMapData && (
                            <div className="colony-modal__map-badge">
                                <div className="colony-modal__map-badge-header">
                                    <span className="colony-modal__map-badge-name">📍 {selectedMapData.meta.name}</span>
                                    <span className="colony-modal__map-badge-players">👥 {selectedMapData.meta.players} graczy</span>
                                </div>
                                <div className="colony-modal__map-badge-details">
                                    <span>Promień: {selectedMapData.meta.hexRadius}</span>
                                    <span>Wersja: v{selectedMapData.meta.version}</span>
                                    <span>Heksogeny: {selectedMapData.hexes.length}</span>
                                </div>
                            </div>
                        )}

                        {mapError && (
                            <div className="colony-modal__error">⚠️ {mapError}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="colony-modal__actions">
                <button className="colony-modal__cancel-btn" onClick={onCancel} disabled={isLaunching}>
                    {t("modal.colony.back")}
                </button>
                <button
                    className="colony-modal__confirm-btn"
                    onClick={handleConfirm}
                    disabled={!colonyName.trim() || isLaunching || (mapSource === "cloud" && !selectedMapData)}
                >
                    {t("modal.colony.start")}
                </button>
            </div>
        </div>
    );
}

