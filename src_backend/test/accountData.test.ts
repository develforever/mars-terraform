import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * T12/T13 (RODO): trwałe usunięcie konta, eksport danych i retencja na PRAWDZIWEJ bazie SQLite
 * (plik tymczasowy, schemat z migracji `drizzle/`), bo liczy się, czy z bazy znikają wszystkie wiersze.
 */
vi.mock("../data-source", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const nodePath = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("../db/schema");
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "mars-account-"));
  const client = createClient({ url: pathToFileURL(nodePath.join(dir, "test.db")).href });
  return { db: drizzle(client, { schema }), testClient: client, testDir: dir };
});

import * as dataSource from "../data-source";
import { coloniesTable, groupsTable, mapsTable, userGroupsTable, usersTable } from "../db/schema";
import { userService } from "../service/userService";
import {
  INACTIVE_ACCOUNT_RETENTION_DAYS,
  purgeExpiredData,
  scheduleRetention,
} from "../service/retentionService";

interface TestDataSource {
  db: typeof dataSource.db;
  testClient: { close: () => void };
  testDir: string;
}
const { db, testClient, testDir } = dataSource as unknown as TestDataSource;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-27T12:00:00Z");
const ACCOUNT_HASH_PREFIX = "hash-that-must-never-be-exported-";
const TOTP_SECRET = "v1:encrypted-totp-secret-never-exported";

let seq = 0;
const createUser = async (
  options: { nickname?: string; createdAt?: Date; lastLoginAt?: Date | null } = {},
): Promise<number> => {
  seq += 1;
  const [user] = await db
    .insert(usersTable)
    .values({
      accountHash: `${ACCOUNT_HASH_PREFIX}${seq}`,
      nickname: options.nickname ?? null,
      totpSecret: TOTP_SECRET,
      totpEnabled: true,
      createdAt: options.createdAt ?? NOW,
      updatedAt: options.createdAt ?? NOW,
      lastLoginAt: options.lastLoginAt === undefined ? NOW : options.lastLoginAt,
    })
    .returning({ id: usersTable.id });
  return user.id;
};

const seedFullAccount = async (nickname: string): Promise<number> => {
  const userId = await createUser({ nickname });
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.name, "players"));
  await db.insert(userGroupsTable).values({ userId, groupId: group.id });
  await db.insert(mapsTable).values({ userId, name: `map-${nickname}`, data: JSON.stringify({ meta: { name: "Olympus" } }) });
  await db.insert(coloniesTable).values({ userId, name: `colony-${nickname}`, state: JSON.stringify({ credits: 42 }) });
  return userId;
};

const countRows = async (userId: number): Promise<Record<string, number>> => ({
  users: (await db.select().from(usersTable).where(eq(usersTable.id, userId))).length,
  colonies: (await db.select().from(coloniesTable).where(eq(coloniesTable.userId, userId))).length,
  maps: (await db.select().from(mapsTable).where(eq(mapsTable.userId, userId))).length,
  userGroups: (await db.select().from(userGroupsTable).where(eq(userGroupsTable.userId, userId))).length,
});

const ZERO = { users: 0, colonies: 0, maps: 0, userGroups: 0 };

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  await db.insert(groupsTable).values({ name: "players" });
});

beforeEach(async () => {
  for (const table of [coloniesTable, mapsTable, userGroupsTable]) {
    await db.delete(table);
  }
  await db.delete(usersTable);
});

afterAll(async () => {
  testClient.close();
  const fs = await import("node:fs");
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Windows potrafi trzymać blokadę pliku SQLite chwilę po close(); katalog tymczasowy posprząta system.
  }
});

