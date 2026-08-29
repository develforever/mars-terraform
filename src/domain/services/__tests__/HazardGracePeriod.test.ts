import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WeatherService, type WeatherState } from "../WeatherService";
import { useGameStore } from "../../../application/store/useGameStore";

describe("HazardGracePeriod - Initial Colony Protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("przez pierwsze 180 tikow nowej gry nie wystepuje zadna katastrofa", () => {
    // Math.random always returns 0 to maximize hazard trigger probability (3% sandstorm, 2% meteor)
    vi.spyOn(Math, "random").mockReturnValue(0);

    let state: WeatherState = {
      type: "clear",
      intensity: 0,
      remainingTicks: 0,
      cooldownTicks: WeatherService.INITIAL_GRACE_TICKS,
    };

    for (let tick = 1; tick <= 180; tick++) {
      state = WeatherService.tick(state, 1, 1, true, 0);
      expect(state.type).toBe("clear");
      expect(state.cooldownTicks).toBe(180 - tick);
    }
  });

  it("po okresie ochronnym katastrofy znow moga wystapic", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    let state: WeatherState = {
      type: "clear",
      intensity: 0,
      remainingTicks: 0,
      cooldownTicks: WeatherService.INITIAL_GRACE_TICKS,
    };

    // Run through the 180-tick grace period
    for (let tick = 1; tick <= 180; tick++) {
      state = WeatherService.tick(state, 1, 1, true, 0);
    }
    expect(state.cooldownTicks).toBe(0);

    // Tick 181 with Math.random = 0 triggers a hazard warning
    const postGraceState = WeatherService.tick(state, 1, 1, true, 0);
    expect(postGraceState.type).not.toBe("clear");
    expect(["warning", "sandstorm", "dust_storm", "meteor_warning"]).toContain(postGraceState.type);
  });

  it("wczytana gra nie dostaje nowego okresu ochronnego", async () => {
    const savedWeather: WeatherState = {
      type: "clear",
      intensity: 0,
      remainingTicks: 0,
      cooldownTicks: 15,
    };

    // Start a new game and check initial weather has full grace period
    useGameStore.getState().startNewGame("GraceColony", "normal", "exploration");
    expect(useGameStore.getState().weather.cooldownTicks).toBe(WeatherService.INITIAL_GRACE_TICKS);

    // Mock fetch for loadGame with custom saved weather state
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "LoadedColony",
        state: {
          colonyName: "LoadedColony",
          weather: savedWeather,
          placed: [],
          resources: { o2: 10, power: 10, water: 10, biomass: 10, minerals: 50 },
        },
      }),
    }) as unknown as typeof fetch;

    const loaded = await useGameStore.getState().loadGame();
    expect(loaded).toBe(true);
    expect(useGameStore.getState().weather.cooldownTicks).toBe(15);
  });
});

