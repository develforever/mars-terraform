import { useGameStore } from "../../../application/store/useGameStore";
import "./WeatherAlert.css";

const ALERT_CONFIG = {
    warning:        { icon: "⚠️",  title: "OSTRZEŻENIE: BURZA PIASKOWA",   maxTicks: 60 },
    sandstorm:      { icon: "🌪️", title: "STAN ALARMOWY: BURZA W TOKU",    maxTicks: 60 },
    meteor_warning: { icon: "☄️",  title: "OSTRZEŻENIE: DESZCZ METEORYTÓW", maxTicks: 15 },
    meteor_shower:  { icon: "💥",  title: "UDERZENIE METEORYTÓW!",          maxTicks: 5  },
} as const;

export function WeatherAlert() {
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
                <div className="weather-alert__title">{cfg.title}</div>
                <div className="weather-alert__subtitle">
                    {isMeteorWarning && `${impactCount} stref uderzenia — ${weather.remainingTicks}s do uderzenia`}
                    {isMeteorShower  && "Budynki w strefach uderzenia są uszkadzane!"}
                    {isWarning       && `Uderzenie za: ${weather.remainingTicks}s`}
                    {weather.type === "sandstorm" && `Koniec za: ${weather.remainingTicks}s`}
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
