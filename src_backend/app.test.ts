import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { Express } from "express";
import { createApp, JSON_BODY_LIMIT_BYTES, type CreateAppOptions } from "./app";
import { HttpError } from "./errors/HttpError";

const ALLOWED = "https://mars-terraform.vercel.app";
const INDEX_HTML = "<!doctype html><title>spa</title>";
const VERSION = "9.9.9-test";
const SECRET_DETAIL = "internal-host:5432 password=hunter2";

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

  it("adds CORS headers to registered API routes, including their errors", async () => {
    const { baseUrl } = await start({
      corsOrigins: [ALLOWED],
      registerRoutes: (app: Express) => {
        app.get("/api/test/forbidden", () => {
          throw new HttpError(403, "Forbidden");
        });
      },
    });

    const res = await fetch(`${baseUrl}/api/test/forbidden`, { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(403);
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
  it("returns 200 with the version and Cache-Control: no-store without any readiness check (T15)", async () => {
    const { baseUrl } = await start();

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("calls the optional readiness check", async () => {
    const checkReadiness = vi.fn(async (): Promise<void> => {});
    const { baseUrl } = await start({ checkReadiness });

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(checkReadiness).toHaveBeenCalledTimes(1);
  });

  it("returns 503 without error details when the readiness check fails", async () => {
    const { baseUrl } = await start({
      checkReadiness: async (): Promise<void> => {
        throw new Error(SECRET_DETAIL);
      },
    });

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: "degraded" });
    expect(text).not.toContain("hunter2");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 503 when the readiness check exceeds the timeout", async () => {
    const { baseUrl } = await start({
      readinessTimeoutMs: 50,
      checkReadiness: (): Promise<void> => new Promise<void>(() => {}),
    });

    const startedAt = Date.now();
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded" });
    expect(Date.now() - startedAt).toBeLessThan(1500);
  });
});

describe("error handler", () => {
  const withRoutes = (app: Express): void => {
    app.get("/api/test/boom", () => {
      throw new Error(SECRET_DETAIL);
    });
    app.get("/api/test/client-error", () => {
      throw new HttpError(409, "Conflict detail");
    });
    app.post("/api/test/echo", (req, res) => {
      res.json(req.body);
    });
  };

  it("hides 5xx details in production and logs the full error", async () => {
    const { baseUrl } = await start({ isProduction: true, registerRoutes: withRoutes });

    const res = await fetch(`${baseUrl}/api/test/boom`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
    expect(console.error).toHaveBeenCalledWith(
      "[app] unhandled error:",
      expect.objectContaining({ message: SECRET_DETAIL }),
    );
  });

  it("keeps the 5xx message outside production", async () => {
    const { baseUrl } = await start({ isProduction: false, registerRoutes: withRoutes });

    const res = await fetch(`${baseUrl}/api/test/boom`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: SECRET_DETAIL });
  });

  it.each([true, false])("keeps HttpError 4xx messages (isProduction=%s)", async (isProduction) => {
    const { baseUrl } = await start({ isProduction, registerRoutes: withRoutes });

    const res = await fetch(`${baseUrl}/api/test/client-error`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Conflict detail" });
  });

  it("keeps the JSON parse error message for 400 in production", async () => {
    const { baseUrl } = await start({ isProduction: true, registerRoutes: withRoutes });

    const res = await fetch(`${baseUrl}/api/test/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toBe("Internal Server Error");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("answers a body over the limit with 413 JSON", async () => {
    const { baseUrl } = await start({ isProduction: true, registerRoutes: withRoutes });

    const res = await fetch(`${baseUrl}/api/test/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: "a".repeat(JSON_BODY_LIMIT_BYTES) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload Too Large" });
  });
});
