import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";

export const EmergencyLifeSupportAlert = () => {
    const { t } = useTranslation();
    const emergencyLifeSupport = useGameStore((state) => state.emergencyLifeSupport);
    const alive = useGameStore((state) => state.alive);

    if (!emergencyLifeSupport.active || !alive) {
        return null;
    }

    const { secondsRemaining } = emergencyLifeSupport;

    return (
        <div
            role="alert"
            aria-live="assertive"
            data-testid="emergency-life-support-alert"
            className="emergency-alert-banner"
        >
            <div className="emergency-alert-content">
                <span className="emergency-alert-icon">⚠️</span>
                <span className="emergency-alert-title">
                    {t("hud.emergencyLifeSupport.title")}
                </span>
                <span className="emergency-alert-seconds">
                    {t("hud.emergencyLifeSupport.seconds", { seconds: secondsRemaining })}
                </span>
                <span className="emergency-alert-hint">
                    {t("hud.emergencyLifeSupport.hint")}
                </span>
            </div>
        </div>
    );
};
