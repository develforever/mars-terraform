import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { groupService } from "../service/groupService";
import { db } from "../data-source";

describe("groupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a group and return it", async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        { id: 1, name: "admins", description: "Admin group", createdAt: null },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(mockInsert);

      const result = await groupService.create("admins", "Admin group");
      expect(result.name).toBe("admins");
    });
  });

  describe("getById", () => {
    it("should return null for non-existent group", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await groupService.getById(999);
      expect(result).toBeNull();
    });
  });
});
