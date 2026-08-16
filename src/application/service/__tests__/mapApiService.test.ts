import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapApiService } from "../mapApiService";
import { authClient } from "../authService";
import type { MapExportJSON } from "../../../domain/mapEditorTypes";

describe("mapApiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  const mockMapExport: MapExportJSON = {
    meta: {
      name: "Test Mars Map",
      description: "A test map description",
      version: "2.0",
      gridType: "hex-flat-top",
      hexSize: 1.0,
      hexRadius: 20,
      players: 2,
      seed: 42,
    },
    hexes: [],
    buildNodes: [],
    resourceNodes: [],
    spawnPoints: [],
    decor: [],
  };

  it("should send POST to /api/maps on saveMap with MapExportJSON", async () => {
    authClient.setToken("valid-token");

    const mockResponse = {
      id: 10,
      userId: 1,
      name: "Test Mars Map",
      description: "A test map description",
      players: 2,
      version: "2.0",
      data: JSON.stringify(mockMapExport),
      createdAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:00:00.000Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await mapApiService.saveMap(mockMapExport);

    expect(fetch).toHaveBeenCalledWith("/api/maps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({
        id: undefined,
        name: "Test Mars Map",
        description: "A test map description",
        players: 2,
        version: "2.0",
        data: JSON.stringify(mockMapExport),
      }),
    });
    expect(result).toEqual(mockResponse);
  });

  it("should send POST to /api/maps on saveMap with SaveMapDTO", async () => {
    authClient.setToken("valid-token");

    const dto = {
      id: 5,
      name: "Custom DTO Map",
      description: "Custom description",
      players: 4,
      version: "2.0",
      data: "{}",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...dto, userId: 1, createdAt: null, updatedAt: null }),
    });

    const result = await mapApiService.saveMap(dto);

    expect(fetch).toHaveBeenCalledWith("/api/maps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify(dto),
    });
    expect(result.id).toBe(5);
  });

  it("should send GET to /api/maps on listMaps", async () => {
    authClient.setToken("valid-token");

    const mockSummaries = [
      {
        id: 1,
        userId: 1,
        name: "Map 1",
        description: "Desc 1",
        players: 2,
        version: "2.0",
        createdAt: "2026-08-16T10:00:00.000Z",
        updatedAt: "2026-08-16T10:00:00.000Z",
      },
    ];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSummaries,
    });

    const result = await mapApiService.listMaps();

    expect(fetch).toHaveBeenCalledWith("/api/maps", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
    });
    expect(result).toEqual(mockSummaries);
  });

  it("should send GET to /api/maps/:id on getMap", async () => {
    authClient.setToken("valid-token");

    const mockDetail = {
      id: 1,
      userId: 1,
      name: "Map 1",
      description: "Desc 1",
      players: 2,
      version: "2.0",
      data: JSON.stringify(mockMapExport),
      createdAt: "2026-08-16T10:00:00.000Z",
      updatedAt: "2026-08-16T10:00:00.000Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetail,
    });

    const result = await mapApiService.getMap(1);

    expect(fetch).toHaveBeenCalledWith("/api/maps/1", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
    });
    expect(result).toEqual(mockDetail);
  });

  it("should send DELETE to /api/maps/:id on deleteMap", async () => {
    authClient.setToken("valid-token");

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Map deleted successfully" }),
    });

    const result = await mapApiService.deleteMap(1);

    expect(fetch).toHaveBeenCalledWith("/api/maps/1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
    });
    expect(result.message).toBe("Map deleted successfully");
  });

  it("should throw authorization error on 401 response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(mapApiService.listMaps()).rejects.toThrow("Brak autoryzacji");
  });

  it("should throw server error message on 500 response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal server error" }),
    });

    await expect(mapApiService.getMap(99)).rejects.toThrow("Internal server error");
  });
});
