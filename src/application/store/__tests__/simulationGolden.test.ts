import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../useGameStore";
import { createSeededRng } from "../../../domain/random/Rng";

/**
 * F9-T2: test „złoty” pętli symulacji. Snapshot powstał PRZED wydzieleniem `stepSimulation` ze store;
 * po refaktorze stan po N tickach musi być identyczny (ta sama losowość z ziarnem, ten sam czas).
 */
const TICKS = 300;
const FIXED_NOW = new Date("2026-10-01T12:00:00Z");

const summarize = () => {
  const s = useGameStore.getState();
  return {
    tick: s.tick,
    sol: s.sol,
    alive: s.alive,
    won: s.won,
    resources: s.resources,
    capacity: s.capacity,
    lastDelta: s.lastDelta,
    weather: s.weather,
    terraforming: s.terraforming,
    o2Accumulated: s.o2Accumulated,
    waterLevel: s.waterLevel,
    researchPoints: s.researchPoints,
    placed: s.placed.map((b) => ({ id: b.id, definitionId: b.definitionId, condition: b.condition, level: b.level })),
    units: s.units,
    alienState: s.alienState,
    aliensDefeated: s.aliensDefeated,
    activeQuests: s.activeQuests,
    analyticsSnapshots: s.analyticsSnapshots,
    population: s.population,
    morale: s.morale,
    emergencyLifeSupport: s.emergencyLifeSupport,
    resourceNodes: s.resourceNodes,
  };
};

describe("symulacja: test złoty (F9-T2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    const rng = createSeededRng(2026);
    vi.spyOn(Math, "random").mockImplementation(rng);
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      const hex = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, "0");
      return `${hex}-0000-4000-8000-000000000000` as `${string}-${string}-${string}-${string}-${string}`;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(["exploration", "survival"] as const)("stan po %s ticków trybu %s jest stały", (gameMode) => {
    const store = useGameStore.getState();
    store.resetGame();
    store.startNewGame("Golden", "normal", gameMode);
    if (gameMode === "survival") {
      useGameStore.setState({ alienState: { ...useGameStore.getState().alienState, wave: 2 } });
    }
    useGameStore.setState({ isPaused: false });

    for (let i = 0; i < TICKS; i += 1) useGameStore.getState().applyEconomyTick();

    expect(summarize()).toMatchSnapshot();
  });
});
