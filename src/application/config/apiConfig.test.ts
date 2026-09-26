import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl, getApiBaseUrl } from "./apiConfig";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an empty base for an empty value", () => {
    expect(getApiBaseUrl("")).toBe("");
  });

  it("returns an empty base for a whitespace-only value", () => {
    expect(getApiBaseUrl("   ")).toBe("");
  });

  it("returns an empty base when VITE_API_URL is empty in the environment", () => {
    vi.stubEnv("VITE_API_URL", "");
    expect(getApiBaseUrl()).toBe("");
  });

  it("strips the trailing slash from an origin", () => {
    expect(getApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("keeps an origin without a trailing slash unchanged", () => {
    expect(getApiBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(getApiBaseUrl("  https://api.example.com/  ")).toBe("https://api.example.com");
  });

  it("keeps the pathname and strips its trailing slash", () => {
    expect(getApiBaseUrl("https://x.dev/base/")).toBe("https://x.dev/base");
  });

  it("keeps a non-default port and accepts http", () => {
    expect(getApiBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it("reads VITE_API_URL from the environment by default", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("throws for a value that is not a URL", () => {
    expect(() => getApiBaseUrl("not a url")).toThrow(/Invalid VITE_API_URL "not a url"/);
  });

  it("throws for a relative path", () => {
    expect(() => getApiBaseUrl("/backend")).toThrow(/Invalid VITE_API_URL "\/backend": expected an absolute URL/);
  });

  it("throws for a non-http protocol", () => {
    expect(() => getApiBaseUrl("ftp://api.example.com")).toThrow(/protocol must be http or https/);
  });

  it("throws for a URL with a query string", () => {
    expect(() => getApiBaseUrl("https://api.example.com/?v=1")).toThrow(/query string and hash are not allowed/);
  });

  it("throws for a URL with a hash", () => {
    expect(() => getApiBaseUrl("https://api.example.com/#api")).toThrow(/query string and hash are not allowed/);
  });
});

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a relative path when VITE_API_URL is empty", () => {
    vi.stubEnv("VITE_API_URL", "");
    expect(apiUrl("/api/maps")).toBe("/api/maps");
  });

  it("prefixes the path with the configured origin", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    expect(apiUrl("/api/maps/1")).toBe("https://api.example.com/api/maps/1");
  });

  it("prefixes the path with the configured base pathname", () => {
    vi.stubEnv("VITE_API_URL", "https://x.dev/base/");
    expect(apiUrl("/api/colony")).toBe("https://x.dev/base/api/colony");
  });

  it("throws when VITE_API_URL is invalid", () => {
    vi.stubEnv("VITE_API_URL", "javascript:alert(1)");
    expect(() => apiUrl("/api/maps")).toThrow(/protocol must be http or https/);
  });
});
