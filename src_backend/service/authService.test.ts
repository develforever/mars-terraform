import { describe, it, expect, vi, beforeEach } from "vitest";
import * as jwt from "jsonwebtoken";

vi.mock("../data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../config", () => ({
  config: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
  },
}));

import { authService } from "../service/authService";
import { db } from "../data-source";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyToken", () => {
    it("should verify a valid JWT token", () => {
      const token = jwt.sign({ userId: 1, email: "test@test.com" }, "test-secret", {
        expiresIn: "1h",
      });

      const payload = authService.verifyToken(token);
      expect(payload.userId).toBe(1);
      expect(payload.email).toBe("test@test.com");
    });

    it("should reject an invalid JWT token", () => {
      expect(() => authService.verifyToken("invalid-token")).toThrow();
    });

    it("should reject a token signed with wrong secret", () => {
      const token = jwt.sign({ userId: 1, email: "test@test.com" }, "wrong-secret", {
        expiresIn: "1h",
      });

      expect(() => authService.verifyToken(token)).toThrow();
    });
  });

  describe("loginLocal", () => {
    it("should throw for non-existent user", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.loginLocal("no@user.com", "pass")).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  describe("registerLocal", () => {
    it("should throw if email already exists", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, email: "exists@test.com" }]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(
        authService.registerLocal("exists@test.com", "pass", "name"),
      ).rejects.toThrow("User with this email already exists");
    });
  });
});
