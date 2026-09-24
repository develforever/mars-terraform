import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { MapService } from "../service/MapService";
import { MapController } from "../controller/MapController";
import { db } from "../data-source";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

describe("MapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveMap", () => {
    it("should insert a new map when id is not provided", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({ lastInsertRowid: 1 }),
      });
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(mockInsert);

      const mockSavedMap = {
        id: 1,
        userId: 1,
        name: "Olympus Mons Base",
        description: "Test map",
        players: 2,
        version: "2.0",
        data: '{"meta":{"name":"Olympus Mons Base"}}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSavedMap]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await MapService.saveMap(1, {
        name: "Olympus Mons Base",
        description: "Test map",
        players: 2,
        version: "2.0",
        data: '{"meta":{"name":"Olympus Mons Base"}}',
      });

      expect(result).toEqual(mockSavedMap);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should update an existing map when id is provided", async () => {
      const mockMap = {
        id: 5,
        userId: 1,
        name: "Updated Map",
        description: "Updated description",
        players: 4,
        version: "2.0",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock select existing map, then mock update, then mock select updated map
      const mockSelect = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockMap]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockMap]),
            }),
          }),
        });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      (db.update as ReturnType<typeof vi.fn>).mockImplementation(mockUpdate);

      const result = await MapService.saveMap(1, {
        id: 5,
        name: "Updated Map",
        description: "Updated description",
        players: 4,
        data: "{}",
      });

      expect(result).toEqual(mockMap);
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw an error when updating a non-existent or unauthorized map", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(
        MapService.saveMap(1, {
          id: 999,
          name: "Non-existent",
          data: "{}",
        }),
      ).rejects.toMatchObject({
        name: "HttpError",
        status: 404,
        message: "Map not found or unauthorized",
      });
    });
  });

  describe("getMap", () => {
    it("should return map detail if found for user", async () => {
      const mockMap = {
        id: 1,
        userId: 1,
        name: "Elysium Planitia",
        description: "Flat land",
        players: 2,
        version: "2.0",
        data: '{"meta":{}}',
        createdAt: null,
        updatedAt: null,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMap]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await MapService.getMap(1, 1);
      expect(result).toEqual(mockMap);
    });

    it("should return null if map is not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await MapService.getMap(1, 999);
      expect(result).toBeNull();
    });
  });

  describe("listMaps", () => {
    it("should return map summaries for user", async () => {
      const mockSummaries = [
        {
          id: 1,
          userId: 1,
          name: "Map 1",
          description: "Desc 1",
          players: 2,
          version: "2.0",
          createdAt: null,
          updatedAt: null,
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockSummaries),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await MapService.listMaps(1);
      expect(result).toEqual(mockSummaries);
    });
  });

  describe("deleteMap", () => {
    it("should return true when map is successfully deleted", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 10 }]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      (db.delete as ReturnType<typeof vi.fn>).mockImplementation(mockDelete);

      const result = await MapService.deleteMap(1, 10);
      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it("should return false when map to delete does not exist", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await MapService.deleteMap(1, 999);
      expect(result).toBe(false);
    });
  });
});

describe("MapController", () => {
  let controller: MapController;
  const mockReq = {
    user: { userId: 42, email: "user@mars.com" },
  } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    controller = new MapController();
    vi.clearAllMocks();
  });

  it("saveMap delegates to MapService.saveMap", async () => {
    const mockDetail = {
      id: 1,
      userId: 42,
      name: "New Map",
      description: null,
      players: 2,
      version: "2.0",
      data: "{}",
      createdAt: null,
      updatedAt: null,
    };
    vi.spyOn(MapService, "saveMap").mockResolvedValue(mockDetail);

    const res = await controller.saveMap(mockReq, { name: "New Map", data: "{}" });
    expect(res).toEqual(mockDetail);
    expect(MapService.saveMap).toHaveBeenCalledWith(42, { name: "New Map", data: "{}" });
  });

  it("listMaps delegates to MapService.listMaps", async () => {
    const mockList = [
      {
        id: 1,
        userId: 42,
        name: "New Map",
        description: null,
        players: 2,
        version: "2.0",
        createdAt: null,
        updatedAt: null,
      },
    ];
    vi.spyOn(MapService, "listMaps").mockResolvedValue(mockList);

    const res = await controller.listMaps(mockReq);
    expect(res).toEqual(mockList);
    expect(MapService.listMaps).toHaveBeenCalledWith(42);
  });

  it("getMap returns detail when map exists", async () => {
    const mockDetail = {
      id: 1,
      userId: 42,
      name: "New Map",
      description: null,
      players: 2,
      version: "2.0",
      data: "{}",
      createdAt: null,
      updatedAt: null,
    };
    vi.spyOn(MapService, "getMap").mockResolvedValue(mockDetail);

    const res = await controller.getMap(mockReq, 1);
    expect(res).toEqual(mockDetail);
  });

  it("getMap returns 404 when map is not found", async () => {
    vi.spyOn(MapService, "getMap").mockResolvedValue(null);

    const res = await controller.getMap(mockReq, 99);
    expect(res).toEqual({ message: "Map not found" });
    // Verify status set to 404 on controller
    expect(controller.getStatus()).toBe(404);
  });

  it("deleteMap returns success message when deleted", async () => {
    vi.spyOn(MapService, "deleteMap").mockResolvedValue(true);

    const res = await controller.deleteMap(mockReq, 1);
    expect(res).toEqual({ message: "Map deleted successfully" });
  });

  it("deleteMap returns 404 when map to delete is not found", async () => {
    vi.spyOn(MapService, "deleteMap").mockResolvedValue(false);

    const res = await controller.deleteMap(mockReq, 99);
    expect(res).toEqual({ message: "Map not found" });
    expect(controller.getStatus()).toBe(404);
  });
});
