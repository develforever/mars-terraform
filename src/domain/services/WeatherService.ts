export type WeatherType =
  | "clear"
  | "warning"
  | "sandstorm"
  | "dust_storm"
  | "meteor_warning"
  | "meteor_shower"
  | "polar_aurora";

export interface ImpactZone {
  x: number;
  z: number;
}

export interface MeteorTrajectory {
  id: string;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  speed: number;
  radius: number;
}

export interface WeatherState {
  type: WeatherType;
  intensity: number;
  remainingTicks: number;
  impactZones?: ImpactZone[];
  trajectories?: MeteorTrajectory[];
  /** Ticks remaining before next hazard can trigger */
  cooldownTicks: number;
}

export interface AtmosphereProperties {
  pressureKPa: number;
  temperatureC: number;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoefficient: number;
  skyMieDirectionalG: number;
  auroraIntensity: number;
}

export class WeatherService {
  static readonly SANDSTORM_CHANCE = 0.03; // 3%
  static readonly METEOR_CHANCE    = 0.02; // 2%
  static readonly AURORA_CHANCE    = 0.04; // 4% when terraforming >= 40%
  static readonly WARNING_DURATION = 60;
  static readonly METEOR_WARNING_DURATION = 15;
  static readonly MIN_STORM_DURATION = 20;
  static readonly MAX_STORM_DURATION = 50;
  static readonly MIN_AURORA_DURATION = 30;
  static readonly MAX_AURORA_DURATION = 60;
  static readonly MIN_IMPACTS = 1;
  static readonly MAX_IMPACTS = 3;
  /** Minimum ticks between any two hazard events */
  static readonly HAZARD_COOLDOWN = 120;
  /** Half-extents of the terrain grid */
  static readonly HALF_X = 50;
  static readonly HALF_Z = 25;

  static isDustStorm(type: WeatherType): boolean {
    return type === "dust_storm" || type === "sandstorm";
  }

  static tick(
    currentWeather: WeatherState,
    sandstormMult = 1,
    meteorMult    = 1,
    hazardsOn     = true,
    terraformingProgress = 0,
  ): WeatherState {
    // Phase: Sandstorm / Dust storm warning → dust_storm
    if (currentWeather.type === "warning") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return {
          type: "dust_storm",
          intensity: 0.5 + Math.random() * 0.5,
          remainingTicks: Math.floor(
            this.MIN_STORM_DURATION + Math.random() * (this.MAX_STORM_DURATION - this.MIN_STORM_DURATION)
          ),
          cooldownTicks: 0,
        };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Dust storm / Sandstorm
    if (this.isDustStorm(currentWeather.type)) {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        return { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: this.HAZARD_COOLDOWN };
      }
      return { ...currentWeather, remainingTicks };
    }

