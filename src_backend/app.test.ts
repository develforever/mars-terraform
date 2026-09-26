import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

vi.mock("./data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("./config", () => ({
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

import { createApp, type CreateAppOptions } from "./app";
import { db } from "./data-source";
import { emailService } from "./service/emailService";

const ALLOWED = "https://mars-terraform.vercel.app";
const INDEX_HTML = "<!doctype html><title>spa</title>";
const VERSION = "9.9.9-test";
const SECRET_DETAIL = "libsql://secret-host.turso.io password=hunter2";

interface Running {
  readonly baseUrl: string;
  readonly server: Server;
  readonly distPath: string;
}

let running: Running | null = null;

const start = async (options: Partial<CreateAppOptions> = {}): Promise<Running> => {
  const distPath = mkdtempSync(path.join(tmpdir(), "mars-app-test-"));
  writeFileSync(path.join(distPath, "index.html"), INDEX_HTML);

  const app = createApp({
    corsOrigins: [],
    distPath,
    serveFrontend: true,
    checkDatabase: async (): Promise<void> => {},
    version: VERSION,
    isProduction: false,
    ...options,
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  running = { baseUrl: `http://127.0.0.1:${port}`, server, distPath };
  return running;
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (running) {
    const { server, distPath } = running;
    running = null;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(distPath, { recursive: true, force: true });
  }
});

describe("createApp", () => {
  it("serves /api/health without CORS headers when the allowlist is empty", async () => {
    const { baseUrl } = await start();

    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a CORS preflight on /api/health for an allowed origin", async () => {
    const { baseUrl } = await start({ corsOrigins: [ALLOWED] });

    const res = await fetch(`${baseUrl}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type");
  });

  it("adds CORS headers to GET /api/health for an allowed origin", async () => {
    const { baseUrl } = await start({ corsOrigins: [ALLOWED] });

    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("rejects a preflight from a disallowed origin before reaching the routes", async () => {
    const { baseUrl } = await start({ corsOrigins: [ALLOWED] });

    const res = await fetch(`${baseUrl}/api/maps`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.net", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds CORS headers to TSOA routes, including auth errors", async () => {
    const { baseUrl } = await start({ corsOrigins: [ALLOWED] });

    const res = await fetch(`${baseUrl}/api/maps`, { headers: { Origin: ALLOWED } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
  });

  it("keeps the static SPA fallback for non-API paths", async () => {
    const { baseUrl } = await start();

    const res = await fetch(`${baseUrl}/generate`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
  });

  it("answers unknown /api paths with a JSON 404 when serving the frontend", async () => {
    const { baseUrl } = await start();

    for (const [method, route] of [
      ["GET", "/api/nieistniejace"],
      ["POST", "/api/nieistniejace/deeper"],
      ["GET", "/api"],
    ] as const) {
      const res = await fetch(`${baseUrl}${route}`, { method });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(await res.json()).toEqual({ error: "Not Found" });
    }
  });
});

describe("createApp serveFrontend=false (API-only)", () => {
  it("does not serve static files or the SPA fallback", async () => {
    const { baseUrl } = await start({ serveFrontend: false });

    for (const route of ["/", "/generate", "/index.html", "/mars/deep/link"]) {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(await res.json()).toEqual({ error: "Not Found" });
    }
  });

  it("answers unknown /api paths with a JSON 404", async () => {
    const { baseUrl } = await start({ serveFrontend: false });

    const res = await fetch(`${baseUrl}/api/nieistniejace`, { method: "DELETE" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("still serves the API and CORS", async () => {
    const { baseUrl } = await start({ serveFrontend: false, corsOrigins: [ALLOWED] });

    const health = await fetch(`${baseUrl}/api/health`, { headers: { Origin: ALLOWED } });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", version: VERSION });
    expect(health.headers.get("access-control-allow-origin")).toBe(ALLOWED);

    const missing = await fetch(`${baseUrl}/generate`, { headers: { Origin: "https://evil.example.net" } });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBeNull();
    expect(missing.headers.get("vary")).toContain("Origin");
  });
});

describe("GET /api/health", () => {
  it("returns 200 with the version and Cache-Control: no-store when the database answers", async () => {
    const checkDatabase = vi.fn(async (): Promise<void> => {});
    const { baseUrl } = await start({ checkDatabase });

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });

  it("returns 503 without error details when the database check fails", async () => {
    const { baseUrl } = await start({
      checkDatabase: async (): Promise<void> => {
        throw new Error(SECRET_DETAIL);
      },
    });

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: "degraded", database: "unavailable" });
    expect(text).not.toContain("hunter2");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 503 when the database check exceeds the timeout", async () => {
    const { baseUrl } = await start({
      databaseCheckTimeoutMs: 50,
      checkDatabase: (): Promise<void> => new Promise<void>(() => {}),
    });

    const startedAt = Date.now();
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", database: "unavailable" });
    expect(Date.now() - startedAt).toBeLessThan(1500);
  });
});

describe("error handler", () => {
  const login = (baseUrl: string, body: unknown): Promise<Response> =>
    fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const failDatabase = (): void => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error(SECRET_DETAIL);
    });
  };

  it("hides 5xx details in production and logs the full error", async () => {
    failDatabase();
    const { baseUrl } = await start({ isProduction: true });

    const res = await login(baseUrl, { email: "a@b.c", password: "x" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
    expect(console.error).toHaveBeenCalledWith(
      "[app] unhandled error:",
      expect.objectContaining({ message: SECRET_DETAIL }),
    );
  });

  it("keeps the 5xx message outside production", async () => {
    failDatabase();
    const { baseUrl } = await start({ isProduction: false });

    const res = await login(baseUrl, { email: "a@b.c", password: "x" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: SECRET_DETAIL });
  });

  it.each([true, false])("keeps 401 auth messages (isProduction=%s)", async (isProduction) => {
    const { baseUrl } = await start({ isProduction });

    const res = await fetch(`${baseUrl}/api/maps`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it.each([true, false])("keeps TSOA validation fields for 400 (isProduction=%s)", async (isProduction) => {
    const { baseUrl } = await start({ isProduction });

    const res = await login(baseUrl, { email: 1 });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ error: expect.any(String), fields: expect.any(Object) });
    expect(JSON.stringify(body)).toContain("password");
  });

  it("keeps the JSON parse error message for 400 in production", async () => {
    const { baseUrl } = await start({ isProduction: true });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toBe("Internal Server Error");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

describe("client errors (HttpError) in production", () => {
  /** Kolejne wywołania `db.select()` zwracają podane wiersze (`where()` jest awaitable i ma `limit()`). */
  const selectReturning = (...results: unknown[][]): void => {
    for (const rows of results) {
      const where = vi.fn().mockReturnValue(
        Object.assign(Promise.resolve(rows), { limit: vi.fn().mockResolvedValue(rows) }),
      );
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where }),
      } as unknown as ReturnType<typeof db.select>);
    }
  };

  const post = (url: string, body: unknown, token?: string): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const bearer = (): string =>
    jwt.sign({ userId: 7, email: "u@mars.test" }, "test-secret", { expiresIn: "1h" });

  it("answers an unknown email and a wrong password with the same 401", async () => {
    const passwordHash = await bcrypt.hash("correct", 4);
    const { baseUrl } = await start({ isProduction: true });

    selectReturning([]);
    const unknown = await post(`${baseUrl}/api/auth/login`, { email: "no@mars.test", password: "correct" });

    selectReturning(
      [{ id: 7, email: "u@mars.test", emailVerifiedAt: new Date() }],
      [{ id: 1, userId: 7, provider: "local", passwordHash }],
    );
    const wrong = await post(`${baseUrl}/api/auth/login`, { email: "u@mars.test", password: "wrong" });

    for (const res of [unknown, wrong]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Invalid credentials" });
    }
    expect(console.error).not.toHaveBeenCalled();
  });

  it("answers an invalid reset token with 400 and its message", async () => {
    const { baseUrl } = await start({ isProduction: true });
    selectReturning([]);

    const res = await post(`${baseUrl}/api/auth/reset-password`, { token: "nope", newPassword: "secret123" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid or expired reset token" });
  });

  it("answers a missing user in a controller with 404 instead of 500", async () => {
    const { baseUrl } = await start({ isProduction: true });
    selectReturning([]);

    const res = await fetch(`${baseUrl}/api/users/999`, {
      headers: { Authorization: `Bearer ${bearer()}` },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "User not found" });
  });

  it("answers updating a map the user does not own with 404", async () => {
    const { baseUrl } = await start({ isProduction: true });
    selectReturning([]);

    const res = await post(`${baseUrl}/api/maps`, { id: 42, name: "Tharsis", data: "{}" }, bearer());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Map not found or unauthorized" });
  });

  it("answers an invalid bearer token with 401", async () => {
    const { baseUrl } = await start({ isProduction: true });

    const res = await fetch(`${baseUrl}/api/maps`, { headers: { Authorization: "Bearer garbage" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid or expired token" });
  });
});

describe("account enumeration (T3c) in production", () => {
  const RESEND_BODY = { message: "If the account exists and is unverified, a verification email has been sent." };
  const UNVERIFIED = { id: 8, email: "new@mars.test", emailVerifiedAt: null };
  const VERIFIED = { id: 7, email: "u@mars.test", emailVerifiedAt: new Date() };

  const selectReturning = (...results: unknown[][]): void => {
    for (const rows of results) {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }),
      } as unknown as ReturnType<typeof db.select>);
    }
  };

  const mockWrites = (): void => {
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.insert>);
  };

  const post = (url: string, body: unknown): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("checks the password before email verification on login", async () => {
    const passwordHash = await bcrypt.hash("correct", 4);
    const { baseUrl } = await start({ isProduction: true });

    selectReturning([UNVERIFIED], [{ id: 2, userId: 8, provider: "local", passwordHash }]);
    const wrong = await post(`${baseUrl}/api/auth/login`, { email: "new@mars.test", password: "wrong" });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "Invalid credentials" });

    selectReturning([UNVERIFIED], [{ id: 2, userId: 8, provider: "local", passwordHash }]);
    const correct = await post(`${baseUrl}/api/auth/login`, { email: "new@mars.test", password: "correct" });
    expect(correct.status).toBe(403);
    expect(await correct.json()).toEqual({
      error: "Email not verified. Please verify your email before logging in.",
    });
  });

  it("answers resend-verification identically for unknown, verified and unverified accounts", async () => {
    const send = vi.spyOn(emailService, "send");
    mockWrites();
    const { baseUrl } = await start({ isProduction: true });

    const responses: { status: number; body: string }[] = [];
    for (const rows of [[], [VERIFIED], [UNVERIFIED]]) {
      selectReturning(rows);
      const res = await post(`${baseUrl}/api/auth/resend-verification`, { email: "x@mars.test" });
      responses.push({ status: res.status, body: await res.text() });
    }

    for (const { status, body } of responses) {
      expect(status).toBe(200);
      expect(JSON.parse(body)).toEqual(RESEND_BODY);
    }
    expect(new Set(responses.map((r) => r.body)).size).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: UNVERIFIED.email }));
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps the same resend-verification success when email delivery fails, and logs it", async () => {
    const failure = new Error("SMTP connection refused");
    vi.spyOn(emailService, "send").mockRejectedValueOnce(failure);
    mockWrites();
    const { baseUrl } = await start({ isProduction: true });

    selectReturning([UNVERIFIED]);
    const res = await post(`${baseUrl}/api/auth/resend-verification`, { email: UNVERIFIED.email });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESEND_BODY);
    expect(console.error).toHaveBeenCalledWith("[auth] verification email failed:", failure);
  });

  it("keeps the same forgot-password success when email delivery fails, and logs it", async () => {
    const failure = new Error("SMTP connection refused");
    vi.spyOn(emailService, "send").mockRejectedValueOnce(failure);
    mockWrites();
    const { baseUrl } = await start({ isProduction: true });

    selectReturning([]);
    const unknown = await post(`${baseUrl}/api/auth/forgot-password`, { email: "no@mars.test" });
    selectReturning([VERIFIED]);
    const existing = await post(`${baseUrl}/api/auth/forgot-password`, { email: VERIFIED.email });

    for (const res of [unknown, existing]) {
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }
    expect(console.error).toHaveBeenCalledWith("[auth] password reset email failed:", failure);
  });
});
