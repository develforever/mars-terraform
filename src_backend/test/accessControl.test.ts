import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";

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
    backendUrl: "http://localhost:3000",
    emailStrategy: "console",
    smtpFrom: "noreply@mars-terraform.local",
    corsOrigins: [],
  },
}));

vi.mock("../service/userService", () => ({
  userService: {
    getById: vi.fn(),
    update: vi.fn(),
    deleteAccount: vi.fn(),
    exportData: vi.fn(),
    getGroups: vi.fn(),
  },
}));

vi.mock("../service/groupService", () => ({
  ADMIN_GROUP_NAME: "admin",
  groupService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    getMembers: vi.fn(),
    addUser: vi.fn(),
    removeUser: vi.fn(),
    isMemberOf: vi.fn(),
  },
}));

import { createApp } from "../app";
import { userService } from "../service/userService";
import { groupService } from "../service/groupService";

/**
 * T11: kontrola dostępu `/api/users` i `/api/groups` przez prawdziwe trasy TSOA (`routes.ts`).
 * Wcześniej każdy zalogowany widział listę użytkowników z e-mailami, mógł usunąć dowolne konto
 * i zarządzać członkami dowolnej grupy (IDOR).
 */

const SELF_ID = 7;
const OTHER_ID = 9;

let server: Server | null = null;

