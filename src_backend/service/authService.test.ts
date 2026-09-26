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

vi.mock("bcrypt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bcrypt")>();
  return { ...actual, compare: vi.fn(actual.compare) };
});

vi.mock("./emailService", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

import * as bcrypt from "bcrypt";
import { authService } from "../service/authService";
import { HttpError } from "../errors/HttpError";
import { db } from "../data-source";
import { emailService } from "./emailService";

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
    it("should throw 403 if the password is correct but email is not verified", async () => {
      const passwordHash = await bcrypt.hash("pass", 4);
      const mockSelect = vi.fn();
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, email: "test@test.com", emailVerifiedAt: null }]),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 10, userId: 1, provider: "local", passwordHash }]),
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
    it("should silently return without sending if user not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.resendVerification("no@user.com")).resolves.toBeUndefined();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it("should silently return without sending if email already verified", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, email: "test@test.com", emailVerifiedAt: new Date() }]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

      await expect(authService.resendVerification("test@test.com")).resolves.toBeUndefined();
      expect(emailService.send).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
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

  describe("account enumeration (T3c)", () => {
    const UNVERIFIED_USER = { id: 2, email: "new@test.com", emailVerifiedAt: null };

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

    const mockWrites = (): void => {
      (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
    };

    it("loginLocal checks the password before email verification (unverified + wrong password → 401)", async () => {
      const passwordHash = await bcrypt.hash("correct", 4);
      mockSelectResults([UNVERIFIED_USER], [{ id: 20, userId: 2, provider: "local", passwordHash }]);

      await expect(authService.loginLocal("new@test.com", "wrong")).rejects.toMatchObject({
        name: "HttpError",
        status: 401,
        message: "Invalid credentials",
      });
    });

    it("loginLocal runs bcrypt.compare against a dummy hash for an unknown email", async () => {
      const compare = vi.mocked(bcrypt.compare);
      mockSelectResults([]);

      await expect(authService.loginLocal("no@user.com", "whatever")).rejects.toMatchObject({
        status: 401,
        message: "Invalid credentials",
      });
      expect(compare).toHaveBeenCalledTimes(1);
      const [password, hash] = compare.mock.calls[0];
      expect(password).toBe("whatever");
      expect(String(hash)).toMatch(/^\$2[aby]\$10\$/);
    });

    it("loginLocal runs bcrypt.compare for a user without a local auth method", async () => {
      const compare = vi.mocked(bcrypt.compare);
      mockSelectResults([UNVERIFIED_USER], []);

      await expect(authService.loginLocal("new@test.com", "whatever")).rejects.toMatchObject({
        status: 401,
        message: "Invalid credentials",
      });
      expect(compare).toHaveBeenCalledTimes(1);
    });

    it("resendVerification sends a new link to an unverified account", async () => {
      mockSelectResults([UNVERIFIED_USER]);
      mockWrites();

      await expect(authService.resendVerification("new@test.com")).resolves.toBeUndefined();
      expect(emailService.send).toHaveBeenCalledTimes(1);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "new@test.com", subject: "Verify Your Email" }),
      );
    });

    it("resendVerification logs a delivery failure instead of throwing", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        mockSelectResults([UNVERIFIED_USER]);
        mockWrites();
        const failure = new Error("SMTP connection refused");
        vi.mocked(emailService.send).mockRejectedValueOnce(failure);

        await expect(authService.resendVerification("new@test.com")).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalledWith("[auth] verification email failed:", failure);
      } finally {
        consoleError.mockRestore();
      }
    });

    it("requestPasswordReset logs a delivery failure instead of throwing", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        mockSelectResults([UNVERIFIED_USER]);
        mockWrites();
        const failure = new Error("SMTP connection refused");
        vi.mocked(emailService.send).mockRejectedValueOnce(failure);

        await expect(authService.requestPasswordReset("new@test.com")).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalledWith("[auth] password reset email failed:", failure);
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
