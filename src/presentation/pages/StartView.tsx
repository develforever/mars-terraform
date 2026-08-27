import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StartScene3D } from "../components/game/MarsStartScene";
import { usePageTitle } from "../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";
import { useGameStore } from "../../application/store/useGameStore";
import { useAuthStore } from "../../application/store/useAuthStore";
import { useUIStore } from "../../application/store/useUIStore";
import type { DifficultyLevel } from "../../domain/services/TerraformingService";
import { DIFFICULTY_TARGETS } from "../../domain/services/TerraformingService";
import type { GameMode } from "../../domain/services/GameModeService";
import { GAME_MODE_CONFIGS } from "../../domain/services/GameModeService";
import "./StartView.css";

export default function StartView() {
    usePageTitle("Start");
    const { t } = useTranslation();

    const { open } = useModalStore();
    const setDifficulty = useGameStore((s) => s.setDifficulty);
    const setGameMode = useGameStore((s) => s.setGameMode);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLaunching = useUIStore((s) => s.isLaunching);
    const [selected, setSelected] = useState<DifficultyLevel>("normal");
    const [selectedMode, setSelectedMode] = useState<GameMode>("exploration");

    const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
        easy:   t("start.difficulty.easy"),
        normal: t("start.difficulty.normal"),
        hard:   t("start.difficulty.hard"),
    };

    const handleStart = () => {
        setDifficulty(selected);
        setGameMode(selectedMode);
        open("colony-name");
    };

    const handleScenarios = () => {
        open("scenario-select");
    };

    const handleLoad = () => {
        open("load-game");
    };

    return (
        <div className="start-root">
            <div className={`start-panel${isLaunching ? " start-panel--launching" : ""}`}>
                {/* Game mode selector */}
                <div className="start-mode-row">
                    {(Object.entries(GAME_MODE_CONFIGS) as [GameMode, typeof GAME_MODE_CONFIGS[GameMode]][]).map(([mode, cfg]) => (
                        <button
                            key={mode}
                            onClick={() => setSelectedMode(mode)}
                            className={`start-mode-btn${selectedMode === mode ? " start-mode-btn--selected" : ""}`}
                            disabled={isLaunching}
                        >
                            <span className="start-mode-btn__icon">{cfg.icon}</span>
                            <span className="start-mode-btn__label">{cfg.label}</span>
                            <span className="start-mode-btn__desc">{cfg.description}</span>
                        </button>
                    ))}
                </div>

                {/* Difficulty selector */}
                <div className="start-difficulty-row">
                    {(["easy", "normal", "hard"] as DifficultyLevel[]).map((level) => {
                        const targets = DIFFICULTY_TARGETS[level];
                        return (
                            <button
                                key={level}
                                onClick={() => setSelected(level)}
                                className={`start-diff-btn${selected === level ? " start-diff-btn--selected" : ""}`}
                                disabled={isLaunching}
                            >
                                <span className="start-diff-btn__name">{t(`start.difficulty_label.${level}`)}</span>
                                <span className="start-diff-btn__desc">{DIFFICULTY_DESCRIPTIONS[level]}</span>
                                <span className="start-diff-btn__targets">
                                    O₂ ×{targets.o2Accumulated} / Bio ×{targets.biomass} / H₂O ×{targets.water}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="start-actions">
                    <button className="start-btn-primary" onClick={handleStart} disabled={isLaunching}>
                        {t("start.startGame")}
                    </button>
                    <button className="start-btn-secondary" onClick={handleScenarios} disabled={isLaunching}>
                        {t("scenarios.menuButton")}
                    </button>
                    {isAuthenticated && (
                        <button className="start-btn-secondary" onClick={handleLoad} disabled={isLaunching}>
                            {t("start.load")}
                        </button>
                    )}
                </div>
            </div>

            <StartScene3D onClick={handleStart} warpSpeed={isLaunching} />

            {isLaunching && (
                <div className="launch-overlay">
                    <div className="launch-overlay__glow" />
                    <div className="launch-overlay__content">
                        <div className="launch-overlay__ring" />
                        <div className="launch-overlay__icon">🚀</div>
                        <div className="launch-overlay__text">
                            {t("modal.colony.launching")}
                        </div>
                        <div className="launch-overlay__bar">
                            <div className="launch-overlay__progress" />
                        </div>
                    </div>
                </div>
            )}

            <div className="glitch-overlay" aria-hidden="true" />
        </div>
    );
}
