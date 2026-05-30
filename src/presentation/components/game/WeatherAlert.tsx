import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import "./WeatherAlert.css";

const ALERT_CONFIG = {
    warning:        { icon: "⚠️",  maxTicks: 60 },
    sandstorm:      { icon: "🌪️", maxTicks: 60 },
    meteor_warning: { icon: "☄️",  maxTicks: 15 },
    meteor_shower:  { icon: "💥",  maxTicks: 5  },
} as const;

export function WeatherAlert() {
    const { t } = useTranslation();
    const weather = useGameStore((state) => state.weather);

    if (weather.type === "clear") return null;

    const cfg = ALERT_CONFIG[weather.type as keyof typeof ALERT_CONFIG];
    if (!cfg) return null;

    const isMeteorWarning = weather.type === "meteor_warning";
    const isMeteorShower  = weather.type === "meteor_shower";
    const isWarning       = weather.type === "warning";
    const showProgress    = isWarning || isMeteorWarning;
    const impactCount     = weather.impactZones?.length ?? 0;

    return (
        <div className={`weather-alert ${weather.type}`}>
            <div className="weather-alert__icon">{cfg.icon}</div>
            <div className="weather-alert__content">
                <div className="weather-alert__title">{t(`weather.${weather.type}`)}</div>
                <div className="weather-alert__subtitle">
                    {isMeteorWarning && t("weather.subtitle.meteor_warning", { count: impactCount, ticks: weather.remainingTicks })}
                    {isMeteorShower  && t("weather.subtitle.meteor_shower")}
                    {isWarning       && t("weather.subtitle.warning", { ticks: weather.remainingTicks })}
                    {weather.type === "sandstorm" && t("weather.subtitle.sandstorm", { ticks: weather.remainingTicks })}
                </div>
            </div>
            {showProgress && (
                <div className="weather-alert__progress">
                    <div
                        className="weather-alert__progress-fill"
                        style={{ width: `${(weather.remainingTicks / cfg.maxTicks) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
}
