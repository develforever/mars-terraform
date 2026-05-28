export type WeatherType = "clear" | "warning" | "sandstorm" | "meteor_warning" | "meteor_shower";

export interface ImpactZone {
  x: number;
  z: number;
}

export interface WeatherState {
  type: WeatherType;
  intensity: number;
  remainingTicks: number;
  impactZones?: ImpactZone[];
}

export class WeatherService {
  static readonly SANDSTORM_CHANCE = 0.05;
  static readonly METEOR_CHANCE    = 0.03; // 3% chance per tick if clear
  static readonly WARNING_DURATION = 60;
  static readonly METEOR_WARNING_DURATION = 15; // 15s to react
  static readonly MIN_STORM_DURATION = 20;
  static readonly MAX_STORM_DURATION = 60;
  static readonly MIN_IMPACTS = 1;
  static readonly MAX_IMPACTS = 4;
  /** Half-extents of the terrain grid */
  static readonly HALF_X = 50;
  static readonly HALF_Z = 25;

  static tick(currentWeather: WeatherState): WeatherState {
    // Phase: Sandstorm warning → sandstorm
    if (currentWeather.type === "warning") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return {
          type: "sandstorm",
          intensity: 0.5 + Math.random() * 0.5,
          remainingTicks: Math.floor(
            this.MIN_STORM_DURATION + Math.random() * (this.MAX_STORM_DURATION - this.MIN_STORM_DURATION)
          ),
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

    // Phase: Meteor warning → shower (impact zones already fixed)
    if (currentWeather.type === "meteor_warning") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return {
          type: "meteor_shower",
          intensity: 1,
          remainingTicks: 5,
          impactZones: currentWeather.impactZones,
        };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Meteor shower active → apply damage then clear
    if (currentWeather.type === "meteor_shower") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0 };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Clear — chance to trigger sandstorm or meteor warning
    if (Math.random() < this.SANDSTORM_CHANCE) {
      return { type: "warning", intensity: 0, remainingTicks: this.WARNING_DURATION };
    }
    if (Math.random() < this.METEOR_CHANCE) {
      return {
        type: "meteor_warning",
        intensity: 0,
        remainingTicks: this.METEOR_WARNING_DURATION,
        impactZones: this.generateImpactZones(),
      };
    }

    return currentWeather;
  }

  static generateImpactZones(): ImpactZone[] {
    const count = this.MIN_IMPACTS + Math.floor(Math.random() * (this.MAX_IMPACTS - this.MIN_IMPACTS + 1));
    const zones: ImpactZone[] = [];
    for (let i = 0; i < count; i++) {
      zones.push({
        x: Math.round((Math.random() * 2 - 1) * this.HALF_X),
        z: Math.round((Math.random() * 2 - 1) * this.HALF_Z),
      });
    }
    return zones;
  }

  static getProductionModifier(weather: WeatherState): number {
    if (weather.type === "sandstorm") {
      return 1 - weather.intensity * 0.8;
    }
    return 1;
  }
}
