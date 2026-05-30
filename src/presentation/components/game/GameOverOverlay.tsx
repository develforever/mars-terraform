import { useTranslation } from "react-i18next";

interface GameOverOverlayProps {
    onNewGame: () => void;
}

export function GameOverOverlay({ onNewGame }: GameOverOverlayProps) {
    const { t } = useTranslation();
    return (
        <div className="overlay">
            <div className="panel">
                <div className="title">{t("hud.gameover.title")}</div>
                <div className="reason">{t("hud.gameover.reason")}</div>
                <button type="button" onClick={onNewGame}>
                    {t("hud.gameover.newGame")}
                </button>
            </div>
        </div>
    );
}
