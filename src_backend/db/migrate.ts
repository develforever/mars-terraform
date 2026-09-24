import { existsSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Produkcyjne migracje bazy (Faza 8, T7).
 *
 * Biblioteka BEZ efektów ubocznych przy imporcie (entrypoint: `src_backend/migrate.ts`).
 * Używa migratora z `drizzle-orm` (ten sam, którego używa `drizzle-kit migrate` dla dialektów
 * sqlite/turso), więc tabela `__drizzle_migrations` i journal (`meta/_journal.json`) są wspólne:
 * baza zmigrowana wcześniej przez `drizzle-kit migrate` nie dostanie tych samych migracji drugi raz.
 */

export interface MigrationOptions {
  url: string;
  authToken?: string;
  migrationsFolder: string;
}

export interface MigrationResult {
  /** Liczba migracji zastosowanych w tym wywołaniu (0 = brak nowych). */
  applied: number;
  /** Liczba migracji zapisanych w `__drizzle_migrations` po wywołaniu. */
  total: number;
}

/** Domyślna nazwa tabeli migratora drizzle-orm (i `drizzle-kit migrate`). */
export const MIGRATIONS_TABLE = "__drizzle_migrations";

const JOURNAL_PATH = path.join("meta", "_journal.json");

const countAppliedMigrations = async (client: Client): Promise<number> => {
  const table = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [MIGRATIONS_TABLE],
  });
  if (table.rows.length === 0) return 0;
  const result = await client.execute(`SELECT COUNT(*) AS count FROM \`${MIGRATIONS_TABLE}\``);
  return Number(result.rows[0]?.count ?? 0);
};

export const assertMigrationsFolder = (migrationsFolder: string): void => {
  if (!existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }
  if (!existsSync(path.join(migrationsFolder, JOURNAL_PATH))) {
    throw new Error(`Migrations journal not found: ${path.join(migrationsFolder, JOURNAL_PATH)}`);
  }
};

export const runMigrations = async (options: MigrationOptions): Promise<MigrationResult> => {
  assertMigrationsFolder(options.migrationsFolder);

  const client = createClient({
    url: options.url,
    ...(options.authToken ? { authToken: options.authToken } : {}),
  });
  try {
    const before = await countAppliedMigrations(client);
    await migrate(drizzle(client), { migrationsFolder: options.migrationsFolder });
    const total = await countAppliedMigrations(client);
    return { applied: total - before, total };
  } finally {
    client.close();
  }
};

/**
 * Opis celu migracji do logów BEZ sekretów: sam schemat + host (+ ścieżka dla `file:`),
 * bez query stringa (`?authToken=...`) i bez danych logowania w URL.
 */
export const describeDatabaseUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      return `file:${url.slice("file:".length).split("?")[0]}`;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "<invalid database url>";
  }
};

/** Usuwa z komunikatu błędu token i ewentualny parametr `authToken=` w URL. */
export const redactSecrets = (message: string, secrets: readonly (string | undefined)[]): string => {
  let redacted = message.replace(/authToken=[^&\s"']+/gi, "authToken=***");
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join("***");
  }
  return redacted;
};
