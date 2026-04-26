import dotenv from "dotenv-flow";

dotenv.config();

class Config {
  readonly tursoUrl: string;
  readonly tursoToken: string;
  readonly port: number;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;

  constructor() {
    this.tursoUrl = this.getRequired("turso_url");
    this.tursoToken = this.getRequired("turso_token");
    this.port = parseInt(this.getOptional("port", "3000"), 10);
    this.jwtSecret = this.getRequired("jwt_secret");
    this.jwtExpiresIn = this.getOptional("jwt_expires_in", "1h");
  }

  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env variable: ${key}`);
    }
    return value;
  }

  private getOptional(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }
}

export const config = new Config();
