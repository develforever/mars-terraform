import { afterEach, describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_MAX_AGE_SECONDS,
  createCorsMiddleware,
} from "./corsMiddleware";

const ALLOWED = "https://app.example.com";
const OTHER_ALLOWED = "https://mars.example.org";
const FOREIGN = "https://evil.example.net";

interface TestServer {
  readonly baseUrl: string;
  readonly server: Server;
}

let current: TestServer | null = null;

const startServer = async (
  origins: readonly string[],
  before: readonly RequestHandler[] = [],
): Promise<TestServer> => {
  const app = express();
  for (const handler of before) {
    app.use(handler);
  }
  app.use(createCorsMiddleware(origins));
  app.get("/api/ping", (_req, res) => {
    res.json({ pong: true });
  });
  app.options("/api/ping", (_req, res) => {
    res.status(200).json({ reachedRoute: true });
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  current = { baseUrl: `http://127.0.0.1:${port}`, server };
  return current;
};

const preflightHeaders = (origin: string): Record<string, string> => ({
  Origin: origin,
  "Access-Control-Request-Method": "POST",
  "Access-Control-Request-Headers": "authorization, content-type",
});

afterEach(async () => {
  if (current) {
    const { server } = current;
    current = null;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

describe("createCorsMiddleware", () => {
  it("is a no-op when the allowlist is empty", async () => {
    const { baseUrl } = await startServer([]);

    const res = await fetch(`${baseUrl}/api/ping`, { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("vary")).toBeNull();

    const preflight = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: preflightHeaders(ALLOWED),
    });
    expect(preflight.status).toBe(200);
    expect(await preflight.json()).toEqual({ reachedRoute: true });
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("sets Allow-Origin and Vary for an allowed origin on a simple request", async () => {
    const { baseUrl } = await startServer([ALLOWED, OTHER_ALLOWED]);

    const res = await fetch(`${baseUrl}/api/ping`, { headers: { Origin: OTHER_ALLOWED } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(res.headers.get("access-control-allow-origin")).toBe(OTHER_ALLOWED);
    expect(res.headers.get("vary")).toBe("Origin");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
  });

  it("passes a disallowed origin through without CORS headers", async () => {
    const { baseUrl } = await startServer([ALLOWED]);

    const res = await fetch(`${baseUrl}/api/ping`, { headers: { Origin: FOREIGN } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
  });

  it("requires an exact origin match (no prefix, suffix, port or scheme variants)", async () => {
    const { baseUrl } = await startServer([ALLOWED]);
    const variants = [
      `${ALLOWED}/`,
      `${ALLOWED}:8443`,
      "http://app.example.com",
      "https://app.example.com.evil.net",
      "https://APP.example.com",
      "null",
    ];

    for (const origin of variants) {
      const res = await fetch(`${baseUrl}/api/ping`, { headers: { Origin: origin } });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("answers a preflight from an allowed origin with 204 and does not reach the route", async () => {
    const { baseUrl } = await startServer([ALLOWED]);

    const res = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: preflightHeaders(ALLOWED),
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("access-control-allow-methods")).toBe(CORS_ALLOWED_METHODS);
    expect(res.headers.get("access-control-allow-headers")).toBe(CORS_ALLOWED_HEADERS);
    expect(res.headers.get("access-control-max-age")).toBe(CORS_MAX_AGE_SECONDS);
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("rejects a preflight from a disallowed origin with 403 and no CORS headers", async () => {
    const { baseUrl } = await startServer([ALLOWED]);

    const res = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: preflightHeaders(FOREIGN),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
    expect(res.headers.get("access-control-allow-headers")).toBeNull();
    expect(res.headers.get("access-control-max-age")).toBeNull();
  });

  it("passes requests without an Origin header through unchanged", async () => {
    const { baseUrl } = await startServer([ALLOWED]);

    const res = await fetch(`${baseUrl}/api/ping`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("vary")).toBeNull();

    const options = await fetch(`${baseUrl}/api/ping`, {
      method: "OPTIONS",
      headers: { "Access-Control-Request-Method": "GET" },
    });
    expect(options.status).toBe(200);
    expect(await options.json()).toEqual({ reachedRoute: true });
  });

  it("appends Origin to an existing Vary header instead of overwriting it", async () => {
    const setVary: RequestHandler = (_req, res, next) => {
      res.setHeader("Vary", "Accept-Encoding");
      next();
    };
    const { baseUrl } = await startServer([ALLOWED], [setVary]);

    const res = await fetch(`${baseUrl}/api/ping`, { headers: { Origin: ALLOWED } });
    expect(res.headers.get("vary")).toBe("Accept-Encoding, Origin");
  });
});
