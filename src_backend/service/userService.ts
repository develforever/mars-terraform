import { db } from "../data-source";
import { usersTable, userGroupsTable, groupsTable, coloniesTable, mapsTable } from "../db/schema";
import { eq } from "drizzle-orm";

/** Wersja formatu eksportu danych (`GET /api/users/me/export`). Zmieniaj przy zmianie kształtu. */
export const USER_EXPORT_FORMAT_VERSION = 1;

const getById = async (id: number) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      nickname: usersTable.nickname,
      totpEnabled: usersTable.totpEnabled,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      lastLoginAt: usersTable.lastLoginAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  return user ?? null;
};

/** T13: zmiana pseudonimu (jedyna edytowalna dana profilu). */
const update = async (id: number, data: { nickname: string }) => {
  const [updated] = await db
    .update(usersTable)
    .set({ nickname: data.nickname, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  return updated ?? null;
};

/**
 * T12/T13: trwałe usunięcie konta i WSZYSTKICH powiązanych danych w jednej transakcji.
 * Tabele nie mają `ON DELETE CASCADE`, więc wiersze zależne usuwamy jawnie, przed wierszem `users`.
 * Zwraca `false`, gdy konta nie ma.
 */
const deleteAccount = async (userId: number): Promise<boolean> => {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!existing) return false;

    await tx.delete(coloniesTable).where(eq(coloniesTable.userId, userId));
    await tx.delete(mapsTable).where(eq(mapsTable.userId, userId));
    await tx.delete(userGroupsTable).where(eq(userGroupsTable.userId, userId));
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
    return true;
  });
};

/** Stan kolonii jest zapisany jako tekst JSON; w eksporcie oddajemy go jako obiekt, jeśli się parsuje. */
const parseJsonOrRaw = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

/**
 * T12 (RODO art. 15 i 20): wszystkie dane użytkownika w formacie JSON.
 * Bez sekretów: hash numeru konta i sekret TOTP nie są eksportowane.
 * Zwraca `null`, gdy konta nie ma.
 */
const exportData = async (userId: number) => {
  const profile = await getById(userId);
  if (!profile) return null;

  const groups = await getGroups(userId);

  const maps = await db
    .select({
      id: mapsTable.id,
      name: mapsTable.name,
      description: mapsTable.description,
      players: mapsTable.players,
      version: mapsTable.version,
      data: mapsTable.data,
      createdAt: mapsTable.createdAt,
      updatedAt: mapsTable.updatedAt,
    })
    .from(mapsTable)
    .where(eq(mapsTable.userId, userId));

  const colonies = await db
    .select({
      id: coloniesTable.id,
      name: coloniesTable.name,
      state: coloniesTable.state,
      createdAt: coloniesTable.createdAt,
      updatedAt: coloniesTable.updatedAt,
    })
    .from(coloniesTable)
    .where(eq(coloniesTable.userId, userId));

  return {
    formatVersion: USER_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    groups: groups.map((g) => ({ name: g.name, description: g.description })),
    maps: maps.map((m) => ({ ...m, data: parseJsonOrRaw(m.data) })),
    colonies: colonies.map((c) => ({ ...c, state: parseJsonOrRaw(c.state) })),
  };
};

const getGroups = async (userId: number) => {
  return db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      description: groupsTable.description,
    })
    .from(userGroupsTable)
    .innerJoin(groupsTable, eq(userGroupsTable.groupId, groupsTable.id))
    .where(eq(userGroupsTable.userId, userId));
};

export const userService = {
  getById,
  update,
  deleteAccount,
  exportData,
  getGroups,
};
