import { db } from "../data-source";
import { usersTable, userAuthMethodsTable, userGroupsTable, groupsTable } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  userId: number;
  email: string;
}

const registerLocal = async (
  email: string,
  password: string,
  name: string,
): Promise<{ id: number; email: string }> => {
  const existing = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (existing.length > 0) {
    throw new Error("User with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(usersTable)
      .values({ email, name, authProvider: "local" })
      .returning();

    await tx.insert(userAuthMethodsTable).values({
      userId: user.id,
      provider: "local",
      passwordHash,
      verified: false,
    });

    const defaultGroup = await tx
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.name, "users"));

    if (defaultGroup.length > 0) {
      await tx.insert(userGroupsTable).values({
        userId: user.id,
        groupId: defaultGroup[0].id,
      });
    }

    return user;
  });

  return { id: result.id, email: result.email };
};

const loginLocal = async (
  email: string,
  password: string,
): Promise<{ token: string }> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = users[0];

  const authMethods = await db
    .select()
    .from(userAuthMethodsTable)
    .where(
      and(
        eq(userAuthMethodsTable.userId, user.id),
        eq(userAuthMethodsTable.provider, "local"),
      ),
    );

  if (authMethods.length === 0) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, authMethods[0].passwordHash!);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });

  return { token };
};

const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};

const changePassword = async (
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  const authMethods = await db
    .select()
    .from(userAuthMethodsTable)
    .where(
      and(
        eq(userAuthMethodsTable.userId, userId),
        eq(userAuthMethodsTable.provider, "local"),
      ),
    );

  if (authMethods.length === 0) {
    throw new Error("No local auth method found");
  }

  const valid = await bcrypt.compare(oldPassword, authMethods[0].passwordHash!);
  if (!valid) {
    throw new Error("Invalid current password");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(userAuthMethodsTable)
    .set({ passwordHash: newPasswordHash })
    .where(eq(userAuthMethodsTable.id, authMethods[0].id));
};

export const authService = {
  registerLocal,
  loginLocal,
  verifyToken,
  changePassword,
};
