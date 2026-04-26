import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { userService } from "../service/userService";
import { db } from "../data-source";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getById", () => {
    it("should return null for non-existent user", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await userService.getById(999);
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("should return users without deleted", async () => {
      const mockWhere = vi.fn().mockResolvedValue([
        { id: 1, name: "Test", email: "t@t.com", authProvider: "local", createdAt: null },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      const result = await userService.list();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test");
    });
  });
});
