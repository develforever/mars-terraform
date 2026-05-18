export type WeatherType = "clear" | "sandstorm";

export interface WeatherState {
  type: WeatherType;
  intensity: number; // 0 to 1
  remainingTicks: number;
}

export class WeatherService {
  static readonly SANDSTORM_CHANCE = 0.05; // 5% chance per economy tick if clear
  static readonly MIN_STORM_DURATION = 10;
  static readonly MAX_STORM_DURATION = 30;

  static tick(currentWeather: WeatherState): WeatherState {
    if (currentWeather.type === "sandstorm") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0 };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Try to start a storm
    if (Math.random() < this.SANDSTORM_CHANCE) {
      return {
        type: "sandstorm",
        intensity: 0.5 + Math.random() * 0.5,
        remainingTicks: Math.floor(
          this.MIN_STORM_DURATION + Math.random() * (this.MAX_STORM_DURATION - this.MIN_STORM_DURATION)
        ),
      };
    }

    return currentWeather;
  }

  static getProductionModifier(weather: WeatherState): number {
    if (weather.type === "sandstorm") {
      // Sandstorms reduce solar power production but could affect others too
      return 1 - (weather.intensity * 0.8); // Up to 80% reduction
    }
    return 1;
  }
}
