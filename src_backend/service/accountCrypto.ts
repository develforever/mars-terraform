import crypto from "node:crypto";

/**
 * Kryptografia kont bez danych osobowych (T13, D17). Tylko `node:crypto`, bez zewnętrznych paczek.
 *
 * Numer konta: 20 znaków Crockford Base32 (100 bitów losowości), np. `7KQ2-M9XA-4TRE-B1ZC-8HNP`.
 * W bazie jest wyłącznie HMAC-SHA256(numer, account_secret): wyciek samej bazy nie pozwala się zalogować,
 * a 100 bitów wyklucza zgadywanie. Wysoka entropia pozwala na deterministyczny hash (wyszukiwanie po indeksie).
 *
 * TOTP (RFC 6238, SHA-1, 6 cyfr, 30 s) jak w Google Authenticator / Aegis. Sekret jest w bazie
 * zaszyfrowany AES-256-GCM kluczem wyprowadzonym (HKDF) z `account_secret`.
 */

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RFC4648_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const ACCOUNT_NUMBER_LENGTH = 20;
const ACCOUNT_NUMBER_GROUP = 4;

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
const TOTP_SECRET_BYTES = 20;
export const TOTP_ISSUER = "Mars Terraform";

const ENCRYPTION_VERSION = "v1";
const HKDF_SALT = "mars-terraform";
const HKDF_INFO_TOTP = "totp-secret-v1";

/** Nowy numer konta (znormalizowany, bez myślników). */
export const generateAccountNumber = (): string => {
  let result = "";
  for (let i = 0; i < ACCOUNT_NUMBER_LENGTH; i += 1) {
    result += CROCKFORD_ALPHABET[crypto.randomInt(CROCKFORD_ALPHABET.length)];
  }
  return result;
};

/** `7KQ2M9XA...` -> `7KQ2-M9XA-...` (do pokazania graczowi). */
export const formatAccountNumber = (normalized: string): string =>
  normalized.match(new RegExp(`.{1,${ACCOUNT_NUMBER_GROUP}}`, "g"))?.join("-") ?? normalized;

/**
 * Normalizacja wpisanego numeru: wielkie litery, bez spacji i myślników, pomyłki Crockford (O->0, I/L->1).
 * Zwraca `null`, gdy to nie jest poprawny numer konta.
 */
export const normalizeAccountNumber = (input: string): string | null => {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== ACCOUNT_NUMBER_LENGTH) return null;
  for (const char of cleaned) {
    if (!CROCKFORD_ALPHABET.includes(char)) return null;
  }
  return cleaned;
};

/** HMAC-SHA256 (hex) znormalizowanego numeru konta. */
export const hashAccountNumber = (normalized: string, accountSecret: string): string =>
  crypto.createHmac("sha256", accountSecret).update(normalized).digest("hex");

// --- Base32 RFC 4648 (format sekretów TOTP w aplikacjach authenticator) ---

export const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string): Buffer => {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = RFC4648_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

// --- TOTP (RFC 6238 / HOTP RFC 4226) ---

export const generateTotpSecret = (): string => base32Encode(crypto.randomBytes(TOTP_SECRET_BYTES));

export const totpStep = (nowMs: number): number => Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);

export const hotp = (secret: Buffer, counter: number, digits: number = TOTP_DIGITS): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
};

/**
 * Sprawdza kod TOTP w oknie ±`window` kroków. Zwraca numer kroku, który pasuje, albo `null`.
 * Kroki `<= lastUsedStep` są odrzucane (ten sam kod nie działa dwa razy).
 */
export const verifyTotp = (
  base32Secret: string,
  code: string,
  nowMs: number,
  lastUsedStep: number | null = null,
  window = 1,
): number | null => {
  const normalizedCode = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) return null;
  const secret = base32Decode(base32Secret);
  const current = totpStep(nowMs);
  for (let delta = -window; delta <= window; delta += 1) {
    const step = current + delta;
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = hotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedCode))) return step;
  }
  return null;
};

/** Link `otpauth://` do dodania konta w aplikacji authenticator (ręcznie albo przez QR). */
export const buildOtpAuthUri = (base32Secret: string, label: string): string => {
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(`${TOTP_ISSUER}:${label}`)}?${params.toString()}`;
};

// --- Szyfrowanie sekretu TOTP w bazie (AES-256-GCM, klucz z HKDF(account_secret)) ---

const deriveKey = (accountSecret: string): Buffer =>
  Buffer.from(crypto.hkdfSync("sha256", accountSecret, HKDF_SALT, HKDF_INFO_TOTP, 32));

export const encryptSecret = (plaintext: string, accountSecret: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(accountSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
};

export const decryptSecret = (payload: string, accountSecret: string): string => {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== ENCRYPTION_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(accountSecret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
};
