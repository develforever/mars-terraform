import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stepSimulation, type SimulationState } from "./GameSimulation";
import { createSeededRng } from "../random/Rng";
import { useGameStore } from "../../application/store/useGameStore";

/**
 * F9-T2: rdzeń symulacji używany bez Zustand (tak jak przez przyszły serwer gry).
 * Stan początkowy bierzemy z nowej gry w store, potem liczymy wyłącznie `stepSimulation`.
 */
const initialState = (gameMode: "exploration" | "survival"): SimulationState => {
  useGameStore.getState().resetGame();
  useGameStore.getState().startNewGame("Sim", "normal", gameMode);
  const s = useGameStore.getState();
  return { ...s, alienState: gameMode === "survival" ? { ...s.alienState, wave: 2 } : s.alienState };
};

const run = (start: SimulationState, seed: number, ticks: number): SimulationState => {
  const rng = createSeededRng(seed);
  let state = start;
  for (let i = 0; i < ticks; i += 1) state = { ...state, ...stepSimulation(state, { rng }) };
  return state;
};

describe("stepSimulation (F9-T2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("to samo ziarno = identyczny stan po 200 tickach (bez store, bez Math.random)", () => {
    const start = initialState("survival");
    const spy = vi.spyOn(Math, "random");
    const a = run(start, 9, 200);
    const b = run(start, 9, 200);
    expect(a.resources).toEqual(b.resources);
    expect(a.weather).toEqual(b.weather);
    expect(a.alienState).toEqual(b.alienState);
    expect(a.placed).toEqual(b.placed);
    expect(a.tick).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("nie modyfikuje stanu wejściowego (czysta funkcja)", () => {
    const start = initialState("exploration");
    const snapshot = JSON.stringify({ resources: start.resources, placed: start.placed, tick: start.tick, weather: start.weather });
    stepSimulation(start, { rng: createSeededRng(1) });
    expect(JSON.stringify({ resources: start.resources, placed: start.placed, tick: start.tick, weather: start.weather })).toBe(snapshot);
  });

  it("forcedWeather pomija losowanie pogody", () => {
    const start = initialState("exploration");
    const rng = vi.fn(createSeededRng(3));
    const result = stepSimulation(start, { rng, forcedWeather: "dust_storm" });
    expect(result.weather.type).toBe("dust_storm");
  });

  it("liczy tick, sol i snapshot analityki co 10 ticków", () => {
    const after = run(initialState("exploration"), 4, 10);
    expect(after.tick).toBe(10);
    expect(after.analyticsSnapshots.length).toBeGreaterThan(0);
  });
});
