export type WeatherType = "clear" | "warning" | "sandstorm";

export interface WeatherState {
  type: WeatherType;
  intensity: number;
  remainingTicks: number;
}

export class WeatherService {
  static readonly SANDSTORM_CHANCE = 0.05; // 5% chance per economy tick if clear
  static readonly WARNING_DURATION = 60;   // 60 ticks warning
  static readonly MIN_STORM_DURATION = 20;
  static readonly MAX_STORM_DURATION = 60;

  static tick(currentWeather: WeatherState): WeatherState {
    // Phase: Warning
    if (currentWeather.type === "warning") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { 
          type: "sandstorm", 
          intensity: 0.5 + Math.random() * 0.5, 
          remainingTicks: Math.floor(
            this.MIN_STORM_DURATION + Math.random() * (this.MAX_STORM_DURATION - this.MIN_STORM_DURATION)
          ) 
        };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Sandstorm
    if (currentWeather.type === "sandstorm") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0 };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Start Warning
    if (Math.random() < this.SANDSTORM_CHANCE) {
      return {
        type: "warning",
        intensity: 0,
        remainingTicks: this.WARNING_DURATION,
      };
    }

    return currentWeather;
  }

  static getProductionModifier(weather: WeatherState): number {
    if (weather.type === "sandstorm") {
      return 1 - (weather.intensity * 0.8);
    }
    return 1;
  }
}
