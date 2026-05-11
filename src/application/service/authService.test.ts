import { describe, it, expect, vi, beforeEach } from "vitest";
import { authClient } from "./authService";

describe("authClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should store and retrieve token", () => {
    authClient.setToken("test-token");
    expect(authClient.getToken()).toBe("test-token");
    expect(authClient.isAuthenticated()).toBe(true);
  });

  it("should clear token on logout", () => {
    authClient.setToken("test-token");
    authClient.logout();
    expect(authClient.getToken()).toBeNull();
    expect(authClient.isAuthenticated()).toBe(false);
  });

  it("should send forgot password request", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Email sent" }),
    });

    const result = await authClient.forgotPassword({ email: "test@test.com" });
    expect(result.message).toBe("Email sent");
  });

  it("should send reset password request", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Password reset" }),
    });

    const result = await authClient.resetPassword({ token: "abc", newPassword: "pass" });
    expect(result.message).toBe("Password reset");
  });

  it("should send verify email request", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Verified" }),
    });

    const result = await authClient.verifyEmail({ token: "abc" });
    expect(result.message).toBe("Verified");
  });
});
