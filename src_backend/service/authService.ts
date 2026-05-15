import { db } from "../data-source";
import {
  usersTable,
  userAuthMethodsTable,
  userGroupsTable,
  groupsTable,
  passwordResetsTable,
  emailVerificationsTable,
} from "../db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { emailService } from "./emailService";
import * as crypto from "crypto";

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

  await requestEmailVerification(result.id);

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

  if (!user.emailVerifiedAt) {
    throw new Error("Email not verified. Please verify your email before logging in.");
  }

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

const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const requestPasswordReset = async (email: string): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    return;
  }

  const user = users[0];
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 3600000);

  await db.insert(passwordResetsTable).values({
    userId: user.id,
    token,
    expiresAt,
  });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  await emailService.send({
    to: email,
    subject: "Password Reset Request",
    text: `You requested a password reset. Click the link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.`,
  });
};

const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const resets = await db
    .select()
    .from(passwordResetsTable)
    .where(and(eq(passwordResetsTable.token, token), gt(passwordResetsTable.expiresAt, new Date())));

  if (resets.length === 0) {
    throw new Error("Invalid or expired reset token");
  }

  const reset = resets[0];
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(userAuthMethodsTable)
    .set({ passwordHash })
    .where(
      and(
        eq(userAuthMethodsTable.userId, reset.userId),
        eq(userAuthMethodsTable.provider, "local"),
      ),
    );

  await db.delete(passwordResetsTable).where(eq(passwordResetsTable.id, reset.id));
};

const requestEmailVerification = async (userId: number): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    throw new Error("User not found");
  }

  const user = users[0];

  if (user.emailVerifiedAt) {
    throw new Error("Email already verified");
  }

  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.userId, userId));

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 86400000);

  await db.insert(emailVerificationsTable).values({
    userId,
    token,
    expiresAt,
  });

  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;

  await emailService.send({
    to: user.email,
    subject: "Verify Your Email",
    text: `Please verify your email by clicking this link: ${verifyUrl}\n\nThis link will expire in 24 hours.`,
  });
};

const verifyEmail = async (token: string): Promise<void> => {
  const verifications = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.token, token),
        gt(emailVerificationsTable.expiresAt, new Date()),
      ),
    );

  if (verifications.length === 0) {
    throw new Error("Invalid or expired verification token");
  }

  const verification = verifications[0];

  await db
    .update(usersTable)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(usersTable.id, verification.userId));

  await db
    .update(userAuthMethodsTable)
    .set({ verified: true })
    .where(eq(userAuthMethodsTable.userId, verification.userId));

  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.id, verification.id));
};

const resendVerification = async (email: string): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    throw new Error("User not found");
  }

  const user = users[0];

  if (user.emailVerifiedAt) {
    throw new Error("Email already verified");
  }

  await requestEmailVerification(user.id);
};

export const authService = {
  registerLocal,
  loginLocal,
  verifyToken,
  changePassword,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
  resendVerification,
};
