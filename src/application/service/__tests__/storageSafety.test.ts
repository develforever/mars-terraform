import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_REMINDER_EVERY_SAVES, BACKUP_REMINDER_KEY, backupReminder } from "../backupReminder";
import { requestPersistentStorage, resetPersistRequestForTests } from "../browserStore";

describe("backupReminder (T16)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it(`przypomina co ${BACKUP_REMINDER_EVERY_SAVES} zapisów bez kopii`, () => {
    const results = Array.from({ length: BACKUP_REMINDER_EVERY_SAVES * 2 }, () => backupReminder.recordSave());
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(results[BACKUP_REMINDER_EVERY_SAVES - 1]).toBe(true);
    expect(results[BACKUP_REMINDER_EVERY_SAVES * 2 - 1]).toBe(true);
  });

  it("pobranie kopii zeruje licznik i zapamiętuje datę", () => {
    for (let i = 0; i < BACKUP_REMINDER_EVERY_SAVES - 1; i += 1) backupReminder.recordSave();
    backupReminder.recordBackup(1234);
    expect(backupReminder.getState()).toEqual({ savesSinceBackup: 0, lastBackupAt: 1234 });
    expect(backupReminder.recordSave()).toBe(false);
  });

  it("uszkodzony wpis w localStorage nie psuje gry", () => {
    localStorage.setItem(BACKUP_REMINDER_KEY, "{nie json");
    expect(backupReminder.getState()).toEqual({ savesSinceBackup: 0, lastBackupAt: null });
    expect(() => backupReminder.recordSave()).not.toThrow();
  });
});

describe("requestPersistentStorage (T16)", () => {
  beforeEach(() => {
    resetPersistRequestForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetPersistRequestForTests();
  });

  const stubStorage = (storage: Partial<StorageManager> | undefined) =>
    vi.stubGlobal("navigator", { ...navigator, storage });

  it("bez API zwraca false", async () => {
    stubStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it("gdy magazyn już jest trwały, nie prosi ponownie", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("prosi o trwałość tylko raz na sesję", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    await requestPersistentStorage();
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("błąd przeglądarki = false, bez wyjątku", async () => {
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error("denied")), persist: vi.fn() });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
