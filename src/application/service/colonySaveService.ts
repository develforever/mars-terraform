import { z } from "zod";
import { getBrowserStore } from "./browserStore";
import { savedGameSchema, type SavedGame } from "./localSaveService";

/**
 * Zapisy kolonii w przeglądarce + plik zapisu (T14: gra bez kont). Zastępuje zapis na serwerze (`/api/colony`).
 * Klucz = nazwa kolonii (ten sam zapis nadpisuje poprzedni, jak dawniej na serwerze).
 */

const STORE = "colonies" as const;

/** Znacznik formatu pliku zapisu (do rozpoznania przy imporcie). */
export const SAVE_FILE_FORMAT = "mars-terraform-save";
export const SAVE_FILE_VERSION = 1;

const saveFileSchema = z.object({
  format: z.literal(SAVE_FILE_FORMAT),
  version: z.literal(SAVE_FILE_VERSION),
  save: savedGameSchema,
});

export interface ColonySaveSummary {
  name: string;
  savedAt: number;
  sol: number;
}

export const colonySaveService = {
  save: async (save: SavedGame): Promise<void> => {
    const validated = savedGameSchema.parse(save);
    await getBrowserStore().put(STORE, validated.colonyName, validated);
  },

  /** Zapis po nazwie; uszkodzony zapis (niezgodny ze schematem) zwraca `null`. */
  load: async (name: string): Promise<SavedGame | null> => {
    const raw = await getBrowserStore().get<unknown>(STORE, name);
    if (raw === undefined) return null;
    const parsed = savedGameSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },

  /** Lista zapisów od najnowszego. Uszkodzone wpisy są pomijane. */
  list: async (): Promise<ColonySaveSummary[]> => {
    const all = await getBrowserStore().getAll<unknown>(STORE);
    return all
      .map((raw) => savedGameSchema.safeParse(raw))
      .filter((r) => r.success)
      .map((r) => ({ name: r.data.colonyName, savedAt: r.data.timestamp, sol: r.data.sol }))
      .sort((a, b) => b.savedAt - a.savedAt);
  },

  delete: async (name: string): Promise<void> => {
    await getBrowserStore().delete(STORE, name);
  },

  /** Treść pliku zapisu (JSON) do pobrania jako kopia zapasowa albo przeniesienia na inne urządzenie. */
  toFile: (save: SavedGame): string =>
    JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, save }, null, 2),

  /** Odczyt pliku zapisu. Rzuca czytelny błąd dla złego pliku. */
  fromFile: (text: string): SavedGame => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Not a JSON file");
    }
    const parsed = saveFileSchema.safeParse(json);
    if (!parsed.success) throw new Error("Not a Mars Terraform save file");
    return parsed.data.save;
  },
};
