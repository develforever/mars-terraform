import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../data-source";
import { usersTable } from "../db/schema";
import { config } from "../config";
import { HttpError } from "../errors/HttpError";
import {
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  formatAccountNumber,
  generateAccountNumber,
  generateTotpSecret,
  hashAccountNumber,
  normalizeAccountNumber,
  verifyTotp,
} from "./accountCrypto";
import { SlidingWindowLimiter } from "./rateLimiter";

/**
 * Logowanie bez danych osobowych (T13, D17): numer konta + opcjonalny TOTP.
 * Brak e-maila, imienia, hasła i OAuth. Aplikacja nie przetwarza adresów IP: limity są globalne
 * (rejestracja) albo per konto (błędne kody TOTP).
 */

export interface JwtPayload {
  userId: number;
}

/** Komunikaty 401 rozpoznawane przez frontend. */
export const INVALID_CREDENTIALS = "Invalid account number or code";
export const TOTP_REQUIRED = "TOTP code required";

/** Globalny limit nowych kont (ochrona przed zalewaniem bazy bez śledzenia IP). */
export const REGISTRATIONS_PER_HOUR = 60;
/** Błędne kody TOTP na konto w oknie 15 min (6 cyfr = 10^6 kombinacji). */
export const TOTP_FAILURES_PER_WINDOW = 5;
const TOTP_FAILURE_WINDOW_MS = 15 * 60 * 1000;

const REGISTRATION_KEY = "global";
export const registrationLimiter = new SlidingWindowLimiter(REGISTRATIONS_PER_HOUR, 60 * 60 * 1000);
export const totpFailureLimiter = new SlidingWindowLimiter(TOTP_FAILURES_PER_WINDOW, TOTP_FAILURE_WINDOW_MS);

/**
 * `aud` tokenów modelu kont T13. Tokeny sprzed migracji `0002` (bez `aud`) są odrzucane: po migracji
 * identyfikatory kont zaczynają się od nowa, więc stary token mógłby wskazywać cudze, nowe konto.
 */
export const TOKEN_AUDIENCE = "mars-terraform:account-v1";

const generateToken = (payload: JwtPayload): string =>
  jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    audience: TOKEN_AUDIENCE,
  });

const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, config.jwtSecret, { audience: TOKEN_AUDIENCE });
  if (typeof decoded !== "object" || typeof decoded.userId !== "number") {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId };
};

const findUser = async (userId: number) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
};

/**
 * Nowe konto. Numer konta jest zwracany JEDEN raz (w bazie zostaje tylko HMAC) i nie da się go odzyskać.
 */
const register = async (now: Date = new Date()): Promise<{ accountNumber: string; token: string }> => {
  if (!registrationLimiter.hit(REGISTRATION_KEY, now.getTime())) {
    throw new HttpError(429, "Too many new accounts, try again later");
  }
  const accountNumber = generateAccountNumber();
  const [user] = await db
    .insert(usersTable)
    .values({
      accountHash: hashAccountNumber(accountNumber, config.accountSecret),
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: usersTable.id });

  return { accountNumber: formatAccountNumber(accountNumber), token: generateToken({ userId: user.id }) };
};

/**
 * Logowanie numerem konta. Przy włączonym TOTP wymagany jest kod: brak kodu -> 401 `TOTP code required`,
 * zły kod -> 401 (liczony do limitu), po wyczerpaniu limitu -> 429.
 */
const login = async (accountNumber: string, totpCode?: string, now: Date = new Date()): Promise<{ token: string }> => {
  const normalized = normalizeAccountNumber(accountNumber);
  if (!normalized) throw new HttpError(401, INVALID_CREDENTIALS);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.accountHash, hashAccountNumber(normalized, config.accountSecret)));
  if (!user) throw new HttpError(401, INVALID_CREDENTIALS);

  const updates: Partial<typeof usersTable.$inferInsert> = { lastLoginAt: now };
  if (user.totpEnabled) {
    if (!totpCode) throw new HttpError(401, TOTP_REQUIRED);
    const step = checkTotp(user.id, user.totpSecret, user.totpLastStep, totpCode, now);
    updates.totpLastStep = step;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
  return { token: generateToken({ userId: user.id }) };
};

/** Weryfikuje kod TOTP z limitem błędnych prób na konto. Zwraca użyty krok (ochrona przed powtórzeniem). */
const checkTotp = (
  userId: number,
  encryptedSecret: string | null,
  lastStep: number | null,
  code: string,
  now: Date,
  invalidStatus: 400 | 401 = 401,
): number => {
  const key = `user:${userId}`;
  if (totpFailureLimiter.isLimited(key, now.getTime())) {
    throw new HttpError(429, "Too many invalid codes, try again in 15 minutes");
  }
  if (!encryptedSecret) throw new HttpError(409, "Authenticator is not set up");
  const step = verifyTotp(decryptSecret(encryptedSecret, config.accountSecret), code, now.getTime(), lastStep);
  if (step === null) {
    totpFailureLimiter.hit(key, now.getTime());
    throw new HttpError(invalidStatus, invalidStatus === 401 ? INVALID_CREDENTIALS : "Invalid authenticator code");
  }
  totpFailureLimiter.reset(key);
  return step;
};

const me = async (userId: number) => {
  const user = await findUser(userId);
  if (!user) return null;
  return {
    id: user.id,
    nickname: user.nickname,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
};

/**
 * Krok 1 włączenia authenticatora: nowy sekret (zapisany zaszyfrowany, jeszcze nieaktywny).
 * Ponowne wywołanie przed aktywacją podmienia sekret. Przy aktywnym TOTP -> 409.
 */
const totpSetup = async (userId: number): Promise<{ secret: string; otpauthUri: string }> => {
  const user = await findUser(userId);
  if (!user) throw new HttpError(404, "User not found");
  if (user.totpEnabled) throw new HttpError(409, "Authenticator is already enabled");

  const secret = generateTotpSecret();
  await db
    .update(usersTable)
    .set({ totpSecret: encryptSecret(secret, config.accountSecret), totpLastStep: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  return { secret, otpauthUri: buildOtpAuthUri(secret, user.nickname || `Gracz ${user.id}`) };
};

/** Krok 2: aktywacja po podaniu poprawnego kodu z aplikacji. */
const totpEnable = async (userId: number, code: string, now: Date = new Date()): Promise<void> => {
  const user = await findUser(userId);
  if (!user) throw new HttpError(404, "User not found");
  if (user.totpEnabled) throw new HttpError(409, "Authenticator is already enabled");
  const step = checkTotp(user.id, user.totpSecret, user.totpLastStep, code, now, 400);
  await db
    .update(usersTable)
    .set({ totpEnabled: true, totpLastStep: step, updatedAt: now })
    .where(eq(usersTable.id, userId));
};

/** Wyłączenie authenticatora wymaga aktualnego kodu (ktoś z samym tokenem nie wyłączy 2FA). */
const totpDisable = async (userId: number, code: string, now: Date = new Date()): Promise<void> => {
  const user = await findUser(userId);
  if (!user) throw new HttpError(404, "User not found");
  if (!user.totpEnabled) throw new HttpError(409, "Authenticator is not enabled");
  checkTotp(user.id, user.totpSecret, user.totpLastStep, code, now, 400);
  await db
    .update(usersTable)
    .set({ totpEnabled: false, totpSecret: null, totpLastStep: null, updatedAt: now })
    .where(eq(usersTable.id, userId));
};

export const authService = {
  register,
  login,
  me,
  totpSetup,
  totpEnable,
  totpDisable,
  generateToken,
  verifyToken,
};
