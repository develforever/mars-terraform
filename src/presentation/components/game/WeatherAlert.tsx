import { useGameStore } from "../../../application/store/useGameStore";
import "./WeatherAlert.css";

export function WeatherAlert() {
    const weather = useGameStore((state) => state.weather);
    
    if (weather.type === "clear") return null;

    const isWarning = weather.type === "warning";
    
    return (
        <div className={`weather-alert ${weather.type}`}>
            <div className="weather-alert__icon">
                {isWarning ? "⚠️" : "🌪️"}
            </div>
            <div className="weather-alert__content">
                <div className="weather-alert__title">
                    {isWarning ? "OSTRZEŻENIE: BURZA PIASKOWA" : "STAN ALARMOWY: BURZA W TOKU"}
                </div>
                <div className="weather-alert__subtitle">
                    {isWarning 
                        ? `Uderzenie za: ${weather.remainingTicks}s` 
                        : `Koniec za: ${weather.remainingTicks}s`
                    }
                </div>
            </div>
            {isWarning && (
                <div className="weather-alert__progress">
                    <div 
                        className="weather-alert__progress-fill" 
                        style={{ width: `${(weather.remainingTicks / 60) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
}
