import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";

export const TimeControls = () => {
    const { t } = useTranslation();
    const isPaused = useGameStore((state) => state.isPaused);
    const gameSpeed = useGameStore((state) => state.gameSpeed);
    const togglePause = useGameStore((state) => state.togglePause);
    const setGameSpeed = useGameStore((state) => state.setGameSpeed);
    const setIsPaused = useGameStore((state) => state.setIsPaused);

    const handleSpeedChange = (speed: 1 | 2 | 4) => {
        setGameSpeed(speed);
        if (isPaused) {
            setIsPaused(false);
        }
    };

    return (
        <div className="time-controls" data-testid="time-controls">
            <button
                type="button"
                className={`time-btn time-btn--pause ${isPaused ? "time-btn--active-pause animate-pulse" : ""}`}
                onClick={togglePause}
                title={isPaused ? t("hud.timeControls.resume") : t("hud.timeControls.pause")}
                aria-label={isPaused ? t("hud.timeControls.resume") : t("hud.timeControls.pause")}
                data-testid="time-control-pause"
            >
                {isPaused ? "▶" : "⏸"}
            </button>

            <button
                type="button"
                className={`time-btn ${!isPaused && gameSpeed === 1 ? "time-btn--active" : ""}`}
                onClick={() => handleSpeedChange(1)}
                title={t("hud.timeControls.speed1x")}
                data-testid="time-control-1x"
            >
                1x
            </button>

            <button
                type="button"
                className={`time-btn ${!isPaused && gameSpeed === 2 ? "time-btn--active" : ""}`}
                onClick={() => handleSpeedChange(2)}
                title={t("hud.timeControls.speed2x")}
                data-testid="time-control-2x"
            >
                2x
            </button>

            <button
                type="button"
                className={`time-btn ${!isPaused && gameSpeed === 4 ? "time-btn--active" : ""}`}
                onClick={() => handleSpeedChange(4)}
                title={t("hud.timeControls.speed4x")}
                data-testid="time-control-4x"
            >
                4x
            </button>

            {isPaused && (
                <span className="time-paused-indicator" data-testid="time-paused-badge">
                    {t("hud.timeControls.paused")}
                </span>
            )}
        </div>
    );
};
