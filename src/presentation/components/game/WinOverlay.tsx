import { useTranslation } from "react-i18next";
import type { DifficultyLevel } from "../../../domain/services/TerraformingService";

interface WinOverlayProps {
    difficulty: DifficultyLevel;
    onPlayAgain: () => void;
}

export function WinOverlay({ difficulty, onPlayAgain }: WinOverlayProps) {
    const { t } = useTranslation();
    return (
        <div className="overlay overlay--win">
            <div className="panel panel--win">
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
