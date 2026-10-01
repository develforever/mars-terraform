import { describe, expect, it } from "vitest";
import { createSeededRng, randomId } from "./Rng";
import { WeatherService, type WeatherState } from "../services/WeatherService";
import { AlienService, INITIAL_ALIEN_STATE } from "../services/AlienService";
import type { PlacedBuilding } from "../entities/Building";

const take = (rng: () => number, n: number): number[] => Array.from({ length: n }, () => rng());

describe("createSeededRng (F9-T1)", () => {
  it("ta sama wartość ziarna daje tę samą sekwencję, inne ziarno inną", () => {
    expect(take(createSeededRng(42), 5)).toEqual(take(createSeededRng(42), 5));
    expect(take(createSeededRng(42), 5)).not.toEqual(take(createSeededRng(43), 5));
  });

  it("zwraca liczby z [0, 1)", () => {
    const values = take(createSeededRng(7), 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("ma w przybliżeniu równomierny rozkład (średnia ~0,5)", () => {
    const values = take(createSeededRng(123), 20_000);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it("state() pozwala kontynuować tę samą sekwencję (zapis i wczytanie)", () => {
    const original = createSeededRng(99);
    take(original, 10);
    const resumed = createSeededRng(original.state());
    expect(take(resumed, 5)).toEqual(take(original, 5));
  });

  it("randomId jest deterministyczny dla generatora z ziarnem", () => {
    expect(randomId("ship", createSeededRng(1))).toBe(randomId("ship", createSeededRng(1)));
    expect(randomId("ship", createSeededRng(1))).toMatch(/^ship-[0-9a-f]{8}$/);
  });
});

describe("serwisy symulacji z ziarnem (F9-T1)", () => {
  const clear: WeatherState = { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 };

  const runWeather = (seed: number, ticks: number): WeatherState[] => {
    const rng = createSeededRng(seed);
    const states: WeatherState[] = [];
    let weather = clear;
    for (let i = 0; i < ticks; i += 1) {
      weather = WeatherService.tick(weather, 5, 5, true, 50, rng);
      states.push(weather);
    }
    return states;
  };

  it("WeatherService.tick: to samo ziarno = identyczna historia pogody (z meteorami i id)", () => {
    const a = runWeather(2026, 400);
    const b = runWeather(2026, 400);
    expect(a).toEqual(b);
    expect(a.some((w) => w.type !== "clear")).toBe(true);
  });

  it("WeatherService: generowanie stref i trajektorii jest deterministyczne", () => {
    const zonesA = WeatherService.generateImpactZones(undefined, createSeededRng(5));
    const zonesB = WeatherService.generateImpactZones(undefined, createSeededRng(5));
    expect(zonesA).toEqual(zonesB);
    expect(WeatherService.generateTrajectories(zonesA, 100, createSeededRng(6))).toEqual(
      WeatherService.generateTrajectories(zonesB, 100, createSeededRng(6)),
    );
  });

  it("AlienService: spawny z ziarnem są deterministyczne (pozycja, cel, id)", () => {
    const buildings = [
      { id: "b1", definitionId: "hab", position: { x: 1, y: 0, z: 1 } },
      { id: "b2", definitionId: "solar", position: { x: -3, y: 0, z: 2 } },
    ] as unknown as PlacedBuilding[];
    expect(AlienService.spawnShip(buildings, createSeededRng(11))).toEqual(AlienService.spawnShip(buildings, createSeededRng(11)));
    expect(AlienService.spawnGroundUnit(undefined, createSeededRng(12))).toEqual(AlienService.spawnGroundUnit(undefined, createSeededRng(12)));
  });

  it("AlienService.tick: to samo ziarno = ten sam przebieg fali", () => {
    const buildings = [{ id: "b1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100 }] as unknown as PlacedBuilding[];
    const run = (seed: number) => {
      const rng = createSeededRng(seed);
      let state = INITIAL_ALIEN_STATE;
      for (let i = 0; i < 150; i += 1) state = AlienService.tick(state, buildings, 70, undefined, undefined, rng).alienState;
      return state;
    };
    expect(run(77)).toEqual(run(77));
  });
});
