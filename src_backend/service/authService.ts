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
import { HttpError } from "../errors/HttpError";

export interface JwtPayload {
  userId: number;
  email: string;
}

/** Koszt bcrypt dla haseł użytkowników (rejestracja, zmiana i reset hasła) oraz hasha-atrapy. */
const BCRYPT_COST = 10;

/** Stały sekret hasha-atrapy; nie jest hasłem żadnego konta (hash nie trafia do bazy). */
const DUMMY_PASSWORD = "mars-terraform:dummy:6f1c0e9a4b7d2385c1e0f4a9b8d7c6e5";

let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash-atrapa dla logowania bez konta / bez metody lokalnej: `bcrypt.compare` na nim trwa tyle,
 * co na prawdziwym haśle (ten sam koszt), więc czas odpowiedzi nie zdradza istnienia konta.
 * Liczony leniwie przy pierwszym użyciu (nie blokuje startu serwera) i cache'owany.
 */
const getDummyHash = (): Promise<string> => {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(DUMMY_PASSWORD, BCRYPT_COST).catch((err: unknown) => {
      dummyHashPromise = null;
      throw err;
    });
  }
  return dummyHashPromise;
};

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
    throw new HttpError(409, "User with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

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

/**
 * Kolejność sprawdzeń chroni przed enumeracją kont: brak konta, brak metody lokalnej i złe hasło
 * dają ten sam 401 po tym samym koszcie bcrypt; „Email not verified” (403) dopiero po poprawnym haśle.
 */
const loginLocal = async (
  email: string,
  password: string,
): Promise<{ token: string }> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  const user = users.length > 0 ? users[0] : null;

  const authMethods = user
    ? await db
        .select()
        .from(userAuthMethodsTable)
        .where(
          and(
            eq(userAuthMethodsTable.userId, user.id),
            eq(userAuthMethodsTable.provider, "local"),
          ),
        )
    : [];

  const passwordHash = authMethods.length > 0 ? authMethods[0].passwordHash : null;

  if (!user || !passwordHash) {
    await bcrypt.compare(password, await getDummyHash());
    throw new HttpError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid credentials");
  }

  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "Email not verified. Please verify your email before logging in.");
  }

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
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
    throw new HttpError(400, "No local auth method found");
  }

  const valid = await bcrypt.compare(oldPassword, authMethods[0].passwordHash!);
  if (!valid) {
    throw new HttpError(403, "Invalid current password");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await db
    .update(userAuthMethodsTable)
    .set({ passwordHash: newPasswordHash })
    .where(eq(userAuthMethodsTable.id, authMethods[0].id));
};

const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/** Zawsze kończy się sukcesem dla klienta (anty-enumeracja); e-mail tylko dla istniejącego konta. */
const requestPasswordReset = async (email: string): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    return;
  }

  const user = users[0];

  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 3600000);

    await db.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, user.id));

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
  } catch (err: unknown) {
    // Błąd (np. SMTP) występuje tylko dla istniejącego konta: 5xx zdradziłby jego istnienie, więc tylko log.
    console.error("[auth] password reset email failed:", err);
  }
};

const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const resets = await db
    .select()
    .from(passwordResetsTable)
    .where(and(eq(passwordResetsTable.token, token), gt(passwordResetsTable.expiresAt, new Date())));

  if (resets.length === 0) {
    throw new HttpError(400, "Invalid or expired reset token");
  }

  const reset = resets[0];
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await db
    .update(userAuthMethodsTable)
    .set({ passwordHash })
    .where(
      and(
        eq(userAuthMethodsTable.userId, reset.userId),
        eq(userAuthMethodsTable.provider, "local"),
      ),
    );

  await db.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, reset.userId));
};

/** Nowy token weryfikacyjny (poprzednie unieważnione) + e-mail z linkiem. */
const sendVerificationEmail = async (userId: number, email: string): Promise<void> => {
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
    to: email,
    subject: "Verify Your Email",
    text: `Please verify your email by clicking this link: ${verifyUrl}\n\nThis link will expire in 24 hours.`,
  });
};

const requestEmailVerification = async (userId: number): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    // Wywoływane tylko z id właśnie utworzonego użytkownika (rejestracja) → naruszenie niezmiennika, 5xx.
    throw new Error("User not found");
  }

  const user = users[0];

  if (user.emailVerifiedAt) {
    throw new HttpError(409, "Email already verified");
  }

  await sendVerificationEmail(user.id, user.email);
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
    throw new HttpError(400, "Invalid or expired verification token");
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

/**
 * Zawsze kończy się sukcesem dla klienta (anty-enumeracja): brak konta albo konto już zweryfikowane
 * → bez wysyłki i bez błędu; niezweryfikowane → nowy link. Błąd wysyłki jest tylko logowany,
 * bo 5xx pojawiałby się wyłącznie dla istniejących, niezweryfikowanych kont.
 */
const resendVerification = async (email: string): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)));

  if (users.length === 0) {
    return;
  }

  const user = users[0];

  if (user.emailVerifiedAt) {
    return;
  }

  try {
    await sendVerificationEmail(user.id, user.email);
  } catch (err: unknown) {
    console.error("[auth] verification email failed:", err);
  }
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
