import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * T13: konta bez danych osobowych (numer konta + opcjonalny TOTP) na PRAWDZIWEJ bazie SQLite
 * (plik tymczasowy, schemat z migracji `drizzle/`).
 */
vi.mock("../data-source", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const nodePath = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("../db/schema");
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "mars-auth-"));
  const client = createClient({ url: pathToFileURL(nodePath.join(dir, "test.db")).href });
  return { db: drizzle(client, { schema }), testClient: client, testDir: dir };
});

vi.mock("../config", () => ({
  config: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
    accountSecret: "test-account-secret-at-least-32-characters",
  },
}));

import * as dataSource from "../data-source";
import { usersTable } from "../db/schema";
import {
  authService,
  INVALID_CREDENTIALS,
  REGISTRATIONS_PER_HOUR,
  registrationLimiter,
  TOKEN_AUDIENCE,
  TOTP_FAILURES_PER_WINDOW,
  TOTP_REQUIRED,
  totpFailureLimiter,
} from "./authService";
import { base32Decode, hotp, totpStep } from "./accountCrypto";

interface TestDataSource {
  db: typeof dataSource.db;
  testClient: { close: () => void };
  testDir: string;
}
const { db, testClient, testDir } = dataSource as unknown as TestDataSource;

const NOW = new Date("2026-09-27T12:00:00Z");
const codeAt = (secret: string, date: Date, offsetSteps = 0): string =>
  hotp(base32Decode(secret), totpStep(date.getTime()) + offsetSteps);

const userIdFromToken = (token: string): number => authService.verifyToken(token).userId;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
});

beforeEach(async () => {
  await db.delete(usersTable);
  registrationLimiter.reset("global");
});

afterAll(async () => {
  testClient.close();
  const fs = await import("node:fs");
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Windows potrafi trzymać blokadę pliku SQLite chwilę po close().
  }
});

describe("register", () => {
  it("zwraca numer konta w formacie XXXX-XXXX-XXXX-XXXX-XXXX i token; w bazie jest tylko hash", async () => {
    const { accountNumber, token } = await authService.register(NOW);

    expect(accountNumber).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){4}[0-9A-HJKMNP-TV-Z]{4}$/);
    const [row] = await db.select().from(usersTable);
    expect(row.id).toBe(userIdFromToken(token));
    expect(row.accountHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(accountNumber.replace(/-/g, ""));
    expect(row.totpEnabled).toBe(false);
  });

  it(`po ${REGISTRATIONS_PER_HOUR} kontach w godzinie zwraca 429 (limit globalny, bez IP)`, async () => {
    for (let i = 0; i < REGISTRATIONS_PER_HOUR; i += 1) registrationLimiter.hit("global", NOW.getTime());
    await expect(authService.register(NOW)).rejects.toMatchObject({ status: 429 });
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });
});

describe("login numerem konta", () => {
  it("przyjmuje numer z myślnikami, bez nich i małymi literami; aktualizuje last_login_at", async () => {
    const { accountNumber, token } = await authService.register(NOW);
    const id = userIdFromToken(token);
    const later = new Date(NOW.getTime() + 60_000);

    for (const variant of [accountNumber, accountNumber.replace(/-/g, ""), accountNumber.toLowerCase()]) {
      const result = await authService.login(variant, undefined, later);
      expect(userIdFromToken(result.token)).toBe(id);
    }
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    expect(row.lastLoginAt?.getTime()).toBe(Math.floor(later.getTime() / 1000) * 1000);
  });

  it("nieznany i niepoprawny numer -> ten sam 401", async () => {
    await authService.register(NOW);
    await expect(authService.login("7KQ2-M9XA-4TRE-01ZC-8HNP")).rejects.toMatchObject({ status: 401, message: INVALID_CREDENTIALS });
    await expect(authService.login("zly-numer")).rejects.toMatchObject({ status: 401, message: INVALID_CREDENTIALS });
  });
});

