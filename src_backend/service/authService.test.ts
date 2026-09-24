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
    frontendUrl: "http://localhost:5173",
  },
}));

vi.mock("./emailService", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

import * as bcrypt from "bcrypt";
import { authService } from "../service/authService";
import { HttpError } from "../errors/HttpError";
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

      await expect(authService.loginLocal("no@user.com", "pass")).rejects.toMatchObject({ name: "HttpError", status: 401, message: "Invalid credentials" });
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
      ).rejects.toMatchObject({ name: "HttpError", status: 409, message: "User with this email already exists" });
    });
  });

  describe("loginLocal", () => {
    it("should throw if email is not verified", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, email: "test@test.com", emailVerifiedAt: null }]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.loginLocal("test@test.com", "pass")).rejects.toMatchObject({ name: "HttpError", status: 403, message: expect.stringContaining("Email not verified") });
    });
  });

  describe("requestPasswordReset", () => {
    it("should silently return if user not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.requestPasswordReset("no@user.com")).resolves.toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    it("should throw for invalid token", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.resetPassword("invalid-token", "newpass")).rejects.toMatchObject({ name: "HttpError", status: 400, message: "Invalid or expired reset token" });
    });
  });

  describe("verifyEmail", () => {
    it("should throw for invalid token", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.verifyEmail("invalid-token")).rejects.toMatchObject({ name: "HttpError", status: 400, message: "Invalid or expired verification token" });
    });
  });

  describe("resendVerification", () => {
    it("should throw if user not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.resendVerification("no@user.com")).rejects.toMatchObject({ name: "HttpError", status: 404, message: "User not found" });
    });

    it("should throw if email already verified", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, email: "test@test.com", emailVerifiedAt: new Date() }]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.resendVerification("test@test.com")).rejects.toMatchObject({ name: "HttpError", status: 409, message: "Email already verified" });
    });
  });

  describe("client error statuses", () => {
    const VERIFIED_USER = { id: 1, email: "test@test.com", emailVerifiedAt: new Date() };

    const mockSelectResults = (...results: unknown[][]): void => {
      const mockSelect = vi.fn();
      for (const rows of results) {
        mockSelect.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(rows),
          }),
        });
      }
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);
    };

    const INVALID_CREDENTIALS = { name: "HttpError", status: 401, message: "Invalid credentials" };

    it("loginLocal answers an unknown email and a wrong password with the same 401", async () => {
      const passwordHash = await bcrypt.hash("correct", 4);

      mockSelectResults([]);
      await expect(authService.loginLocal("no@user.com", "correct")).rejects.toMatchObject(
        INVALID_CREDENTIALS,
      );

      mockSelectResults([VERIFIED_USER], [{ id: 10, userId: 1, provider: "local", passwordHash }]);
      await expect(authService.loginLocal("test@test.com", "wrong")).rejects.toMatchObject(
        INVALID_CREDENTIALS,
      );
    });

    it("loginLocal answers a user without a local auth method with the same 401", async () => {
      mockSelectResults([VERIFIED_USER], []);

      await expect(authService.loginLocal("test@test.com", "pass")).rejects.toMatchObject(
        INVALID_CREDENTIALS,
      );
    });

    it("changePassword rejects an account without a local auth method with 400", async () => {
      mockSelectResults([]);

      await expect(authService.changePassword(1, "old", "new")).rejects.toMatchObject({
        name: "HttpError",
        status: 400,
        message: "No local auth method found",
      });
    });

    it("changePassword rejects a wrong current password with 403 (not 401, which means logged out)", async () => {
      const passwordHash = await bcrypt.hash("correct", 4);
      mockSelectResults([{ id: 10, userId: 1, provider: "local", passwordHash }]);

      await expect(authService.changePassword(1, "wrong", "new")).rejects.toMatchObject({
        name: "HttpError",
        status: 403,
        message: "Invalid current password",
      });
    });

    it("requestEmailVerification keeps a missing user as a server error (internal invariant)", async () => {
      mockSelectResults([]);

      const error: unknown = await authService.requestEmailVerification(1).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ message: "User not found" });
    });
  });
});
