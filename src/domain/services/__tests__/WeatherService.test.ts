import { describe, it, expect } from "vitest";
import { WeatherService, type WeatherState } from "../WeatherService";
import { MeteorService } from "../MeteorService";

describe("WeatherService - Atmosphere Evolution & Weather System", () => {
  describe("getAtmosphereProperties", () => {
    it("should return barren Martian atmospheric properties at 0% terraforming progress", () => {
      const weather: WeatherState = { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 };
      const props = WeatherService.getAtmosphereProperties(0, 0, weather, 1.0); // Noon

      expect(props.pressureKPa).toBeCloseTo(0.6, 1);
      expect(props.temperatureC).toBeCloseTo(-60.0, 1);
      expect(props.skyTurbidity).toBeCloseTo(10.0, 1);
      expect(props.skyRayleigh).toBeCloseTo(0.3, 1);
      expect(props.fogDensity).toBeCloseTo(0.012, 3);
      expect(props.sunIntensity).toBeGreaterThan(2.0);
      expect(props.auroraIntensity).toBe(0);
    });

    it("should return Earth-like atmospheric properties at 100% terraforming progress", () => {
      const weather: WeatherState = { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 };
      const props = WeatherService.getAtmosphereProperties(100, 800, weather, 1.0);

      expect(props.pressureKPa).toBeCloseTo(101.3, 1);
      expect(props.temperatureC).toBeCloseTo(15.0, 1);
      expect(props.skyTurbidity).toBeCloseTo(2.0, 1);
      expect(props.skyRayleigh).toBeCloseTo(3.0, 1);
      expect(props.fogDensity).toBeCloseTo(0.003, 3);
      expect(props.sunColor).toBe("#ffffff");
      expect(props.auroraIntensity).toBe(0);
    });

    it("should increase turbidity, fog density and tint sky during a dust_storm", () => {
      const stormWeather: WeatherState = { type: "dust_storm", intensity: 1.0, remainingTicks: 30, cooldownTicks: 0 };
      const props = WeatherService.getAtmosphereProperties(30, 100, stormWeather, 1.0);

      expect(props.fogDensity).toBeCloseTo(0.04, 2);
      expect(props.skyTurbidity).toBeGreaterThan(15.0);
      expect(props.sunIntensity).toBeLessThan(2.0); // reduced due to dust occlusion
    });

    it("should set auroraIntensity during polar_aurora", () => {
      const auroraWeather: WeatherState = { type: "polar_aurora", intensity: 0.8, remainingTicks: 40, cooldownTicks: 0 };
      const props = WeatherService.getAtmosphereProperties(70, 500, auroraWeather, 0.0); // Night

      expect(props.auroraIntensity).toBe(0.8);
    });
  });

  describe("tick and weather state transitions", () => {
    it("should transition from warning to dust_storm when remaining ticks reach 0", () => {
      const warning: WeatherState = { type: "warning", intensity: 0, remainingTicks: 1, cooldownTicks: 0 };
      const next = WeatherService.tick(warning, 1, 1, true, 0);

      expect(WeatherService.isDustStorm(next.type)).toBe(true);
      expect(next.remainingTicks).toBeGreaterThanOrEqual(WeatherService.MIN_STORM_DURATION);
    });

    it("should transition from dust_storm to clear with cooldown when ticks expire", () => {
      const storm: WeatherState = { type: "dust_storm", intensity: 0.8, remainingTicks: 1, cooldownTicks: 0 };
      const next = WeatherService.tick(storm, 1, 1, true, 0);

      expect(next.type).toBe("clear");
      expect(next.cooldownTicks).toBe(WeatherService.HAZARD_COOLDOWN);
    });

    it("should transition from meteor_warning to meteor_shower with trajectories", () => {
      const zones = WeatherService.generateImpactZones(2);
      const trajectories = WeatherService.generateTrajectories(zones);
      const warning: WeatherState = {
        type: "meteor_warning",
        intensity: 0,
        remainingTicks: 1,
        impactZones: zones,
        trajectories,
        cooldownTicks: 0,
      };

      const next = WeatherService.tick(warning, 1, 1, true, 0);
      expect(next.type).toBe("meteor_shower");
      expect(next.remainingTicks).toBe(5);
      expect(next.impactZones).toHaveLength(2);
      expect(next.trajectories).toHaveLength(2);
    });

    it("should tick down polar_aurora and return to clear", () => {
      const aurora: WeatherState = { type: "polar_aurora", intensity: 0.8, remainingTicks: 1, cooldownTicks: 0 };
      const next = WeatherService.tick(aurora, 1, 1, true, 80);

      expect(next.type).toBe("clear");
      expect(next.cooldownTicks).toBe(WeatherService.HAZARD_COOLDOWN);
    });
  });

  describe("Meteor 3D Trajectory & Interpolation", () => {
    it("should generate 3D trajectories for all impact zones", () => {
      const zones = [
        { x: 10, z: 20 },
        { x: -15, z: -5 },
      ];
      const trajectories = WeatherService.generateTrajectories(zones, 80);

      expect(trajectories).toHaveLength(2);
      expect(trajectories[0].targetX).toBe(10);
      expect(trajectories[0].targetZ).toBe(20);
      expect(trajectories[0].startY).toBe(80);
    });

    it("should smoothly calculate position on trajectory from start to ground", () => {
      const traj = {
        id: "test-1",
        startX: 50,
        startY: 100,
        startZ: 50,
        targetX: 10,
        targetY: 0,
        targetZ: 10,
        speed: 1,
        radius: 0.8,
      };

      const startPos = MeteorService.getPositionOnTrajectory(traj, 0, 5);
      expect(startPos).toEqual([50, 100, 50]);

      const midPos = MeteorService.getPositionOnTrajectory(traj, 0.5, 0);
      expect(midPos).toEqual([30, 50, 30]);

      const endPos = MeteorService.getPositionOnTrajectory(traj, 1, 10);
      expect(endPos).toEqual([10, 10, 10]); // groundY = 10
    });
  });
});
