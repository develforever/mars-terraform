import dotenv from "dotenv-flow";

dotenv.config();

class Config {
  readonly tursoUrl: string;
  readonly tursoToken: string;
  readonly port: number;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly frontendUrl: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpUser: string;
  readonly smtpPass: string;
  readonly smtpFrom: string;
  readonly emailStrategy: string;
  readonly sendgridApiKey: string;
  readonly mailgunApiKey: string;
  readonly mailgunDomain: string;
  readonly resendApiKey: string;
  readonly mailjetApiKey: string;
  readonly mailjetApiSecret: string;
  readonly mailtrapApiToken: string;
  readonly mailtrapInboxId: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;

  constructor() {
    this.tursoUrl = this.getRequired("turso_url");
    this.tursoToken = this.getRequired("turso_token");
    this.port = parseInt(process.env.PORT || process.env.port || "3000", 10);
    this.jwtSecret = this.getRequired("jwt_secret");
    this.jwtExpiresIn = this.getOptional("jwt_expires_in", "1h");
    this.frontendUrl = this.getOptional("frontend_url", "http://localhost:5173");
    this.smtpHost = this.getOptional("smtp_host", "");
    this.smtpPort = parseInt(this.getOptional("smtp_port", "587"), 10);
    this.smtpUser = this.getOptional("smtp_user", "");
    this.smtpPass = this.getOptional("smtp_pass", "");
    this.smtpFrom = this.getOptional("smtp_from", "noreply@mars-terraform.local");
    this.emailStrategy = this.getOptional("email_strategy", "console");
    this.sendgridApiKey = this.getOptional("sendgrid_api_key", "");
    this.mailgunApiKey = this.getOptional("mailgun_api_key", "");
    this.mailgunDomain = this.getOptional("mailgun_domain", "");
    this.resendApiKey = this.getOptional("resend_api_key", "");
    this.mailjetApiKey = this.getOptional("mailjet_api_key", "");
    this.mailjetApiSecret = this.getOptional("mailjet_api_secret", "");
    this.mailtrapApiToken = this.getOptional("mailtrap_api_token", "");
    this.mailtrapInboxId = this.getOptional("mailtrap_inbox_id", "");
    this.googleClientId = this.getOptional("google_client_id", "");
    this.googleClientSecret = this.getOptional("google_client_secret", "");
    this.githubClientId = this.getOptional("github_client_id", "");
    this.githubClientSecret = this.getOptional("github_client_secret", "");
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
