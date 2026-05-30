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
  /** Ticks remaining before next hazard can trigger */
  cooldownTicks: number;
}

export class WeatherService {
  static readonly SANDSTORM_CHANCE = 0.03; // reduced from 5%
  static readonly METEOR_CHANCE    = 0.02; // reduced from 3%
  static readonly WARNING_DURATION = 60;
  static readonly METEOR_WARNING_DURATION = 15;
  static readonly MIN_STORM_DURATION = 20;
  static readonly MAX_STORM_DURATION = 50;
  static readonly MIN_IMPACTS = 1;
  static readonly MAX_IMPACTS = 3;
  /** Minimum ticks between any two hazard events */
  static readonly HAZARD_COOLDOWN = 120;
  /** Half-extents of the terrain grid */
  static readonly HALF_X = 50;
  static readonly HALF_Z = 25;

  static tick(
    currentWeather: WeatherState,
    sandstormMult = 1,
    meteorMult    = 1,
    hazardsOn     = true,
  ): WeatherState {
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
          cooldownTicks: 0,
        };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Sandstorm
    if (currentWeather.type === "sandstorm") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: this.HAZARD_COOLDOWN };
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
          cooldownTicks: 0,
        };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Meteor shower active → apply damage then clear
    if (currentWeather.type === "meteor_shower") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: this.HAZARD_COOLDOWN };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Clear — tick down cooldown, then chance to trigger hazard
    const cooldownTicks = Math.max(0, (currentWeather.cooldownTicks ?? 0) - 1);
    if (cooldownTicks > 0) {
      return { ...currentWeather, cooldownTicks };
    }

    if (hazardsOn && Math.random() < this.SANDSTORM_CHANCE * sandstormMult) {
      return { type: "warning", intensity: 0, remainingTicks: this.WARNING_DURATION, cooldownTicks: 0 };
    }
    if (hazardsOn && Math.random() < this.METEOR_CHANCE * meteorMult) {
      return {
        type: "meteor_warning",
        intensity: 0,
        remainingTicks: this.METEOR_WARNING_DURATION,
        impactZones: this.generateImpactZones(),
        cooldownTicks: 0,
      };
    }

    return { ...currentWeather, cooldownTicks };
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
