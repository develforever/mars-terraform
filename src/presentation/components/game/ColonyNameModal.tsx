import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { generateLocalNames } from "../../../domain/services/ColonyNameGenerator";
import { authClient } from "../../../application/service/authService";
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
    const navigate = useNavigate();
    const startNewGame = useGameStore((s) => s.startNewGame);
    const difficulty = useGameStore((s) => s.difficulty);
    const gameMode = useGameStore((s) => s.gameMode);
    const resetUI = useUIStore((s) => s.resetUI);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const handleConfirm = () => {
        if (!colonyName.trim()) return;
        resetUI();
        startNewGame(colonyName.trim(), difficulty, gameMode);
        onConfirm();
        navigate("/mars");
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
    }, []);

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
                />
                <button
                    className="colony-modal__gen-btn"
                    onClick={handleGenerate}
                    disabled={isGenerating}
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
                                className={`colony-modal__suggestion-btn${colonyName === name ? " colony-modal__suggestion-btn--selected" : ""}`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                    {suggestions[4] && (
                        <button
                            onClick={() => setColonyName(suggestions[4])}
                            className={`colony-modal__suggestion-btn${colonyName === suggestions[4] ? " colony-modal__suggestion-btn--selected" : ""}`}
                        >
                            {suggestions[4]}
                        </button>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="colony-modal__actions">
                <button className="colony-modal__cancel-btn" onClick={onCancel}>
                    {t("modal.colony.back")}
                </button>
                <button
                    className="colony-modal__confirm-btn"
                    onClick={handleConfirm}
                    disabled={!colonyName.trim()}
                >
                    {t("modal.colony.start")}
                </button>
            </div>
        </div>
    );
}
