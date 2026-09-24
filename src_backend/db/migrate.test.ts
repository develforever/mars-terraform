import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MIGRATIONS_TABLE,
  describeDatabaseUrl,
  redactSecrets,
  runMigrations,
} from "./migrate";

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

const listTables = async (url: string): Promise<string[]> => {
  const client = createClient({ url });
  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return result.rows.map((row) => String(row.name));
  } finally {
    client.close();
  }
};

describe("runMigrations (T7)", () => {
  let dir: string;
  let url: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "mars-migrate-"));
    url = `file:${path.join(dir, "test.db")}`;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("tworzy tabele ze schema.ts i zapisuje migracje w __drizzle_migrations", async () => {
    const result = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });

    expect(result.applied).toBeGreaterThan(0);
    expect(result.total).toBe(result.applied);
    const tables = await listTables(url);
    expect(tables).toEqual(
      expect.arrayContaining([
        MIGRATIONS_TABLE,
        "users",
        "user_auth_methods",
        "groups",
        "user_groups",
        "password_resets",
        "email_verifications",
      ]),
    );
  });

  it("drugie wywołanie jest idempotentne (brak nowych migracji)", async () => {
    const first = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
    const second = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });

    expect(second.applied).toBe(0);
    expect(second.total).toBe(first.total);
  });

  it("brak folderu migracji -> czytelny błąd", async () => {
    const missing = path.join(dir, "no-such-folder");
    await expect(runMigrations({ url, migrationsFolder: missing })).rejects.toThrow(
      `Migrations folder not found: ${missing}`,
    );
  });

  it("folder bez meta/_journal.json -> czytelny błąd", async () => {
    await expect(runMigrations({ url, migrationsFolder: dir })).rejects.toThrow(
      /Migrations journal not found/,
    );
  });
});

describe("logowanie bez sekretów", () => {
  it("describeDatabaseUrl pokazuje tylko schemat i host (bez tokenu w query)", () => {
    expect(describeDatabaseUrl("libsql://db-org.turso.io?authToken=secret123")).toBe(
      "libsql://db-org.turso.io",
    );
    expect(describeDatabaseUrl("libsql://user:pass@db-org.turso.io")).toBe("libsql://db-org.turso.io");
    expect(describeDatabaseUrl("file:/tmp/t7.db")).toBe("file:/tmp/t7.db");
    expect(describeDatabaseUrl("not a url")).toBe("<invalid database url>");
  });

  it("redactSecrets usuwa token i parametr authToken", () => {
    const message = "failed to connect libsql://x.turso.io?authToken=abc.def with token tok-42";
    const redacted = redactSecrets(message, ["tok-42", undefined]);
    expect(redacted).not.toContain("abc.def");
    expect(redacted).not.toContain("tok-42");
    expect(redacted).toContain("authToken=***");
  });
});
