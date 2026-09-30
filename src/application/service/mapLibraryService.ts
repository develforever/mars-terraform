import type { MapExportJSON } from "../../domain/mapEditorTypes";
import { getBrowserStore } from "./browserStore";

/**
 * Biblioteka map w przeglądarce (T14: gra bez kont). Zastępuje zapis map na serwerze (`/api/maps`).
 * Interfejs jak dawny `mapApiService`, więc widoki zmieniają tylko import.
 */

export interface SaveMapDTO {
  id?: number;
  name: string;
  description?: string;
  players?: number;
  version?: string;
  data: string;
}

export interface MapSummaryResponse {
  id: number;
  name: string;
  description: string | null;
  players: number;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapDetailResponse extends MapSummaryResponse {
  data: string;
}

const STORE = "maps" as const;

const toDto = (mapDataOrDto: MapExportJSON | SaveMapDTO, mapId?: number): SaveMapDTO => {
  if ("meta" in mapDataOrDto && mapDataOrDto.meta) {
    return {
      id: mapId,
      name: mapDataOrDto.meta.name,
      description: mapDataOrDto.meta.description,
      players: mapDataOrDto.meta.players,
      version: mapDataOrDto.meta.version,
      data: JSON.stringify(mapDataOrDto),
    };
  }
  return mapDataOrDto as SaveMapDTO;
};

const nextId = (existing: MapDetailResponse[]): number =>
  Math.max(Date.now(), ...existing.map((m) => m.id + 1));

export const mapLibraryService = {
  /** Zapisuje nową mapę albo nadpisuje istniejącą (`id`). */
  saveMap: async (mapDataOrDto: MapExportJSON | SaveMapDTO, mapId?: number): Promise<MapDetailResponse> => {
    const dto = toDto(mapDataOrDto, mapId);
    const name = dto.name.trim();
    if (!name) throw new Error("Map name is required");
    const store = getBrowserStore();
    const now = new Date().toISOString();
    const previous = dto.id !== undefined ? await store.get<MapDetailResponse>(STORE, String(dto.id)) : undefined;
    if (dto.id !== undefined && !previous) throw new Error("Map not found");
    const id = previous?.id ?? nextId(await store.getAll<MapDetailResponse>(STORE));
    const map: MapDetailResponse = {
      id,
      name,
      description: dto.description ?? null,
      players: dto.players ?? 2,
      version: dto.version ?? "2.0",
      data: dto.data,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await store.put(STORE, String(id), map);
    return map;
  },

  /** Lista map od najnowszej (bez treści). */
  listMaps: async (): Promise<MapSummaryResponse[]> => {
    const all = await getBrowserStore().getAll<MapDetailResponse>(STORE);
    return all
      .map(({ data: _data, ...summary }) => {
        void _data;
        return summary;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
  },

  getMap: async (id: number): Promise<MapDetailResponse> => {
    const map = await getBrowserStore().get<MapDetailResponse>(STORE, String(id));
    if (!map) throw new Error("Map not found");
    return map;
  },

  deleteMap: async (id: number): Promise<{ message: string }> => {
    await getBrowserStore().delete(STORE, String(id));
    return { message: "Map deleted" };
  },
};
