import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadConfig = async (corsOrigins: string | undefined): Promise<{ corsOrigins: readonly string[] }> => {
  vi.stubEnv("jwt_secret", "test-secret");
  vi.stubEnv("cors_origins", corsOrigins);
  const mod = await import("./config");
  return mod.config;
};

describe("config.corsOrigins", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to an empty list when cors_origins is not set", async () => {
    const config = await loadConfig(undefined);
    expect(config.corsOrigins).toEqual([]);
  });

  it("parses a CSV list, trimming entries and skipping empty ones", async () => {
    const config = await loadConfig(
      " https://mars-terraform.vercel.app , ,https://mars.example.com:8443,, http://localhost:5173 ",
    );
    expect(config.corsOrigins).toEqual([
      "https://mars-terraform.vercel.app",
      "https://mars.example.com:8443",
      "http://localhost:5173",
    ]);
  });

  it.each([
    ["trailing slash", "https://mars.example.com/"],
    ["path", "https://mars.example.com/app"],
    ["wildcard", "*"],
    ["missing scheme", "mars.example.com"],
    ["default port spelled out", "https://mars.example.com:443"],
    ["uppercase host", "https://MARS.example.com"],
  ])("throws naming the key for an invalid entry (%s)", async (_label, entry) => {
    await expect(loadConfig(`https://ok.example.com,${entry}`)).rejects.toThrow(/cors_origins/);
  });
});

const loadServeFrontend = async (value: string | undefined): Promise<boolean> => {
  vi.stubEnv("jwt_secret", "test-secret");
  vi.stubEnv("serve_frontend", value);
  const mod = await import("./config");
  return mod.config.serveFrontend;
};

describe("config.serveFrontend", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
  ])("defaults to true when serve_frontend is %s", async (_label, value) => {
    expect(await loadServeFrontend(value)).toBe(true);
  });

  it.each(["true", "1", "yes", "TRUE", " Yes "])("parses %j as true", async (value) => {
    expect(await loadServeFrontend(value)).toBe(true);
  });

  it.each(["false", "0", "no", "FALSE", " No ", "\tfalse\n"])("parses %j as false", async (value) => {
    expect(await loadServeFrontend(value)).toBe(false);
  });

  it.each(["off", "2", "nope", "true,false", "y"])("throws naming the key for %j", async (value) => {
    await expect(loadServeFrontend(value)).rejects.toThrow(/serve_frontend/);
  });
});

describe("config.isProduction", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["production", true],
    ["development", false],
    ["test", false],
  ])("NODE_ENV=%s -> %s", async (nodeEnv, expected) => {
    vi.stubEnv("jwt_secret", "test-secret");
    vi.stubEnv("NODE_ENV", nodeEnv);
    const mod = await import("./config");
    expect(mod.config.isProduction).toBe(expected);
  });
});
