import dotenv from "dotenv-flow";

dotenv.config();

const TRUE_VALUES: ReadonlySet<string> = new Set(["true", "1", "yes"]);
const FALSE_VALUES: ReadonlySet<string> = new Set(["false", "0", "no"]);

class Config {
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly serveFrontend: boolean;
  readonly isProduction: boolean;

  constructor() {
    this.port = parseInt(process.env.PORT || process.env.port || "3000", 10);
    this.corsOrigins = this.getOriginList("cors_origins");
    this.serveFrontend = this.getBoolean("serve_frontend", true);
    this.isProduction = process.env.NODE_ENV === "production";
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
