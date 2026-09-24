import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  MIGRATIONS_TABLE,
  describeDatabaseUrl,
  redactSecrets,
  runMigrations,
} from "./migrate";

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

interface JournalEntry {
  tag: string;
  when: number;
}

/** Nazwy tabel wyliczone z obiektów `schema.ts` (nie wpisane na sztywno). */
const SCHEMA_TABLES: string[] = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .map((table) => getTableConfig(table).name)
  .sort();

const readJournal = (): JournalEntry[] => {
  const raw = readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8");
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
};

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

  it("po migracji istnieje KAŻDA tabela zdefiniowana w schema.ts (T7b)", async () => {
    // Sanity: lista z schema.ts nie jest pusta i obejmuje tabele dodane po 0000.
    expect(SCHEMA_TABLES.length).toBeGreaterThanOrEqual(8);
    expect(SCHEMA_TABLES).toEqual(expect.arrayContaining(["maps", "colonies"]));

    await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });

    const tables = await listTables(url);
    const missing = SCHEMA_TABLES.filter((name) => !tables.includes(name));
    expect(missing).toEqual([]);
  });

  it("drugie wywołanie jest idempotentne (brak nowych migracji)", async () => {
    const first = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
    const second = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });

    expect(second.applied).toBe(0);
    expect(second.total).toBe(first.total);
  });

  it("stosuje wszystkie migracje z journala (>= 2) i jest idempotentne (T7b)", async () => {
    const journal = readJournal();
    expect(journal.length).toBeGreaterThanOrEqual(2);

    const first = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
    expect(first.applied).toBe(journal.length);
    expect(first.total).toBe(journal.length);

    const second = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
    expect(second).toEqual({ applied: 0, total: journal.length });
  });

  it("__drizzle_migrations: hash = sha256 pliku .sql, created_at = `when` z journala (baseline D11)", async () => {
    const journal = readJournal();
    await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });

    const client = createClient({ url });
    try {
      const result = await client.execute(
        `SELECT hash, created_at FROM \`${MIGRATIONS_TABLE}\` ORDER BY created_at`,
      );
      const rows = result.rows.map((row) => ({
        hash: String(row.hash),
        createdAt: Number(row.created_at),
      }));
      const expected = journal.map((entry) => ({
        hash: createHash("sha256")
          .update(readFileSync(path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`)))
          .digest("hex"),
        createdAt: entry.when,
      }));
      expect(rows).toEqual(expected);
    } finally {
      client.close();
    }
  });

  describe("baseline bazy utworzonej przez `push` (D11, MIGRATIONS_BASELINE.md)", () => {
    const sha256OfMigration = (tag: string): string =>
      createHash("sha256").update(readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`))).digest("hex");

    /** Symuluje `push`: wykonuje SQL migracji bez wpisu w __drizzle_migrations. */
    const applySqlLikePush = async (tags: readonly string[]): Promise<void> => {
      const client = createClient({ url });
      try {
        for (const tag of tags) {
          const content = readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
          for (const stmt of content.split("--> statement-breakpoint")) {
            if (stmt.trim()) await client.execute(stmt);
          }
        }
      } finally {
        client.close();
      }
    };

    /** Dokładnie ten SQL, który runbook każe wykonać ręcznie. */
    const baseline = async (entries: readonly JournalEntry[]): Promise<void> => {
      const client = createClient({ url });
      try {
        await client.execute(
          `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
        );
        for (const entry of entries) {
          await client.execute({
            sql: `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES (?, ?)`,
            args: [sha256OfMigration(entry.tag), entry.when],
          });
        }
      } finally {
        client.close();
      }
    };

    it("baza ze wszystkimi tabelami + baseline wszystkich migracji -> brak nowych migracji", async () => {
      const journal = readJournal();
      await applySqlLikePush(journal.map((entry) => entry.tag));
      await baseline(journal);

      const result = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
      expect(result).toEqual({ applied: 0, total: journal.length });
    });

    it("baza tylko z tabelami 0000 + baseline 0000 -> migrator stosuje resztę i tworzy maps/colonies", async () => {
      const journal = readJournal();
      const [first] = journal;
      expect(first?.tag).toMatch(/^0000_/);
      if (!first) return;
      await applySqlLikePush([first.tag]);
      await baseline([first]);

      const result = await runMigrations({ url, migrationsFolder: MIGRATIONS_FOLDER });
      expect(result).toEqual({ applied: journal.length - 1, total: journal.length });
      const tables = await listTables(url);
      expect(SCHEMA_TABLES.filter((name) => !tables.includes(name))).toEqual([]);
    });
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
