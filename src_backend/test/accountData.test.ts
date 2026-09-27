import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * T12 (RODO): trwałe usunięcie konta, eksport danych i retencja na PRAWDZIWEJ bazie SQLite
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
import {
  coloniesTable,
  emailVerificationsTable,
  groupsTable,
  mapsTable,
  passwordResetsTable,
  userAuthMethodsTable,
  userGroupsTable,
  usersTable,
} from "../db/schema";
import { userService } from "../service/userService";
import {
  purgeExpiredData,
  scheduleRetention,
  UNVERIFIED_ACCOUNT_RETENTION_DAYS,
} from "../service/retentionService";

interface TestDataSource {
  db: typeof dataSource.db;
  testClient: { close: () => void };
  testDir: string;
}
const { db, testClient, testDir } = dataSource as unknown as TestDataSource;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-27T12:00:00Z");
const RESET_TOKEN = "reset-token-secret-a";
const VERIFY_TOKEN = "verify-token-secret-a";
const PASSWORD_HASH = "$2b$12$hash-that-must-never-be-exported";

const createUser = async (
  email: string,
  options: { verified?: boolean; createdAt?: Date; deletedAt?: Date | null } = {},
): Promise<number> => {
  const [user] = await db
    .insert(usersTable)
    .values({
      name: email.split("@")[0],
      email,
      emailVerifiedAt: options.verified === false ? null : NOW,
      createdAt: options.createdAt ?? NOW,
      updatedAt: options.createdAt ?? NOW,
      deletedAt: options.deletedAt ?? null,
    })
    .returning({ id: usersTable.id });
  return user.id;
};

const seedFullAccount = async (email: string): Promise<number> => {
  const userId = await createUser(email);
  await db.insert(userAuthMethodsTable).values({ userId, provider: "local", passwordHash: PASSWORD_HASH, verified: true });
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.name, "players"));
  await db.insert(userGroupsTable).values({ userId, groupId: group.id });
  await db.insert(mapsTable).values({ userId, name: `map-${email}`, data: JSON.stringify({ meta: { name: "Olympus" } }) });
  await db.insert(coloniesTable).values({ userId, name: `colony-${email}`, state: JSON.stringify({ credits: 42 }) });
  await db.insert(passwordResetsTable).values({ userId, token: `${RESET_TOKEN}-${email}`, expiresAt: new Date(NOW.getTime() + DAY_MS) });
  await db.insert(emailVerificationsTable).values({ userId, token: `${VERIFY_TOKEN}-${email}`, expiresAt: new Date(NOW.getTime() + DAY_MS) });
  return userId;
};

const countRows = async (userId: number): Promise<Record<string, number>> => {
  const count = async (table: typeof coloniesTable | typeof mapsTable | typeof userGroupsTable | typeof userAuthMethodsTable | typeof passwordResetsTable | typeof emailVerificationsTable): Promise<number> =>
    (await db.select().from(table).where(eq(table.userId, userId))).length;
  return {
    users: (await db.select().from(usersTable).where(eq(usersTable.id, userId))).length,
    colonies: await count(coloniesTable),
    maps: await count(mapsTable),
    userGroups: await count(userGroupsTable),
    authMethods: await count(userAuthMethodsTable),
    passwordResets: await count(passwordResetsTable),
    emailVerifications: await count(emailVerificationsTable),
  };
};

const ZERO = { users: 0, colonies: 0, maps: 0, userGroups: 0, authMethods: 0, passwordResets: 0, emailVerifications: 0 };

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  await db.insert(groupsTable).values({ name: "players" });
});

beforeEach(async () => {
  for (const table of [coloniesTable, mapsTable, userGroupsTable, userAuthMethodsTable, passwordResetsTable, emailVerificationsTable]) {
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
    const victim = await seedFullAccount("a@mars.test");
    const other = await seedFullAccount("b@mars.test");

    await expect(userService.deleteAccount(victim)).resolves.toBe(true);

    expect(await countRows(victim)).toEqual(ZERO);
    expect(await countRows(other)).toEqual({
      users: 1, colonies: 1, maps: 1, userGroups: 1, authMethods: 1, passwordResets: 1, emailVerifications: 1,
    });
    expect(await db.select().from(groupsTable)).toHaveLength(1);
  });

  it("zwraca false dla nieistniejącego konta", async () => {
    await expect(userService.deleteAccount(999_999)).resolves.toBe(false);
  });

  it("po usunięciu ten sam e-mail można zarejestrować ponownie (brak konfliktu unikalności)", async () => {
    const id = await seedFullAccount("again@mars.test");
    await userService.deleteAccount(id);
    await expect(createUser("again@mars.test")).resolves.toBeGreaterThan(0);
  });
});

