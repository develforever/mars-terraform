import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "../useGameStore";
import type { MapExportJSON } from "../../../domain/mapEditorTypes";

const sampleMapData: MapExportJSON = {
  meta: {
    name: "Custom Olympus Mons",
    description: "Volcanic research site",
    version: "2.0",
    gridType: "hex-flat-top",
    hexSize: 1,
    hexRadius: 15,
    players: 4,
    seed: 99,
  },
  hexes: [
    { q: 0, r: 0, terrainType: "rocky", userType: "build", decor: null },
    { q: 1, r: 0, terrainType: "peak", userType: "resource", decor: null },
  ],
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],
};

describe("useGameStore — custom map selection & game lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useGameStore.getState().resetGame();
  });

  it("initializes procedural hexGrid when mapData is not provided to startNewGame", () => {
    useGameStore.getState().startNewGame("New Colony", "normal", "exploration");

    const state = useGameStore.getState();
    expect(state.colonyName).toBe("New Colony");
    expect(state.currentMapData).toBeNull();
    expect(state.hexGrid).toBeDefined();
    expect(state.hexGrid.getCellCount()).toBeGreaterThan(0);
  });

  it("initializes custom hexGrid when valid mapData is passed to startNewGame", () => {
    useGameStore.getState().startNewGame("Custom Colony", "hard", "survival", sampleMapData);

    const state = useGameStore.getState();
    expect(state.colonyName).toBe("Custom Colony");
    expect(state.currentMapData).toEqual(sampleMapData);
    expect(state.hexGrid.radius).toBe(15);
    expect(state.hexGrid.seed).toBe(99);

    const cell00 = state.hexGrid.getCell(0, 0);
    expect(cell00).toBeDefined();
    expect(cell00?.terrainType).toBe("rocky");
    expect(cell00?.userType).toBe("build");
  });

  it("persists currentMapData in saveGame payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as Response);

    useGameStore.getState().startNewGame("Cloud Colony", "easy", "adventure", sampleMapData);
    const saveResult = await useGameStore.getState().saveGame();

    expect(saveResult).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/colony",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"currentMapData"'),
      })
    );

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.state.currentMapData).toEqual(sampleMapData);
  });

  it("restores custom mapData and rebuilds hexGrid on loadGame", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "Loaded Colony",
        state: {
          colonyName: "Loaded Colony",
          resources: { o2: 100, power: 50, water: 50, biomass: 10 },
          capacity: { power: 100, water: 100, biomass: 100 },
          placed: [],
          occupied: {},
          currentMapData: sampleMapData,
        },
      }),
    } as Response);

    const loadResult = await useGameStore.getState().loadGame("Loaded Colony");

    expect(loadResult).toBe(true);
    const state = useGameStore.getState();
    expect(state.colonyName).toBe("Loaded Colony");
    expect(state.currentMapData).toEqual(sampleMapData);
    expect(state.hexGrid.radius).toBe(15);
    expect(state.hexGrid.getCell(1, 0)?.terrainType).toBe("peak");
  });
});
