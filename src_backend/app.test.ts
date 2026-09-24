import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

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

const ALLOWED = "https://mars-terraform.vercel.app";
const INDEX_HTML = "<!doctype html><title>spa</title>";

interface Running {
  readonly baseUrl: string;
  readonly server: Server;
  readonly distPath: string;
}

let running: Running | null = null;

const start = async (options: Partial<CreateAppOptions> = {}): Promise<Running> => {
  const distPath = mkdtempSync(path.join(tmpdir(), "mars-app-test-"));
  writeFileSync(path.join(distPath, "index.html"), INDEX_HTML);

  const app = createApp({ corsOrigins: [], distPath, ...options });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  running = { baseUrl: `http://127.0.0.1:${port}`, server, distPath };
  return running;
};

afterEach(async () => {
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
    expect(await res.json()).toEqual({ status: "ok" });
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
    expect(await res.json()).toEqual({ status: "ok" });
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
});
