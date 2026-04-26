import { db } from "../data-source";
import { groupsTable, userGroupsTable, usersTable } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";

const create = async (name: string, description?: string) => {
  const [group] = await db
    .insert(groupsTable)
    .values({ name, description })
    .returning();

  return group;
};

const list = async () => {
  return db.select().from(groupsTable);
};

const getById = async (id: number) => {
  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, id));

  return group ?? null;
};

const getMembers = async (groupId: number) => {
  return db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(userGroupsTable)
    .innerJoin(usersTable, eq(userGroupsTable.userId, usersTable.id))
    .where(and(eq(userGroupsTable.groupId, groupId), isNull(usersTable.deletedAt)));
};

const addUser = async (userId: number, groupId: number) => {
  await db.insert(userGroupsTable).values({ userId, groupId });
};

const removeUser = async (userId: number, groupId: number) => {
  await db
    .delete(userGroupsTable)
    .where(and(eq(userGroupsTable.userId, userId), eq(userGroupsTable.groupId, groupId)));
};

export const groupService = {
  create,
  list,
  getById,
  getMembers,
  addUser,
  removeUser,
};
