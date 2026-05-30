import { useState } from "react";
import { StartScene3D } from "../components/game/MarsStartScene";
import { usePageTitle } from "../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";
import { useGameStore } from "../../application/store/useGameStore";
import { useAuthStore } from "../../application/store/useAuthStore";
import type { DifficultyLevel } from "../../domain/services/TerraformingService";
import { DIFFICULTY_LABELS, DIFFICULTY_TARGETS } from "../../domain/services/TerraformingService";
import type { GameMode } from "../../domain/services/GameModeService";
import { GAME_MODE_CONFIGS } from "../../domain/services/GameModeService";

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
    easy:   "Szybka gra. Idealna na pierwsze podejście.",
    normal: "Zbalansowany poziom. Zalecany.",
    hard:   "Długa kampania. Dla wytrwałych.",
};

export default function StartView() {
    usePageTitle("Start");

    const { open } = useModalStore();
    const setDifficulty = useGameStore((s) => s.setDifficulty);
    const setGameMode = useGameStore((s) => s.setGameMode);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [selected, setSelected] = useState<DifficultyLevel>("normal");
    const [selectedMode, setSelectedMode] = useState<GameMode>("exploration");

    const handleStart = () => {
        setDifficulty(selected);
        setGameMode(selectedMode);
        open("colony-name");
    };

    const handleLoad = () => {
        open("load-game");
    };

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "24px",
            }}>
                {/* Game mode selector */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "4px" }}>
                    {(Object.entries(GAME_MODE_CONFIGS) as [GameMode, typeof GAME_MODE_CONFIGS[GameMode]][]).map(([mode, cfg]) => {
                        const isSelected = selectedMode === mode;
                        return (
                            <button
                                key={mode}
                                onClick={() => setSelectedMode(mode)}
                                style={{
                                    padding: "10px 16px",
                                    minWidth: "120px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "4px",
                                    background: isSelected ? "rgba(231, 76, 60, 0.2)" : "rgba(8, 12, 20, 0.7)",
                                    border: isSelected ? "2px solid #e74c3c" : "2px solid rgba(255,255,255,0.1)",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    color: "#fff",
                                    backdropFilter: "blur(12px)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <span style={{ fontSize: "20px" }}>{cfg.icon}</span>
                                <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px" }}>{cfg.label}</span>
                                <span style={{ fontSize: "10px", color: "#aaa", textAlign: "center", maxWidth: "110px" }}>{cfg.description}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Difficulty selector */}
                <div style={{
                    display: "flex",
                    gap: "12px",
                }}>
                    {(["easy", "normal", "hard"] as DifficultyLevel[]).map((level) => {
                        const t = DIFFICULTY_TARGETS[level];
                        const isSelected = selected === level;
                        return (
                            <button
                                key={level}
                                onClick={() => setSelected(level)}
                                style={{
                                    padding: "14px 20px",
                                    minWidth: "140px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "6px",
                                    background: isSelected
                                        ? "rgba(231, 76, 60, 0.25)"
                                        : "rgba(8, 12, 20, 0.75)",
                                    border: isSelected
                                        ? "2px solid #e74c3c"
                                        : "2px solid rgba(255,255,255,0.12)",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    color: "#fff",
                                    backdropFilter: "blur(12px)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                                    {DIFFICULTY_LABELS[level]}
                                </span>
                                <span style={{ fontSize: "11px", color: "#aaa", textAlign: "center", maxWidth: "120px" }}>
                                    {DIFFICULTY_DESCRIPTIONS[level]}
                                </span>
                                <span style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
                                    O₂ ×{t.o2Accumulated} / Bio ×{t.biomass} / H₂O ×{t.water}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button
                        onClick={handleStart}
                        style={{
                            padding: "16px 56px",
                            fontSize: "22px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            backgroundColor: "#e74c3c",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(231, 76, 60, 0.4)",
                            textTransform: "uppercase",
                            letterSpacing: "2px",
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#c0392b";
                            e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#e74c3c";
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        Start Game
                    </button>
                    {isAuthenticated && (
                        <button
                            onClick={handleLoad}
                            style={{
                                padding: "16px 28px",
                                fontSize: "15px",
                                fontWeight: 700,
                                color: "#d1d5db",
                                backgroundColor: "rgba(8, 12, 22, 0.8)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "8px",
                                cursor: "pointer",
                                textTransform: "uppercase",
                                letterSpacing: "1.5px",
                                backdropFilter: "blur(12px)",
                                transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "rgba(231,76,60,0.5)";
                                e.currentTarget.style.color = "#fff";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                                e.currentTarget.style.color = "#d1d5db";
                            }}
                        >
                            📂 Wczytaj
                        </button>
                    )}
                </div>
            </div>

            <StartScene3D onClick={handleStart} />
        </div>
    );
}
