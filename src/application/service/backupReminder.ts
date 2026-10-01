/**
 * Przypomnienie o kopii zapasowej zapisów (T16). Zapisy są tylko w przeglądarce (D18), więc co
 * {@link BACKUP_REMINDER_EVERY_SAVES} ręcznych zapisów bez pobrania pliku gracz dostaje przypomnienie.
 * Licznik w `localStorage` (bez cookies); błąd pamięci przeglądarki = brak przypomnienia, nigdy wyjątek.
 */
export const BACKUP_REMINDER_KEY = "mars-terraform:backup-reminder:v1";
export const BACKUP_REMINDER_EVERY_SAVES = 5;

interface ReminderState {
  savesSinceBackup: number;
  lastBackupAt: number | null;
}

const readState = (): ReminderState => {
  try {
    const raw = window.localStorage.getItem(BACKUP_REMINDER_KEY);
    if (!raw) return { savesSinceBackup: 0, lastBackupAt: null };
    const parsed = JSON.parse(raw) as Partial<ReminderState>;
    return {
      savesSinceBackup: Number.isInteger(parsed.savesSinceBackup) ? Number(parsed.savesSinceBackup) : 0,
      lastBackupAt: typeof parsed.lastBackupAt === "number" ? parsed.lastBackupAt : null,
    };
  } catch {
    return { savesSinceBackup: 0, lastBackupAt: null };
  }
};

const writeState = (state: ReminderState): void => {
  try {
    window.localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(state));
  } catch {
    // Brak dostępu do pamięci przeglądarki: przypomnienie po prostu się nie pojawi.
  }
};

export const backupReminder = {
  /** Rejestruje udany zapis gry. Zwraca `true`, gdy należy przypomnieć o kopii zapasowej. */
  recordSave: (): boolean => {
    const state = readState();
    const savesSinceBackup = state.savesSinceBackup + 1;
    writeState({ ...state, savesSinceBackup });
    return savesSinceBackup % BACKUP_REMINDER_EVERY_SAVES === 0;
  },

  /** Rejestruje pobranie pliku zapisu (kopia zapasowa) i zeruje licznik. */
  recordBackup: (now: number = Date.now()): void => {
    writeState({ savesSinceBackup: 0, lastBackupAt: now });
  },

  getState: readState,
};
