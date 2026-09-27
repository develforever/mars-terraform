import { and, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "../data-source";
import { emailVerificationsTable, passwordResetsTable, usersTable } from "../db/schema";
import { userService } from "./userService";

/**
 * Retencja danych (T12, RODO art. 5 ust. 1 lit. e): dane przechowujemy tylko tak długo, jak są potrzebne.
 * - wygasłe tokeny resetu hasła i weryfikacji e-mail: usuwane od razu,
 * - konta z niepotwierdzonym e-mailem starsze niż UNVERIFIED_ACCOUNT_RETENTION_DAYS: usuwane trwale,
 * - konta oznaczone jako usunięte (`deleted_at`, stary soft-delete sprzed T12): usuwane trwale.
 * Konta OAuth mają `email_verified_at` ustawione przy utworzeniu, więc nie podlegają regule niepotwierdzonych.
 */
export const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 30;
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  expiredPasswordResets: number;
  expiredEmailVerifications: number;
  deletedAccounts: number;
}

export const purgeExpiredData = async (now: Date = new Date()): Promise<RetentionResult> => {
  const resets = await db
    .delete(passwordResetsTable)
    .where(lt(passwordResetsTable.expiresAt, now))
    .returning({ id: passwordResetsTable.id });

  const verifications = await db
    .delete(emailVerificationsTable)
    .where(lt(emailVerificationsTable.expiresAt, now))
    .returning({ id: emailVerificationsTable.id });

  const unverifiedCutoff = new Date(now.getTime() - UNVERIFIED_ACCOUNT_RETENTION_DAYS * DAY_MS);
  const staleUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      or(
        and(isNull(usersTable.emailVerifiedAt), lt(usersTable.createdAt, unverifiedCutoff)),
        isNotNull(usersTable.deletedAt),
      ),
    );

  let deletedAccounts = 0;
  for (const { id } of staleUsers) {
    if (await userService.deleteAccount(id)) deletedAccounts += 1;
  }

  return {
    expiredPasswordResets: resets.length,
    expiredEmailVerifications: verifications.length,
    deletedAccounts,
  };
};

/**
 * Uruchamia retencję przy starcie i potem co `intervalMs`. Błąd jest logowany i nie zatrzymuje API.
 * Timer ma `unref()`, więc nie blokuje zamknięcia procesu. Na darmowym planie Render instancja usypia,
 * ale każdy start (po uśpieniu) i tak wykonuje przebieg.
 */
export const scheduleRetention = (
  intervalMs: number = RETENTION_INTERVAL_MS,
  run: () => Promise<RetentionResult> = () => purgeExpiredData(),
): NodeJS.Timeout => {
  const tick = async (): Promise<void> => {
    try {
      const result = await run();
      const total = result.expiredPasswordResets + result.expiredEmailVerifications + result.deletedAccounts;
      if (total > 0) {
        console.log(
          `[retention] removed: ${result.expiredPasswordResets} password resets, ` +
            `${result.expiredEmailVerifications} email verifications, ${result.deletedAccounts} accounts`,
        );
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
