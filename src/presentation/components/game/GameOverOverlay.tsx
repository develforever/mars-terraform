import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface GameOverOverlayProps {
    onNewGame: () => void;
    onClose?: () => void;
}

export function GameOverOverlay({ onNewGame, onClose }: GameOverOverlayProps) {
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
        <div className="overlay" onClick={handleDismiss}>
            <div className="panel relative" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="modal-close-btn absolute top-3 right-3 text-gray-400 hover:text-white"
                    onClick={handleDismiss}
                    aria-label="Close game over overlay"
                >
                    ✕
                </button>
                <div className="title">{t("hud.gameover.title")}</div>
                <div className="reason">{t("hud.gameover.reason")}</div>
                <button type="button" onClick={onNewGame}>
                    {t("hud.gameover.newGame")}
                </button>
            </div>
        </div>
    );
}