    // Phase: Meteor warning → shower (impact zones & trajectories fixed)
    if (currentWeather.type === "meteor_warning") {
      const remainingTicks = currentWeather.remainingTicks - 1;
      if (remainingTicks <= 0) {
        const impactZones = currentWeather.impactZones ?? this.generateImpactZones();
        const trajectories = currentWeather.trajectories ?? this.generateTrajectories(impactZones);
        return {
          type: "meteor_shower",
          intensity: 1,
          remainingTicks: 5,
          impactZones,
          trajectories,
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

    // Phase: Polar Aurora active
    if (currentWeather.type === "polar_aurora") {
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
      const impactZones = this.generateImpactZones();
      const trajectories = this.generateTrajectories(impactZones);
      return {
        type: "meteor_warning",
        intensity: 0,
        remainingTicks: this.METEOR_WARNING_DURATION,
        impactZones,
        trajectories,
        cooldownTicks: 0,
      };
    }
    if (hazardsOn && terraformingProgress >= 40 && Math.random() < this.AURORA_CHANCE) {
      return {
        type: "polar_aurora",
        intensity: 0.6 + Math.random() * 0.4,
        remainingTicks: Math.floor(
          this.MIN_AURORA_DURATION + Math.random() * (this.MAX_AURORA_DURATION - this.MIN_AURORA_DURATION)
        ),
        cooldownTicks: 0,
      };
    }

    return { ...currentWeather, cooldownTicks };
  }

  static generateImpactZones(count?: number): ImpactZone[] {
    const zoneCount = count ?? (this.MIN_IMPACTS + Math.floor(Math.random() * (this.MAX_IMPACTS - this.MIN_IMPACTS + 1)));
    const zones: ImpactZone[] = [];
    for (let i = 0; i < zoneCount; i++) {
      zones.push({
        x: Math.round((Math.random() * 2 - 1) * this.HALF_X),
        z: Math.round((Math.random() * 2 - 1) * this.HALF_Z),
      });
    }
    return zones;
  }

  static generateTrajectories(impactZones: ImpactZone[], startElevation = 100): MeteorTrajectory[] {
    return impactZones.map((zone, index) => {
      const angle = (Math.PI / 4) + (Math.random() * 0.4 - 0.2); // ~45 deg descent
      const azimuth = Math.random() * Math.PI * 2;
      const distance = startElevation / Math.tan(angle);

      return {
        id: `meteor-traj-${Date.now()}-${index}`,
        startX: zone.x + Math.cos(azimuth) * distance,
        startY: startElevation,
        startZ: zone.z + Math.sin(azimuth) * distance,
        targetX: zone.x,
        targetY: 0,
        targetZ: zone.z,
        speed: 1.2 + Math.random() * 0.6,
        radius: 0.8 + Math.random() * 0.6,
      };
    });
  }

  static getProductionModifier(weather: WeatherState): number {
    if (this.isDustStorm(weather.type)) {
      return 1 - weather.intensity * 0.8;
    }
    return 1;
  }

  /**
   * Helper to interpolate between two RGB hex colors.
   */
  private static interpolateColor(hexA: string, hexB: string, factor: number): string {
    const f = Math.max(0, Math.min(1, factor));
    const parse = (hex: string) => {
      const clean = hex.replace("#", "");
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = parse(hexA);
    const [r2, g2, b2] = parse(hexB);
    const r = Math.round(r1 + (r2 - r1) * f).toString(16).padStart(2, "0");
    const g = Math.round(g1 + (g2 - g1) * f).toString(16).padStart(2, "0");
    const b = Math.round(b1 + (b2 - b1) * f).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  /**
   * Calculates optical, lighting, fog and atmospheric properties based on terraforming progress,
   * current weather event, and day/night cycle sun factor (0..1).
   */
  static getAtmosphereProperties(
    terraformingProgress: number,
    _o2Accumulated: number,
    weather: WeatherState,
    sunFactor: number,
  ): AtmosphereProperties {
    const tfRatio = Math.max(0, Math.min(1, terraformingProgress / 100));
    const isStorm = this.isDustStorm(weather.type);
    const stormIntensity = isStorm ? weather.intensity : weather.type === "warning" ? 0.2 : 0;
    const isAurora = weather.type === "polar_aurora";

    // Atmospheric Pressure: 0.6 kPa (Martian baseline) -> 101.3 kPa (Terraformed Earth-like)
    const pressureKPa = Math.round((0.6 + tfRatio * (101.3 - 0.6)) * 10) / 10;
    // Temperature: -60°C -> +15°C
    const temperatureC = Math.round((-60 + tfRatio * 75) * 10) / 10;

    // Color definitions for day & night across terraforming stages
    const earlyMarsNight = "#0a0814";
    const terraformedNight = "#070b1a";
    const earlyMarsDay = "#452a2a";
    const terraformedDay = "#3a82e4"; // rich atmospheric blue

    // 1. Interpolate base night and day by terraforming progress
    const baseNight = this.interpolateColor(earlyMarsNight, terraformedNight, tfRatio);
    const baseDay = this.interpolateColor(earlyMarsDay, terraformedDay, tfRatio);

    // 2. Interpolate by sunFactor
    let skyColor = this.interpolateColor(baseNight, baseDay, sunFactor);
    let fogColor = skyColor;

    // 3. Apply dust storm tinting
    if (stormIntensity > 0) {
      const dustColor = "#8b5a2b";
      skyColor = this.interpolateColor(skyColor, dustColor, stormIntensity * 0.75);
      fogColor = this.interpolateColor(fogColor, dustColor, stormIntensity * 0.85);
    } else if (isAurora && (1 - sunFactor) > 0.3) {
      // Aurora luminous tint in night sky
      const auroraTint = "#0d3b36";
      skyColor = this.interpolateColor(skyColor, auroraTint, weather.intensity * 0.4);
    }

    // Fog Density: 0.012 early Mars -> 0.003 terraformed, scaling up to 0.04 during storms
    const baseFogDensity = 0.012 - tfRatio * 0.009;
    const fogDensity = isStorm
      ? baseFogDensity + (0.04 - baseFogDensity) * stormIntensity
      : weather.type === "warning"
      ? baseFogDensity * 1.3
      : baseFogDensity;

    // Sunlight color and intensity
    const earlySunColor = "#ffe4c4";
    const terraformedSunColor = "#ffffff";
    let sunColor = this.interpolateColor(earlySunColor, terraformedSunColor, tfRatio);
    if (stormIntensity > 0) {
      sunColor = this.interpolateColor(sunColor, "#ff8833", stormIntensity * 0.5);
    }
    const sunIntensity = 2.5 * sunFactor * (1 - stormIntensity * 0.5);

    // Ambient lighting: warm Martian bounce (#b06040) -> soft daylight blue (#cce5ff)
    const earlyAmbientColor = "#b06040";
    const terraformedAmbientColor = "#a8d0f5";
    const ambientColor = this.interpolateColor(earlyAmbientColor, terraformedAmbientColor, tfRatio);
    const ambientIntensity = (0.45 + sunFactor * 0.4) * (1 + tfRatio * 0.25) * (1 - stormIntensity * 0.3);

    // Sky shader optical properties (Drei Sky)
    const skyTurbidity = isStorm
      ? 10.0 + stormIntensity * 10.0
      : 10.0 - tfRatio * 8.0; // 10.0 (dusty) -> 2.0 (crisp blue)

    const skyRayleigh = isStorm
      ? 0.4
      : 0.3 + tfRatio * 2.7; // 0.3 (thin) -> 3.0 (dense Rayleigh scattering)

    const skyMieCoefficient = isStorm
      ? 0.035
      : 0.005 - tfRatio * 0.003; // 0.005 -> 0.002

    const skyMieDirectionalG = 0.8 + tfRatio * 0.05;

    const auroraIntensity = isAurora ? weather.intensity : 0;

    return {
      pressureKPa,
      temperatureC,
      skyColor,
      fogColor,
      fogDensity,
      sunColor,
      sunIntensity,
      ambientColor,
      ambientIntensity,
      skyTurbidity,
      skyRayleigh,
      skyMieCoefficient,
      skyMieDirectionalG,
      auroraIntensity,
    };
  }
}