describe("userService.deleteAccount (RODO art. 17)", () => {
  it("usuwa konto i WSZYSTKIE powiązane wiersze, nie ruszając innych kont ani grup", async () => {
    const victim = await seedFullAccount("ares");
    const other = await seedFullAccount("phobos");

    await expect(userService.deleteAccount(victim)).resolves.toBe(true);

    expect(await countRows(victim)).toEqual(ZERO);
    expect(await countRows(other)).toEqual({ users: 1, colonies: 1, maps: 1, userGroups: 1 });
    expect(await db.select().from(groupsTable)).toHaveLength(1);
  });

  it("zwraca false dla nieistniejącego konta", async () => {
    await expect(userService.deleteAccount(999_999)).resolves.toBe(false);
  });
});

describe("userService.exportData (RODO art. 15 i 20)", () => {
  it("zwraca profil, grupy, mapy i kolonie jako obiekty", async () => {
    const id = await seedFullAccount("deimos");
    const data = await userService.exportData(id);

    expect(data).not.toBeNull();
    expect(data!.formatVersion).toBe(1);
    expect(data!.profile).toMatchObject({ id, nickname: "deimos", totpEnabled: true });
    expect(data!.groups).toEqual([{ name: "players", description: null }]);
    expect(data!.maps[0].data).toEqual({ meta: { name: "Olympus" } });
    expect(data!.colonies[0].state).toEqual({ credits: 42 });
  });

  it("nie zawiera hasha numeru konta ani sekretu TOTP", async () => {
    const id = await seedFullAccount("secret");
    const json = JSON.stringify(await userService.exportData(id));

    expect(json).not.toContain(ACCOUNT_HASH_PREFIX);
    expect(json).not.toContain(TOTP_SECRET);
    expect(json).not.toContain("accountHash");
    expect(json).not.toContain("totpSecret");
  });

  it("nie zawiera danych innych użytkowników", async () => {
    const id = await seedFullAccount("mine");
    await seedFullAccount("theirs");
    const json = JSON.stringify(await userService.exportData(id));
    expect(json).not.toContain("theirs");
  });

  it("zwraca null dla nieistniejącego konta", async () => {
    await expect(userService.exportData(999_999)).resolves.toBeNull();
  });
});

describe("purgeExpiredData (retencja nieaktywnych kont)", () => {
  it(`usuwa konta nieużywane dłużej niż ${INACTIVE_ACCOUNT_RETENTION_DAYS} dni razem z danymi`, async () => {
    const old = new Date(NOW.getTime() - (INACTIVE_ACCOUNT_RETENTION_DAYS + 1) * DAY_MS);
    const recent = new Date(NOW.getTime() - (INACTIVE_ACCOUNT_RETENTION_DAYS - 1) * DAY_MS);
    const inactive = await createUser({ createdAt: old, lastLoginAt: old });
    await db.insert(coloniesTable).values({ userId: inactive, name: "x", state: "{}" });
    const neverLoggedOld = await createUser({ createdAt: old, lastLoginAt: null });
    const oldButActive = await createUser({ createdAt: old, lastLoginAt: recent });
    const fresh = await createUser({ createdAt: recent, lastLoginAt: null });

    const result = await purgeExpiredData(NOW);

    expect(result.deletedAccounts).toBe(2);
    expect(await countRows(inactive)).toEqual(ZERO);
    expect((await countRows(neverLoggedOld)).users).toBe(0);
    expect((await countRows(oldButActive)).users).toBe(1);
    expect((await countRows(fresh)).users).toBe(1);
  });
});

describe("scheduleRetention", () => {
  it("uruchamia przebieg od razu i loguje błąd zamiast rzucać", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error("db down"));

    const timer = scheduleRetention(60_000, run);
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledWith("[retention] failed: db down"));
    clearInterval(timer);

    expect(run).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("loguje liczbę usuniętych kont tylko, gdy coś usunięto", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const run = vi.fn().mockResolvedValue({ deletedAccounts: 3 });

    const timer = scheduleRetention(60_000, run);
    await vi.waitFor(() => expect(logSpy).toHaveBeenCalledWith("[retention] removed 3 inactive accounts"));
    clearInterval(timer);
    logSpy.mockRestore();
  });
});
