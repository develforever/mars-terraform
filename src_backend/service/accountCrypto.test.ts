import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NUMBER_LENGTH,
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  formatAccountNumber,
  generateAccountNumber,
  generateTotpSecret,
  hashAccountNumber,
  hotp,
  normalizeAccountNumber,
  verifyTotp,
} from "./accountCrypto";

const RFC6238_SECRET = Buffer.from("12345678901234567890", "ascii");
const RFC6238_SECRET_B32 = base32Encode(RFC6238_SECRET);

describe("numer konta", () => {
  it("ma 20 znaków Crockford Base32 i jest losowy", () => {
    const a = generateAccountNumber();
    const b = generateAccountNumber();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(a).toHaveLength(ACCOUNT_NUMBER_LENGTH);
    expect(a).not.toBe(b);
  });

  it("formatuje w grupach po 4 i normalizuje wpis gracza (małe litery, spacje, O/I/L)", () => {
    const n = "7KQ2M9XA4TRE01ZC8HNP";
    const formatted = formatAccountNumber(n);
    expect(formatted).toBe("7KQ2-M9XA-4TRE-01ZC-8HNP");
    expect(normalizeAccountNumber(formatted)).toBe(n);
    expect(normalizeAccountNumber(" 7kq2 m9xa 4tre oizc 8hnp ")).toBe("7KQ2M9XA4TRE01ZC8HNP");
    expect(normalizeAccountNumber("7kq2-m9xa-4tre-0lzc-8hnp")).toBe(n);
  });

  it("odrzuca zły format", () => {
    expect(normalizeAccountNumber("")).toBeNull();
    expect(normalizeAccountNumber("7KQ2-M9XA")).toBeNull();
    expect(normalizeAccountNumber("7KQ2-M9XA-4TRE-01ZC-8HNU")).toBeNull();
    expect(normalizeAccountNumber("7KQ2-M9XA-4TRE-01ZC-8HNP-0")).toBeNull();
  });

  it("hash zależy od numeru i od sekretu serwera", () => {
    const n = generateAccountNumber();
    const h = hashAccountNumber(n, "secret-a");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAccountNumber(n, "secret-a")).toBe(h);
    expect(hashAccountNumber(n, "secret-b")).not.toBe(h);
    expect(h).not.toContain(n.toLowerCase());
  });
});

describe("base32 RFC 4648", () => {
  it("koduje i dekoduje (wektory RFC 4648)", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb oi").toString()).toBe("foobar");
  });

  it("odrzuca niepoprawne znaki", () => {
    expect(() => base32Decode("MZXW1")).toThrow("Invalid base32 character");
  });
});

describe("TOTP (RFC 6238, SHA-1)", () => {
  it("zgadza się z wektorami testowymi RFC 6238 (ostatnie 6 cyfr)", () => {
    expect(hotp(RFC6238_SECRET, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(hotp(RFC6238_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(hotp(RFC6238_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(hotp(RFC6238_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("przyjmuje kod z bieżącego i sąsiedniego kroku, odrzuca starszy", () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(1234567890 / 30);
    expect(verifyTotp(RFC6238_SECRET_B32, "005924", now)).toBe(step);
    expect(verifyTotp(RFC6238_SECRET_B32, hotp(RFC6238_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC6238_SECRET_B32, hotp(RFC6238_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC6238_SECRET_B32, hotp(RFC6238_SECRET, step - 2), now)).toBeNull();
  });

  it("nie pozwala użyć tego samego kodu drugi raz (lastUsedStep)", () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(1234567890 / 30);
    expect(verifyTotp(RFC6238_SECRET_B32, "005924", now, step)).toBeNull();
    expect(verifyTotp(RFC6238_SECRET_B32, "005924", now, step - 1)).toBe(step);
  });

  it("odrzuca kod w złym formacie", () => {
    expect(verifyTotp(RFC6238_SECRET_B32, "12345", Date.now())).toBeNull();
    expect(verifyTotp(RFC6238_SECRET_B32, "abcdef", Date.now())).toBeNull();
  });

  it("nowy sekret ma 32 znaki base32 (160 bitów) i daje link otpauth", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = buildOtpAuthUri(secret, "Gracz 7");
    expect(uri.startsWith("otpauth://totp/Mars%20Terraform%3AGracz%207?")).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=Mars+Terraform");
  });
});

describe("szyfrowanie sekretu TOTP", () => {
  it("round-trip i losowy IV", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", "server-secret");
    const b = encryptSecret("JBSWY3DPEHPK3PXP", "server-secret");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(a, "server-secret")).toBe("JBSWY3DPEHPK3PXP");
  });

  it("zły klucz albo zmodyfikowany szyfrogram -> błąd", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", "server-secret");
    expect(() => decryptSecret(payload, "other-secret")).toThrow();
    const parts = payload.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), "server-secret")).toThrow();
    expect(() => decryptSecret("v0:x:y:z", "server-secret")).toThrow("Unsupported encrypted secret format");
  });
});
