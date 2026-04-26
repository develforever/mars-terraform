import { db } from "../data-source";
import { usersTable, userGroupsTable, groupsTable } from "../db/schema";
import { eq, isNull } from "drizzle-orm";

const getById = async (id: number) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)));

  return user ?? null;
};

const list = async () => {
  return db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(isNull(usersTable.deletedAt));
};

const update = async (id: number, data: { name?: string; email?: string }) => {
  const [updated] = await db
    .update(usersTable)
    .set(data)
    .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)))
    .returning();

  return updated ?? null;
};

const softDelete = async (id: number) => {
  const [deleted] = await db
    .update(usersTable)
    .set({ deletedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  return deleted ?? null;
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

import { and } from "drizzle-orm";

export const userService = {
  getById,
  list,
  update,
  softDelete,
  getGroups,
};
