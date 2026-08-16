import { authClient } from "./authService";
import type { MapExportJSON } from "../../domain/mapEditorTypes";

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
  userId: number;
  name: string;
  description: string | null;
  players: number;
  version: string;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface MapDetailResponse extends MapSummaryResponse {
  data: string;
}

const API_BASE = "/api/maps";

const authHeaders = (): Record<string, string> => {
  const token = authClient.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 401) {
    throw new Error("Brak autoryzacji. Zaloguj się, aby kontynuować.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Błąd serwera" }));
    throw new Error(errorData.message || errorData.error || `HTTP error ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const mapApiService = {
  /**
   * Saves or updates a map in the cloud.
   * Can accept either a MapExportJSON object with an optional mapId,
   * or a SaveMapDTO object.
   */
  saveMap: async (
    mapDataOrDto: MapExportJSON | SaveMapDTO,
    mapId?: number
  ): Promise<MapDetailResponse> => {
    let dto: SaveMapDTO;

    if ("meta" in mapDataOrDto && mapDataOrDto.meta) {
      dto = {
        id: mapId,
        name: mapDataOrDto.meta.name,
        description: mapDataOrDto.meta.description,
        players: mapDataOrDto.meta.players,
        version: mapDataOrDto.meta.version,
        data: JSON.stringify(mapDataOrDto),
      };
    } else {
      dto = mapDataOrDto as SaveMapDTO;
    }

    const response = await fetch(API_BASE, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(dto),
    });

    return handleResponse<MapDetailResponse>(response);
  },

  /**
   * Lists all map summaries for the authenticated user.
   */
  listMaps: async (): Promise<MapSummaryResponse[]> => {
    const response = await fetch(API_BASE, {
      method: "GET",
      headers: authHeaders(),
    });

    return handleResponse<MapSummaryResponse[]>(response);
  },

  /**
   * Retrieves a specific map by ID for the authenticated user.
   */
  getMap: async (id: number): Promise<MapDetailResponse> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "GET",
      headers: authHeaders(),
    });

    return handleResponse<MapDetailResponse>(response);
  },

  /**
   * Deletes a map by ID for the authenticated user.
   */
  deleteMap: async (id: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    return handleResponse<{ message: string }>(response);
  },
};
