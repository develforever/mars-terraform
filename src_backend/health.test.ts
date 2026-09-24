import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { readPackageVersion, UNKNOWN_VERSION, withTimeout } from "./health";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value and clears the timer", async () => {
    vi.useFakeTimers();

    await expect(withTimeout(Promise.resolve(42), 2000)).resolves.toBe(42);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates a rejection and clears the timer", async () => {
    vi.useFakeTimers();

    await expect(withTimeout(Promise.reject(new Error("db down")), 2000)).rejects.toThrow("db down");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects after the timeout when the promise never settles", async () => {
    vi.useFakeTimers();

    const pending = withTimeout(new Promise<never>(() => {}), 2000);
    const assertion = expect(pending).rejects.toThrow("Timed out after 2000 ms");
    await vi.advanceTimersByTimeAsync(1999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("readPackageVersion", () => {
  const dirs: string[] = [];

  const writePackage = (content: string): string => {
    const dir = mkdtempSync(path.join(tmpdir(), "mars-health-test-"));
    dirs.push(dir);
    const file = path.join(dir, "package.json");
    writeFileSync(file, content);
    return file;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads the version field", () => {
    expect(readPackageVersion(writePackage(JSON.stringify({ name: "x", version: "1.2.3" })))).toBe("1.2.3");
  });

  it.each([
    ["missing version", JSON.stringify({ name: "x" })],
    ["non-string version", JSON.stringify({ version: 3 })],
    ["empty version", JSON.stringify({ version: "  " })],
    ["invalid JSON", "{not json"],
    ["non-object JSON", "\"1.0.0\""],
  ])("falls back to unknown for %s", (_label, content) => {
    expect(readPackageVersion(writePackage(content))).toBe(UNKNOWN_VERSION);
  });

  it("falls back to unknown when the file does not exist", () => {
    expect(readPackageVersion(path.join(tmpdir(), "definitely-missing-dir", "package.json"))).toBe(UNKNOWN_VERSION);
  });
});
