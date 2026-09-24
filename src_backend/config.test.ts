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
