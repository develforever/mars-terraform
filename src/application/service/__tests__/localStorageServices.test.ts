import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageStore, setBrowserStoreForTests } from "../browserStore";
import { colonySaveService, SAVE_FILE_FORMAT } from "../colonySaveService";
import { mapLibraryService } from "../mapLibraryService";
import { LocalSaveService, type SavedGame } from "../localSaveService";

const makeSave = (name: string, timestamp: number, sol = 3): SavedGame => ({
  ...LocalSaveService.buildSavedGame({ colonyName: name, sol }),
  timestamp,
});

beforeEach(() => {
  localStorage.clear();
  setBrowserStoreForTests(createLocalStorageStore(localStorage));
});

afterEach(() => {
  setBrowserStoreForTests(null);
});

describe("createLocalStorageStore", () => {
  it("zapisuje, czyta, listuje i usuwa w obrębie jednego magazynu", async () => {
    const store = createLocalStorageStore(localStorage);
    await store.put("maps", "1", { a: 1 });
    await store.put("colonies", "x", { b: 2 });

    expect(await store.get("maps", "1")).toEqual({ a: 1 });
    expect(await store.getAll("maps")).toEqual([{ a: 1 }]);
    await store.delete("maps", "1");
    expect(await store.get("maps", "1")).toBeUndefined();
    expect(await store.getAll("colonies")).toEqual([{ b: 2 }]);
  });
});

describe("colonySaveService (T14)", () => {
  it("zapisuje kolonię i listuje zapisy od najnowszego", async () => {
    await colonySaveService.save(makeSave("Ares", 1000, 5));
    await colonySaveService.save(makeSave("Deimos", 2000, 7));

    expect(await colonySaveService.list()).toEqual([
      { name: "Deimos", savedAt: 2000, sol: 7 },
      { name: "Ares", savedAt: 1000, sol: 5 },
    ]);
    expect((await colonySaveService.load("Ares"))?.colonyName).toBe("Ares");
  });

  it("ta sama nazwa nadpisuje zapis; delete usuwa", async () => {
    await colonySaveService.save(makeSave("Ares", 1000, 5));
    await colonySaveService.save(makeSave("Ares", 3000, 9));
    expect(await colonySaveService.list()).toEqual([{ name: "Ares", savedAt: 3000, sol: 9 }]);

    await colonySaveService.delete("Ares");
    expect(await colonySaveService.list()).toEqual([]);
    expect(await colonySaveService.load("Ares")).toBeNull();
  });

  it("pomija uszkodzone wpisy", async () => {
    localStorage.setItem("mars-terraform:store:colonies:zle", JSON.stringify({ colonyName: "" }));
    await colonySaveService.save(makeSave("Ok", 1000));
    expect((await colonySaveService.list()).map((s) => s.name)).toEqual(["Ok"]);
    expect(await colonySaveService.load("zle")).toBeNull();
  });

  it("plik zapisu: round-trip i odrzucanie złych plików", () => {
    const save = makeSave("Tharsis", 1234);
    const file = colonySaveService.toFile(save);
    expect(JSON.parse(file).format).toBe(SAVE_FILE_FORMAT);
    expect(colonySaveService.fromFile(file)).toEqual(save);

    expect(() => colonySaveService.fromFile("nie json")).toThrow("Not a JSON file");
    expect(() => colonySaveService.fromFile(JSON.stringify({ format: "inny", version: 1, save }))).toThrow("Not a Mars Terraform save file");
    expect(() => colonySaveService.fromFile(JSON.stringify({ format: SAVE_FILE_FORMAT, version: 1, save: { colonyName: "" } }))).toThrow();
  });
});

describe("mapLibraryService (T14)", () => {
  it("zapisuje nową mapę, zwraca ją z id i datami, a lista nie zawiera treści", async () => {
    const saved = await mapLibraryService.saveMap({ name: " Olympus ", data: "{\"x\":1}", players: 3 });

    expect(saved).toMatchObject({ name: "Olympus", players: 3, version: "2.0", description: null, data: "{\"x\":1}" });
    const list = await mapLibraryService.listMaps();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("data");
    expect((await mapLibraryService.getMap(saved.id)).data).toBe("{\"x\":1}");
  });

  it("nadpisuje mapę po id, zachowując createdAt", async () => {
    const first = await mapLibraryService.saveMap({ name: "A", data: "{}" });
    const updated = await mapLibraryService.saveMap({ id: first.id, name: "B", data: "{\"v\":2}" });

    expect(updated.id).toBe(first.id);
    expect(updated.createdAt).toBe(first.createdAt);
    expect(await mapLibraryService.listMaps()).toHaveLength(1);
    expect((await mapLibraryService.getMap(first.id)).name).toBe("B");
  });

  it("przyjmuje MapExportJSON i nadaje unikalne id", async () => {
    const exportJson = { meta: { name: "Hellas", description: "d", players: 2, version: "2.0" } } as unknown as Parameters<typeof mapLibraryService.saveMap>[0];
    const a = await mapLibraryService.saveMap(exportJson);
    const b = await mapLibraryService.saveMap(exportJson);
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe("Hellas");
  });

  it("błędy: brak nazwy, nieistniejące id; delete usuwa", async () => {
    await expect(mapLibraryService.saveMap({ name: "  ", data: "{}" })).rejects.toThrow("Map name is required");
    await expect(mapLibraryService.saveMap({ id: 42, name: "X", data: "{}" })).rejects.toThrow("Map not found");
    await expect(mapLibraryService.getMap(42)).rejects.toThrow("Map not found");

    const m = await mapLibraryService.saveMap({ name: "Del", data: "{}" });
    await mapLibraryService.deleteMap(m.id);
    expect(await mapLibraryService.listMaps()).toEqual([]);
  });
});
