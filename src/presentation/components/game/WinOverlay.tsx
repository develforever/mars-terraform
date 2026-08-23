import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DifficultyLevel } from "../../../domain/services/TerraformingService";

interface WinOverlayProps {
    difficulty: DifficultyLevel;
    onPlayAgain: () => void;
    onClose?: () => void;
}

export function WinOverlay({ difficulty, onPlayAgain, onClose }: WinOverlayProps) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(false);

    const handleDismiss = () => {
        setDismissed(true);
        onClose?.();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleDismiss();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    if (dismissed) return null;

    return (
        <div className="overlay overlay--win" onClick={handleDismiss}>
            <div className="panel panel--win relative" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="modal-close-btn absolute top-3 right-3 text-gray-400 hover:text-white"
                    onClick={handleDismiss}
                    aria-label="Close win overlay"
                >
                    ✕
                </button>
                <div className="title">{t("hud.win.title")}</div>
                <div className="reason">
                    {t("hud.win.reason")} <strong>{t(`start.difficulty_label.${difficulty}`)}</strong>.
                </div>
                <div className="reason" style={{ fontSize: "13px", opacity: 0.7, marginTop: "4px" }}>
                    {t("hud.win.flavor")}
                </div>
                <button type="button" onClick={onPlayAgain}>
                    {t("hud.win.playAgain")}
                </button>
            </div>
        </div>
    );
}
