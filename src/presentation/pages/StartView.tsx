import { useState } from "react";
import { StartScene3D } from "../components/game/MarsStartScene";
import { usePageTitle } from "../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";
import { WeatherAlert } from "../components/game/WeatherAlert";
import { useGameStore } from "../../application/store/useGameStore";
import type { DifficultyLevel } from "../../domain/services/TerraformingService";
import { DIFFICULTY_LABELS, DIFFICULTY_TARGETS } from "../../domain/services/TerraformingService";

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
    easy:   "Szybka gra. Idealna na pierwsze podejście.",
    normal: "Zbalansowany poziom. Zalecany.",
    hard:   "Długa kampania. Dla wytrwałych.",
};

export default function StartView() {
    usePageTitle("Start");

    const { open } = useModalStore();
    const setDifficulty = useGameStore((s) => s.setDifficulty);
    const [selected, setSelected] = useState<DifficultyLevel>("normal");

    const handleStart = () => {
        setDifficulty(selected);
        open("colony-name");
    };

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <WeatherAlert />

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
            </div>

            <StartScene3D onClick={handleStart} />
        </div>
    );
}
