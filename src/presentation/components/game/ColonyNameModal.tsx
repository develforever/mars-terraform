import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { generateLocalNames } from "../../../domain/services/ColonyNameGenerator";

interface ColonyNameModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export function ColonyNameModal({ onConfirm, onCancel }: ColonyNameModalProps) {
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
                const token = localStorage.getItem("token");
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

    return (
        <div style={{
            background: "rgba(8, 12, 22, 0.97)",
            border: "1px solid rgba(231, 76, 60, 0.4)",
            borderRadius: "16px",
            padding: "32px",
            width: "480px",
            maxWidth: "95vw",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(231,76,60,0.15)",
            color: "#e5e7eb",
            fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "#fff", marginBottom: "4px", textAlign: "center" }}>
                Nazwij swoją kolonię
            </h2>
            <p style={{ fontSize: "12px", color: "#6b7280", textAlign: "center", marginBottom: "24px", letterSpacing: "0.5px" }}>
                {isAuthenticated ? "🤖 Generator AI aktywny" : "🎲 Generator lokalny"}
            </p>

            {/* Input + generate button */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                    type="text"
                    placeholder="Wpisz lub wybierz nazwę…"
                    value={colonyName}
                    onChange={(e) => setColonyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                    style={{
                        flex: 1,
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "14px",
                        outline: "none",
                    }}
                    autoFocus
                />
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    title={isAuthenticated ? "Generuj przez AI" : "Generuj lokalnie"}
                    style={{
                        padding: "10px 14px",
                        background: isGenerating ? "rgba(255,255,255,0.04)" : "rgba(231,76,60,0.15)",
                        border: "1px solid rgba(231,76,60,0.4)",
                        borderRadius: "8px",
                        color: isGenerating ? "#6b7280" : "#f87171",
                        cursor: isGenerating ? "not-allowed" : "pointer",
                        fontSize: "18px",
                        transition: "all 0.2s",
                        minWidth: "44px",
                    }}
                >
                    {isGenerating ? "⏳" : isAuthenticated ? "🤖" : "🎲"}
                </button>
            </div>

            {/* Suggestions grid */}
            {suggestions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        {suggestions.slice(0, 4).map((name) => (
                            <button
                                key={name}
                                onClick={() => setColonyName(name)}
                                style={{
                                    padding: "8px 10px",
                                    background: colonyName === name ? "rgba(231,76,60,0.2)" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${colonyName === name ? "rgba(231,76,60,0.6)" : "rgba(255,255,255,0.08)"}`,
                                    borderRadius: "6px",
                                    color: colonyName === name ? "#fca5a5" : "#9ca3af",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "all 0.15s",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                    {suggestions[4] && (
                        <button
                            onClick={() => setColonyName(suggestions[4])}
                            style={{
                                padding: "8px 10px",
                                background: colonyName === suggestions[4] ? "rgba(231,76,60,0.2)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${colonyName === suggestions[4] ? "rgba(231,76,60,0.6)" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: "6px",
                                color: colonyName === suggestions[4] ? "#fca5a5" : "#9ca3af",
                                fontSize: "11px",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s",
                            }}
                        >
                            {suggestions[4]}
                        </button>
                    )}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: "10px 20px",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: "13px",
                        transition: "all 0.2s",
                    }}
                >
                    Powrót
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={!colonyName.trim()}
                    style={{
                        flex: 1,
                        padding: "10px 20px",
                        background: colonyName.trim() ? "rgba(231,76,60,0.85)" : "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(231,76,60,0.5)",
                        borderRadius: "8px",
                        color: colonyName.trim() ? "#fff" : "#4b5563",
                        cursor: colonyName.trim() ? "pointer" : "not-allowed",
                        fontSize: "14px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        transition: "all 0.2s",
                    }}
                >
                    🚀 Rozpocznij kolonizację
                </button>
            </div>
        </div>
    );
}
