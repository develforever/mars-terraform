import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeDatabaseUrl, redactSecrets, runMigrations } from "./db/migrate";

/**
 * Entrypoint migracji produkcyjnych (Faza 8, T7): `node dist_backend/migrate.js`
 * (`npm run db:migrate:prod`, Fly `release_command`). Dev: `tsx src_backend/migrate.ts`.
 *
 * Folder migracji względem pliku: `dist_backend/../drizzle` w obrazie, `src_backend/../drizzle` w dev.
 * Konfiguracja przez `config.ts` (wymaga `jwt_secret`, tak jak API; sekrety na Fly są wspólne
 * dla maszyny release i aplikacji). Import dynamiczny: brak zmiennej = czytelny błąd i exit 1.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../drizzle");

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  let authToken: string | undefined;
  try {
    const { config } = await import("./config");
    authToken = config.tursoToken;
    console.log(
      `[migrate] Start: ${describeDatabaseUrl(config.tursoUrl)}, migrations: ${MIGRATIONS_FOLDER}`,
    );
    if (config.isProduction && config.tursoUrl.startsWith("file:")) {
      console.warn("[migrate] Warning: NODE_ENV=production with a local file database (turso_url not set?)");
    }
    const { applied, total } = await runMigrations({
      url: config.tursoUrl,
      authToken: config.tursoToken,
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    const elapsed = Date.now() - startedAt;
    if (applied === 0) {
      console.log(`[migrate] No new migrations (applied total: ${total}) in ${elapsed} ms`);
    } else {
      console.log(`[migrate] Applied ${applied} migration(s) (applied total: ${total}) in ${elapsed} ms`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? ` (cause: ${error.cause.message})` : "";
    console.error(`[migrate] Failed after ${Date.now() - startedAt} ms: ${redactSecrets(message + cause, [authToken])}`);
    process.exitCode = 1;
  }
};

void main();