describe("userService.exportData (RODO art. 15 i 20)", () => {
  it("zwraca profil, metody logowania, grupy, mapy i kolonie jako obiekty", async () => {
    const id = await seedFullAccount("export@mars.test");
    const data = await userService.exportData(id);

    expect(data).not.toBeNull();
    expect(data!.formatVersion).toBe(1);
    expect(data!.profile.email).toBe("export@mars.test");
    expect(data!.authMethods).toEqual([expect.objectContaining({ provider: "local", verified: true })]);
    expect(data!.groups).toEqual([{ name: "players", description: null }]);
    expect(data!.maps[0].data).toEqual({ meta: { name: "Olympus" } });
    expect(data!.colonies[0].state).toEqual({ credits: 42 });
  });

  it("nie zawiera hasha hasła ani tokenów resetu/weryfikacji", async () => {
    const id = await seedFullAccount("secret@mars.test");
    const json = JSON.stringify(await userService.exportData(id));

    expect(json).not.toContain(PASSWORD_HASH);
    expect(json).not.toContain(RESET_TOKEN);
    expect(json).not.toContain(VERIFY_TOKEN);
    expect(json).not.toContain("passwordHash");
  });

  it("nie zawiera danych innych użytkowników", async () => {
    const id = await seedFullAccount("mine@mars.test");
    await seedFullAccount("theirs@mars.test");
    const json = JSON.stringify(await userService.exportData(id));
    expect(json).not.toContain("theirs@mars.test");
  });

  it("zwraca null dla nieistniejącego konta", async () => {
    await expect(userService.exportData(999_999)).resolves.toBeNull();
  });
});

describe("purgeExpiredData (retencja)", () => {
  it("usuwa wygasłe tokeny, zostawia ważne", async () => {
    const id = await createUser("tokens@mars.test");
    await db.insert(passwordResetsTable).values([
      { userId: id, token: "expired-reset", expiresAt: new Date(NOW.getTime() - 1000) },
      { userId: id, token: "valid-reset", expiresAt: new Date(NOW.getTime() + DAY_MS) },
    ]);
    await db.insert(emailVerificationsTable).values([
      { userId: id, token: "expired-verify", expiresAt: new Date(NOW.getTime() - 1000) },
      { userId: id, token: "valid-verify", expiresAt: new Date(NOW.getTime() + DAY_MS) },
    ]);

    const result = await purgeExpiredData(NOW);

    expect(result.expiredPasswordResets).toBe(1);
    expect(result.expiredEmailVerifications).toBe(1);
    expect((await db.select().from(passwordResetsTable)).map((r) => r.token)).toEqual(["valid-reset"]);
    expect((await db.select().from(emailVerificationsTable)).map((r) => r.token)).toEqual(["valid-verify"]);
  });

  it(`usuwa niepotwierdzone konta starsze niż ${UNVERIFIED_ACCOUNT_RETENTION_DAYS} dni i konta z deleted_at`, async () => {
    const old = new Date(NOW.getTime() - (UNVERIFIED_ACCOUNT_RETENTION_DAYS + 1) * DAY_MS);
    const recent = new Date(NOW.getTime() - (UNVERIFIED_ACCOUNT_RETENTION_DAYS - 1) * DAY_MS);
    const staleUnverified = await createUser("stale@mars.test", { verified: false, createdAt: old });
    await db.insert(coloniesTable).values({ userId: staleUnverified, name: "x", state: "{}" });
    const freshUnverified = await createUser("fresh@mars.test", { verified: false, createdAt: recent });
    const oldVerified = await createUser("veteran@mars.test", { verified: true, createdAt: old });
    const softDeleted = await createUser("gone@mars.test", { deletedAt: NOW });

    const result = await purgeExpiredData(NOW);

    expect(result.deletedAccounts).toBe(2);
    expect((await countRows(staleUnverified)).users).toBe(0);
    expect((await countRows(staleUnverified)).colonies).toBe(0);
    expect((await countRows(softDeleted)).users).toBe(0);
    expect((await countRows(freshUnverified)).users).toBe(1);
    expect((await countRows(oldVerified)).users).toBe(1);
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

  it("loguje liczbę usuniętych rekordów tylko, gdy coś usunięto", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const run = vi.fn().mockResolvedValue({ expiredPasswordResets: 0, expiredEmailVerifications: 2, deletedAccounts: 1 });

    const timer = scheduleRetention(60_000, run);
    await vi.waitFor(() => expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("2 email verifications, 1 accounts")));
    clearInterval(timer);
    logSpy.mockRestore();
  });
});
