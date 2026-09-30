import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError, authClient, TOTP_REQUIRED_MESSAGE } from "./authService";

const fetchMock = () => fetch as ReturnType<typeof vi.fn>;
const lastCall = (): [string, RequestInit] => fetchMock().mock.calls.at(-1) as [string, RequestInit];

describe("authClient (T13: numer konta + TOTP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("przechowuje i czyści token w localStorage (bez cookies)", () => {
    authClient.setToken("test-token");
    expect(authClient.getToken()).toBe("test-token");
    expect(authClient.isAuthenticated()).toBe(true);
    authClient.logout();
    expect(authClient.getToken()).toBeNull();
    expect(document.cookie).toBe("");
  });

  it("register: POST bez ciała, zapisuje token i zwraca numer konta", async () => {
    fetchMock().mockResolvedValue({ ok: true, json: async () => ({ accountNumber: "7KQ2-M9XA-4TRE-01ZC-8HNP", token: "t-1" }) });

    const result = await authClient.register();
    const [url, init] = lastCall();
    expect(url).toMatch(/\/api\/auth\/register$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(result.accountNumber).toBe("7KQ2-M9XA-4TRE-01ZC-8HNP");
    expect(authClient.getToken()).toBe("t-1");
  });

  it("login: wysyła sam numer, a z kodem TOTP także kod", async () => {
    fetchMock().mockResolvedValue({ ok: true, json: async () => ({ token: "t-2" }) });

    await authClient.login("7KQ2-M9XA-4TRE-01ZC-8HNP");
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ accountNumber: "7KQ2-M9XA-4TRE-01ZC-8HNP" });
    await authClient.login("7KQ2-M9XA-4TRE-01ZC-8HNP", "123456");
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ accountNumber: "7KQ2-M9XA-4TRE-01ZC-8HNP", totpCode: "123456" });
    expect(authClient.getToken()).toBe("t-2");
  });

  it("login: brak kodu TOTP -> ApiError 401 z komunikatem TOTP_REQUIRED, bez tokenu", async () => {
    fetchMock().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: TOTP_REQUIRED_MESSAGE }) });

    const error = await authClient.login("7KQ2-M9XA-4TRE-01ZC-8HNP").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: TOTP_REQUIRED_MESSAGE });
    expect(authClient.isAuthenticated()).toBe(false);
  });

  it("totpSetup / totpEnable / totpDisable wołają właściwe endpointy z tokenem", async () => {
    authClient.setToken("t-3");
    fetchMock().mockResolvedValue({ ok: true, json: async () => ({ secret: "S", otpauthUri: "otpauth://x", message: "ok" }) });

    await authClient.totpSetup();
    expect(lastCall()[0]).toMatch(/\/api\/auth\/totp\/setup$/);
    expect((lastCall()[1].headers as Record<string, string>).Authorization).toBe("Bearer t-3");
    await authClient.totpEnable("111111");
    expect(lastCall()[0]).toMatch(/\/api\/auth\/totp\/enable$/);
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ code: "111111" });
    await authClient.totpDisable("222222");
    expect(lastCall()[0]).toMatch(/\/api\/auth\/totp\/disable$/);
  });

  it("updateNickname wysyła PUT /api/users/me z samym pseudonimem", async () => {
    authClient.setToken("t-4");
    fetchMock().mockResolvedValue({ ok: true, json: async () => ({ id: 1, nickname: "Ares" }) });

    await authClient.updateNickname("Ares");
    expect(lastCall()[0]).toMatch(/\/api\/users\/me$/);
    expect(lastCall()[1].method).toBe("PUT");
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ nickname: "Ares" });
  });

  it("exportMyData zwraca plik; błąd API jako ApiError", async () => {
    authClient.setToken("t-5");
    const blob = new Blob(["{}"]);
    fetchMock().mockResolvedValueOnce({ ok: true, blob: async () => blob });
    await expect(authClient.exportMyData()).resolves.toBe(blob);
    expect(lastCall()[0]).toMatch(/\/api\/users\/me\/export$/);

    fetchMock().mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "User not found" }) });
    await expect(authClient.exportMyData()).rejects.toMatchObject({ status: 404, message: "User not found" });
  });

  it("deleteAccount usuwa token tylko po sukcesie", async () => {
    authClient.setToken("t-6");
    fetchMock().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    await expect(authClient.deleteAccount()).rejects.toThrow("boom");
    expect(authClient.isAuthenticated()).toBe(true);

    fetchMock().mockResolvedValueOnce({ ok: true, json: async () => ({ message: "deleted" }) });
    await authClient.deleteAccount();
    expect(lastCall()[1].method).toBe("DELETE");
    expect(authClient.isAuthenticated()).toBe(false);
  });
});
