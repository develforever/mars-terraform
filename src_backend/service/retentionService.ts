import { and, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "../data-source";
import { usersTable } from "../db/schema";
import { userService } from "./userService";

/**
 * Retencja danych (T12/T13, RODO art. 5 ust. 1 lit. e): konta nieużywane dłużej niż
 * INACTIVE_ACCOUNT_RETENTION_DAYS są usuwane trwale razem z koloniami i mapami.
 * Aktywność = ostatnie logowanie (`last_login_at`), a gdy go brak: data utworzenia.
 */
export const INACTIVE_ACCOUNT_RETENTION_DAYS = 730;
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  deletedAccounts: number;
}

export const purgeExpiredData = async (now: Date = new Date()): Promise<RetentionResult> => {
  const cutoff = new Date(now.getTime() - INACTIVE_ACCOUNT_RETENTION_DAYS * DAY_MS);
  const inactive = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      or(
        and(isNotNull(usersTable.lastLoginAt), lt(usersTable.lastLoginAt, cutoff)),
        and(isNull(usersTable.lastLoginAt), lt(usersTable.createdAt, cutoff)),
      ),
    );

  let deletedAccounts = 0;
  for (const { id } of inactive) {
    if (await userService.deleteAccount(id)) deletedAccounts += 1;
  }
  return { deletedAccounts };
};

/**
 * Uruchamia retencję przy starcie i potem co `intervalMs`. Błąd jest logowany i nie zatrzymuje API.
 * Timer ma `unref()`, więc nie blokuje zamknięcia procesu.
 */
export const scheduleRetention = (
  intervalMs: number = RETENTION_INTERVAL_MS,
  run: () => Promise<RetentionResult> = () => purgeExpiredData(),
): NodeJS.Timeout => {
  const tick = async (): Promise<void> => {
    try {
      const result = await run();
      if (result.deletedAccounts > 0) {
        console.log(`[retention] removed ${result.deletedAccounts} inactive accounts`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[retention] failed: ${message}`);
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return timer;
};
