import dotenv from "dotenv-flow";

dotenv.config();

const TRUE_VALUES: ReadonlySet<string> = new Set(["true", "1", "yes"]);
const FALSE_VALUES: ReadonlySet<string> = new Set(["false", "0", "no"]);

/** Minimalna długość `account_secret` (np. 48 losowych bajtów hex = 96 znaków). */
export const ACCOUNT_SECRET_MIN_LENGTH = 32;

class Config {
  readonly tursoUrl: string;
  readonly tursoToken: string | undefined;
  readonly port: number;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  /**
   * T13: klucz HMAC numerów kont i szyfrowania sekretów TOTP. NIGDY nie zmieniaj po starcie produkcji:
   * zmiana unieważnia wszystkie numery kont (nie da się ich przeliczyć, bo w bazie jest tylko hash).
   */
  readonly accountSecret: string;
  readonly openRouterApiKey: string;
  readonly corsOrigins: readonly string[];
  readonly serveFrontend: boolean;
  readonly isProduction: boolean;

  constructor() {
    this.tursoUrl = this.getOptional("turso_url", "file:./local.db");
    this.tursoToken = process.env.turso_token || undefined;
    this.port = parseInt(process.env.PORT || process.env.port || "3000", 10);
    this.jwtSecret = this.getRequired("jwt_secret");
    this.jwtExpiresIn = this.getOptional("jwt_expires_in", "1h");
    this.accountSecret = this.getSecret("account_secret", ACCOUNT_SECRET_MIN_LENGTH);
    this.openRouterApiKey = this.getOptional("openrouter_api_key", "");
    this.corsOrigins = this.getOriginList("cors_origins");
    this.serveFrontend = this.getBoolean("serve_frontend", true);
    this.isProduction = process.env.NODE_ENV === "production";
  }

  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env variable: ${key}`);
    }
    return value;
  }

  private getSecret(key: string, minLength: number): string {
    const value = this.getRequired(key);
    if (value.length < minLength) {
      throw new Error(`Invalid env variable ${key}: must be at least ${minLength} characters`);
    }
    return value;
  }

  private getOptional(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }

  private getOriginList(key: string): readonly string[] {
    const entries = this.getOptional(key, "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    for (const entry of entries) {
      if (!this.isOrigin(entry)) {
        throw new Error(
          `Invalid env variable ${key}: "${entry}" is not an origin (expected scheme://host[:port] without path or trailing slash)`,
        );
      }
    }
    return Object.freeze(entries);
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const raw = this.getOptional(key, "");
    const normalized = raw.trim().toLowerCase();
    if (normalized === "") {
      return fallback;
    }
    if (TRUE_VALUES.has(normalized)) {
      return true;
    }
    if (FALSE_VALUES.has(normalized)) {
      return false;
    }
    throw new Error(
      `Invalid env variable ${key}: "${raw}" is not a boolean (expected true/false, 1/0 or yes/no)`,
    );
  }

  private isOrigin(value: string): boolean {
    try {
      return new URL(value).origin === value;
    } catch {
      return false;
    }
  }
}

export const config = new Config();
