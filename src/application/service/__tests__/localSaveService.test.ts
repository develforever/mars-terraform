import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalSaveService, LOCAL_SAVE_STORAGE_KEY } from "../localSaveService";
import { useGameStore } from "../../store/useGameStore";
import { HexGrid } from "../../../presentation/generator/hex/HexGrid";

describe("LocalSaveService - Session Persistence & Autosave", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trip zapisu i odczytu zachowuje wszystkie kluczowe dane", () => {
    useGameStore.getState().startNewGame("PersistentColony", "normal", "exploration", null, 12345);
    const originalState = useGameStore.getState();

    const saved = LocalSaveService.saveLocal(originalState);
    expect(saved).toBe(true);

    const loaded = LocalSaveService.loadLocal();
    expect(loaded).not.toBeNull();
    expect(loaded?.colonyName).toBe("PersistentColony");
    expect(loaded?.mapSeed).toBe(12345);
    expect(loaded?.resources.minerals).toBe(originalState.resources.minerals);
    expect(loaded?.resources.o2).toBe(originalState.resources.o2);
    expect(loaded?.capacity.minerals).toBe(originalState.capacity.minerals);
    expect(loaded?.placed.length).toBe(originalState.placed.length);
    expect(loaded?.units?.length).toBe(originalState.units.length);
    expect(loaded?.weather?.cooldownTicks).toBe(originalState.weather.cooldownTicks);
  });

  it("identyczna siatka dla mapSeed po odtworzeniu stanu", () => {
    const seed = 98765;
    useGameStore.getState().startNewGame("SeedColony", "hard", "exploration", null, seed);
    const initialGrid = useGameStore.getState().hexGrid;
    const initialGridJSON = JSON.stringify(initialGrid.toJSON());

    LocalSaveService.saveLocal(useGameStore.getState());

    // Reset game to default seed (42)
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().mapSeed).toBe(42);

    // Resume local game
    const resumed = useGameStore.getState().resumeLocalGame();
    expect(resumed).toBe(true);

    const restoredState = useGameStore.getState();
    expect(restoredState.colonyName).toBe("SeedColony");
    expect(restoredState.mapSeed).toBe(seed);

    const restoredGridJSON = JSON.stringify(restoredState.hexGrid.toJSON());
    expect(restoredGridJSON).toBe(initialGridJSON);
  });

  it("odrzucenie uszkodzonego wpisu w localStorage i wyczyszczenie pamieci", () => {
    // Write invalid JSON
    localStorage.setItem(LOCAL_SAVE_STORAGE_KEY, "invalid-non-json-garbage");
    expect(LocalSaveService.loadLocal()).toBeNull();
    expect(localStorage.getItem(LOCAL_SAVE_STORAGE_KEY)).toBeNull();

    // Write valid JSON but violating schema (missing colonyName, invalid types)
    localStorage.setItem(
      LOCAL_SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        colonyName: "", // min length 1 required
        resources: { invalid: true },
      })
    );
    expect(LocalSaveService.loadLocal()).toBeNull();
    expect(localStorage.getItem(LOCAL_SAVE_STORAGE_KEY)).toBeNull();
  });

  it("brak rzucania wyjatkow przy bledach localStorage (quota exceeded)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    useGameStore.getState().startNewGame("QuotaColony", "normal", "exploration");
    const state = useGameStore.getState();

    expect(() => {
      const result = LocalSaveService.saveLocal(state);
      expect(result).toBe(false);
    }).not.toThrow();
  });
});