describe("authenticator (TOTP)", () => {
  const registerWithTotp = async () => {
    const { accountNumber, token } = await authService.register(NOW);
    const userId = userIdFromToken(token);
    const { secret, otpauthUri } = await authService.totpSetup(userId);
    await authService.totpEnable(userId, codeAt(secret, NOW), NOW);
    totpFailureLimiter.reset(`user:${userId}`);
    return { accountNumber, userId, secret, otpauthUri };
  };

  it("setup daje sekret i link otpauth; do aktywacji logowanie działa bez kodu, sekret jest zaszyfrowany", async () => {
    const { accountNumber, token } = await authService.register(NOW);
    const userId = userIdFromToken(token);
    const { secret, otpauthUri } = await authService.totpSetup(userId);

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUri).toContain(`secret=${secret}`);
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    expect(row.totpEnabled).toBe(false);
    expect(row.totpSecret).not.toContain(secret);
    await expect(authService.login(accountNumber)).resolves.toHaveProperty("token");
  });

  it("aktywacja: zły kod -> 400, dobry -> włączone", async () => {
    const { token } = await authService.register(NOW);
    const userId = userIdFromToken(token);
    const { secret } = await authService.totpSetup(userId);

    await expect(authService.totpEnable(userId, "000000", NOW)).rejects.toMatchObject({ status: 400 });
    await authService.totpEnable(userId, codeAt(secret, NOW), NOW);
    expect((await authService.me(userId))?.totpEnabled).toBe(true);
    await expect(authService.totpSetup(userId)).rejects.toMatchObject({ status: 409 });
  });

  it("po włączeniu: bez kodu 401 TOTP required, z dobrym kodem OK, ten sam kod drugi raz 401", async () => {
    const { accountNumber, secret } = await registerWithTotp();
    const t = new Date(NOW.getTime() + 60_000);

    await expect(authService.login(accountNumber, undefined, t)).rejects.toMatchObject({ status: 401, message: TOTP_REQUIRED });
    await expect(authService.login(accountNumber, codeAt(secret, t), t)).resolves.toHaveProperty("token");
    await expect(authService.login(accountNumber, codeAt(secret, t), t)).rejects.toMatchObject({ status: 401, message: INVALID_CREDENTIALS });
  });

  it(`po ${TOTP_FAILURES_PER_WINDOW} złych kodach -> 429 nawet dla dobrego kodu`, async () => {
    const { accountNumber, secret } = await registerWithTotp();
    const t = new Date(NOW.getTime() + 60_000);

    for (let i = 0; i < TOTP_FAILURES_PER_WINDOW; i += 1) {
      await expect(authService.login(accountNumber, "000000", t)).rejects.toMatchObject({ status: 401 });
    }
    await expect(authService.login(accountNumber, codeAt(secret, t), t)).rejects.toMatchObject({ status: 429 });
  });

  it("wyłączenie wymaga aktualnego kodu; potem logowanie bez kodu", async () => {
    const { accountNumber, userId, secret } = await registerWithTotp();
    const t = new Date(NOW.getTime() + 60_000);

    await expect(authService.totpDisable(userId, "000000", t)).rejects.toMatchObject({ status: 400 });
    await authService.totpDisable(userId, codeAt(secret, t), t);
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    expect(row.totpEnabled).toBe(false);
    expect(row.totpSecret).toBeNull();
    await expect(authService.login(accountNumber)).resolves.toHaveProperty("token");
    await expect(authService.totpDisable(userId, "123456", t)).rejects.toMatchObject({ status: 409 });
  });
});

describe("tokeny i profil", () => {
  it("odrzuca stare tokeny bez aud (sprzed migracji 0002) i tokeny z innym sekretem", () => {
    const legacy = jwt.sign({ userId: 1, email: "old@mars.test" }, "test-secret", { expiresIn: "1h" });
    const foreign = jwt.sign({ userId: 1 }, "other-secret", { expiresIn: "1h", audience: TOKEN_AUDIENCE });
    expect(() => authService.verifyToken(legacy)).toThrow();
    expect(() => authService.verifyToken(foreign)).toThrow();
  });

  it("me zwraca profil bez hasha numeru i sekretu TOTP", async () => {
    const { token } = await authService.register(NOW);
    const profile = await authService.me(userIdFromToken(token));
    expect(profile).toEqual({
      id: userIdFromToken(token),
      nickname: null,
      totpEnabled: false,
      createdAt: expect.any(Date),
      lastLoginAt: expect.any(Date),
    });
    await expect(authService.me(999_999)).resolves.toBeNull();
  });
});