const start = async (): Promise<string> => {
  const app = createApp({
    corsOrigins: [],
    distPath: "/nonexistent",
    serveFrontend: false,
    checkDatabase: async (): Promise<void> => {},
    version: "test",
    isProduction: true,
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
};

const bearer = (userId: number = SELF_ID): string =>
  jwt.sign({ userId, email: `u${userId}@mars.test` }, "test-secret", { expiresIn: "1h" });

const call = (
  baseUrl: string,
  method: string,
  path: string,
  options: { body?: unknown; token?: string | null } = {},
): Promise<Response> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = options.token === undefined ? bearer() : options.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
};

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const profile = {
  id: SELF_ID,
  name: "Nowa nazwa",
  email: "u7@mars.test",
  authProvider: "local",
  emailVerifiedAt: null,
  createdAt: null,
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  if (server) {
    const s = server;
    server = null;
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});

describe("/api/users (T11): tylko własne konto", () => {
  it("brak listy użytkowników: GET /api/users -> 404", async () => {
    const baseUrl = await start();
    const res = await call(baseUrl, "GET", "/api/users");
    expect(res.status).toBe(404);
  });

  it("brak dostępu po id: GET/PUT/DELETE /api/users/{id} -> 404, serwis nie jest wołany", async () => {
    const baseUrl = await start();
    expect((await call(baseUrl, "GET", `/api/users/${OTHER_ID}`)).status).toBe(404);
    expect((await call(baseUrl, "PUT", `/api/users/${OTHER_ID}`, { body: { name: "x" } })).status).toBe(404);
    expect((await call(baseUrl, "DELETE", `/api/users/${OTHER_ID}`)).status).toBe(404);
    expect(userService.deleteAccount).not.toHaveBeenCalled();
    expect(userService.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/users/me usuwa konto z tokenu", async () => {
    mocked(userService.deleteAccount).mockResolvedValue(true);
    const baseUrl = await start();
    const res = await call(baseUrl, "DELETE", "/api/users/me");
    expect(res.status).toBe(200);
    expect(userService.deleteAccount).toHaveBeenCalledTimes(1);
    expect(userService.deleteAccount).toHaveBeenCalledWith(SELF_ID);
  });

  it("DELETE /api/users/me bez tokenu -> 401", async () => {
    const baseUrl = await start();
    const res = await call(baseUrl, "DELETE", "/api/users/me", { token: null });
    expect(res.status).toBe(401);
    expect(userService.deleteAccount).not.toHaveBeenCalled();
  });

  it("DELETE /api/users/me dla usuniętego konta -> 404", async () => {
    mocked(userService.deleteAccount).mockResolvedValue(false);
    const baseUrl = await start();
    const res = await call(baseUrl, "DELETE", "/api/users/me");
    expect(res.status).toBe(404);
  });

  it("PUT /api/users/me aktualizuje konto z tokenu i zwraca tylko pola profilu", async () => {
    mocked(userService.update).mockResolvedValue({ ...profile, providerId: "secret-provider-id", deletedAt: null });
    mocked(userService.getById).mockResolvedValue(profile);
    const baseUrl = await start();
    const res = await call(baseUrl, "PUT", "/api/users/me", { body: { name: "Nowa nazwa" } });
    expect(res.status).toBe(200);
    expect(userService.update).toHaveBeenCalledWith(SELF_ID, { name: "Nowa nazwa" });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(SELF_ID);
    expect(body).not.toHaveProperty("providerId");
    expect(body).not.toHaveProperty("deletedAt");
  });

  it("PUT /api/users/me dla usuniętego konta -> 404", async () => {
    mocked(userService.update).mockResolvedValue(null);
    const baseUrl = await start();
    const res = await call(baseUrl, "PUT", "/api/users/me", { body: { name: "x" } });
    expect(res.status).toBe(404);
  });
});

describe("/api/users/me (T12): eksport, walidacja", () => {
  it("GET /api/users/me/export zwraca dane konta z tokenu jako plik do pobrania", async () => {
    mocked(userService.exportData).mockResolvedValue({ formatVersion: 1, profile: { id: SELF_ID } });
    const baseUrl = await start();
    const res = await call(baseUrl, "GET", "/api/users/me/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="mars-terraform-my-data.json"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(userService.exportData).toHaveBeenCalledWith(SELF_ID);
    expect(await res.json()).toEqual({ formatVersion: 1, profile: { id: SELF_ID } });
  });

  it("GET /api/users/me/export: 404 dla usuniętego konta, 401 bez tokenu", async () => {
    mocked(userService.exportData).mockResolvedValue(null);
    const baseUrl = await start();
    expect((await call(baseUrl, "GET", "/api/users/me/export")).status).toBe(404);
    expect((await call(baseUrl, "GET", "/api/users/me/export", { token: null })).status).toBe(401);
  });

  it("PUT /api/users/me odrzuca zmianę e-maila (400), bo wymagałaby ponownej weryfikacji", async () => {
    const baseUrl = await start();
    const res = await call(baseUrl, "PUT", "/api/users/me", { body: { name: "Ok", email: "new@mars.test" } });
    expect(res.status).toBe(400);
    expect(userService.update).not.toHaveBeenCalled();
  });

  it("PUT /api/users/me odrzuca pustą i za długą nazwę (400)", async () => {
    const baseUrl = await start();
    expect((await call(baseUrl, "PUT", "/api/users/me", { body: { name: "   " } })).status).toBe(400);
    expect((await call(baseUrl, "PUT", "/api/users/me", { body: { name: "x".repeat(101) } })).status).toBe(400);
    expect((await call(baseUrl, "PUT", "/api/users/me", { body: {} })).status).toBe(400);
    expect(userService.update).not.toHaveBeenCalled();
  });

  it("PUT /api/users/me przycina spacje w nazwie", async () => {
    mocked(userService.update).mockResolvedValue({ id: SELF_ID });
    mocked(userService.getById).mockResolvedValue(profile);
    const baseUrl = await start();
    const res = await call(baseUrl, "PUT", "/api/users/me", { body: { name: "  Nowa nazwa  " } });
    expect(res.status).toBe(200);
    expect(userService.update).toHaveBeenCalledWith(SELF_ID, { name: "Nowa nazwa" });
  });
});

describe("/api/groups (T11): zarządzanie tylko dla admina", () => {
  it("GET /api/groups: każdy zalogowany", async () => {
    mocked(groupService.list).mockResolvedValue([]);
    const baseUrl = await start();
    const res = await call(baseUrl, "GET", "/api/groups");
    expect(res.status).toBe(200);
    expect(groupService.isMemberOf).not.toHaveBeenCalled();
  });

  it("nie-admin: POST /api/groups, POST members, DELETE members -> 403 bez zmian w bazie", async () => {
    mocked(groupService.isMemberOf).mockResolvedValue(false);
    const baseUrl = await start();
    expect((await call(baseUrl, "POST", "/api/groups", { body: { name: "admin" } })).status).toBe(403);
    expect((await call(baseUrl, "POST", "/api/groups/1/members", { body: { userId: SELF_ID } })).status).toBe(403);
    expect((await call(baseUrl, "DELETE", `/api/groups/1/members/${OTHER_ID}`)).status).toBe(403);
    expect(groupService.create).not.toHaveBeenCalled();
    expect(groupService.addUser).not.toHaveBeenCalled();
    expect(groupService.removeUser).not.toHaveBeenCalled();
    expect(groupService.isMemberOf).toHaveBeenCalledWith(SELF_ID, "admin");
  });

  it("admin: dodaje i usuwa członków", async () => {
    mocked(groupService.isMemberOf).mockResolvedValue(true);
    const baseUrl = await start();
    expect((await call(baseUrl, "POST", "/api/groups/1/members", { body: { userId: OTHER_ID } })).status).toBe(200);
    expect(groupService.addUser).toHaveBeenCalledWith(OTHER_ID, 1);
    expect((await call(baseUrl, "DELETE", `/api/groups/1/members/${OTHER_ID}`)).status).toBe(200);
    expect(groupService.removeUser).toHaveBeenCalledWith(OTHER_ID, 1);
  });

  it("bez tokenu -> 401", async () => {
    const baseUrl = await start();
    const res = await call(baseUrl, "POST", "/api/groups/1/members", { body: { userId: SELF_ID }, token: null });
    expect(res.status).toBe(401);
    expect(groupService.isMemberOf).not.toHaveBeenCalled();
  });
});
