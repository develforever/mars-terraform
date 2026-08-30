import { describe, it, expect, beforeEach } from "vitest";
import { STATE_FIXTURES } from "../index";
import { useGameStore } from "../../../application/store/useGameStore";
import { savedGameSchema } from "../../../application/service/localSaveService";
import { BUILDING_DEFINITIONS } from "../../config/buildings";
import { BuildingService } from "../../services/BuildingService";

describe("State Fixtures Registry", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it("id fixtureow sa unikalne", () => {
    const ids = STATE_FIXTURES.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids.length).toBe(7);
  });

  describe.each(STATE_FIXTURES)("Fixture: $id ($label)", (fixture) => {
    it("buduje spojny stan przechodzacy walidacje savedGameSchema", () => {
      fixture.apply(useGameStore);
      const state = useGameStore.getState();

      const dataToValidate = {
        version: 1,
        timestamp: Date.now(),
        colonyName: state.colonyName,
        currentScenarioId: state.currentScenarioId ?? null,
        mapSeed: state.mapSeed,
        currentMapData: state.currentMapData ?? null,
        difficulty: state.difficulty,
        gameMode: state.gameMode,
        resources: state.resources,
        capacity: state.capacity,
        placed: state.placed,
        occupied: state.occupied,
        units: state.units,
        weather: state.weather,
        terraforming: state.terraforming,
        o2Accumulated: state.o2Accumulated,
        sun: state.sun,
        alienState: state.alienState,
        researchPoints: state.researchPoints,
        unlockedTechs: state.unlockedTechs,
        activeQuests: state.activeQuests,
        population: state.population,
        morale: state.morale,
        tick: state.tick,
        sol: state.sol,
        aliensDefeated: state.aliensDefeated,
        isEndless: state.isEndless,
        resourceNodes: state.resourceNodes,
        decorations: state.decorations,
      };

      const parseResult = savedGameSchema.safeParse(dataToValidate);
      expect(parseResult.success).toBe(true);
    });

    it("jest deterministyczny (identyczna siatka hexGrid i placed przy dwoch uruchomieniach)", () => {
      fixture.apply(useGameStore);
      const run1 = {
        grid: useGameStore.getState().hexGrid.toJSON(),
        placed: useGameStore.getState().placed,
        resources: useGameStore.getState().resources,
      };

      useGameStore.getState().resetGame();

      fixture.apply(useGameStore);
      const run2 = {
        grid: useGameStore.getState().hexGrid.toJSON(),
        placed: useGameStore.getState().placed,
        resources: useGameStore.getState().resources,
      };

      expect(run1.grid).toEqual(run2.grid);
      expect(run1.placed).toEqual(run2.placed);
      expect(run1.resources).toEqual(run2.resources);
    });

    it("zostawia zywa kolonie (alive === true)", () => {
      fixture.apply(useGameStore);
      const state = useGameStore.getState();
      expect(state.alive).toBe(true);
      expect(state.colonyName.length).toBeGreaterThan(0);
    });

    it("ma osiagalny budynek (canAfford + dependsOn + requiredTech spelnione)", () => {
      fixture.apply(useGameStore);
      const state = useGameStore.getState();

      const hasReachable = BuildingService.hasReachableBuilding(
        BUILDING_DEFINITIONS,
        state.placed,
        state.resources,
        state.unlockedTechs
      );

      expect(hasReachable).toBe(true);
    });
  });

  const STABLE_FIXTURES = STATE_FIXTURES.filter((f) =>
    ["early-eco", "mid-game", "late-game"].includes(f.id)
  );

  describe.each(STABLE_FIXTURES)("Stabilnosc ekonomiczna (300 tikow): $id ($label)", (fixture) => {
    it("po 300 tikach alive === true i zaden zasob utrzymania nie spada do zera", () => {
      fixture.apply(useGameStore);

      for (let i = 0; i < 300; i++) {
        useGameStore.getState().applyEconomyTick();
      }

      const state = useGameStore.getState();
      expect(state.alive).toBe(true);
      expect(state.resources.o2).toBeGreaterThan(0);
      expect(state.resources.power).toBeGreaterThan(0);
      expect(state.resources.water).toBeGreaterThan(0);
      expect(state.resources.biomass).toBeGreaterThan(0);
      expect(state.resources.minerals).toBeGreaterThan(0);
    });
  });
});

