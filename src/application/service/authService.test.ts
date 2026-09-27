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

describe("authClient: konto (T12, RODO)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("exportMyData wysyła GET /api/users/me/export z tokenem i zwraca plik", async () => {
    authClient.setToken("t-123");
    const blob = new Blob(["{}"]);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, blob: async () => blob });

    await expect(authClient.exportMyData()).resolves.toBe(blob);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/users\/me\/export$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t-123");
  });

  it("exportMyData zgłasza błąd z odpowiedzi API", async () => {
    authClient.setToken("t-123");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "User not found" }) });
    await expect(authClient.exportMyData()).rejects.toThrow("User not found");
  });

  it("deleteAccount wysyła DELETE /api/users/me i usuwa lokalny token", async () => {
    authClient.setToken("t-123");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ message: "deleted" }) });

    await authClient.deleteAccount();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/users\/me$/);
    expect(init.method).toBe("DELETE");
    expect(authClient.isAuthenticated()).toBe(false);
  });

  it("deleteAccount przy błędzie zostawia token (użytkownik nadal zalogowany)", async () => {
    authClient.setToken("t-123");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    await expect(authClient.deleteAccount()).rejects.toThrow("boom");
    expect(authClient.isAuthenticated()).toBe(true);
  });
});
