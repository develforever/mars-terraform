import { config } from "../config";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    console.log("========== EMAIL ==========");
    console.log(`To: ${message.to}`);
    console.log(`From: ${config.smtpFrom}`);
    console.log(`Subject: ${message.subject}`);
    console.log("---------------------------");
    console.log(message.text);
    console.log("===========================");
  }
}

export class SmtpEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    let nodemailer;
    try {
      // @ts-expect-error nodemailer is an optional dependency
      nodemailer = await import("nodemailer");
    } catch {
      throw new Error(
        "SMTP email strategy requires 'nodemailer'. Install it with: npm install nodemailer",
      );
    }
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    });
    await transporter.sendMail({
      from: config.smtpFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export class SendGridEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!config.sendgridApiKey) {
      throw new Error("SendGrid strategy requires sendgrid_api_key in .env");
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: config.smtpFrom },
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text },
          ...(message.html ? [{ type: "text/html", value: message.html }] : []),
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`SendGrid error ${response.status}: ${body}`);
    }
  }
}

export class MailgunEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!config.mailgunApiKey || !config.mailgunDomain) {
      throw new Error("Mailgun strategy requires mailgun_api_key and mailgun_domain in .env");
    }
    const params = new URLSearchParams();
    params.append("from", config.smtpFrom);
    params.append("to", message.to);
    params.append("subject", message.subject);
    params.append("text", message.text);
    if (message.html) params.append("html", message.html);

    const response = await fetch(
      `https://api.mailgun.net/v3/${config.mailgunDomain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config.mailgunApiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`Mailgun error ${response.status}: ${body}`);
    }
  }
}

export class ResendEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!config.resendApiKey) {
      throw new Error("Resend strategy requires resend_api_key in .env");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.smtpFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`Resend error ${response.status}: ${body}`);
    }
  }
}

export class MailtrapEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!config.mailtrapApiToken) {
      throw new Error("Mailtrap strategy requires mailtrap_api_token in .env");
    }
    const url = config.mailtrapInboxId
      ? `https://sandbox.api.mailtrap.io/api/send/${config.mailtrapInboxId}`
      : "https://sandbox.api.mailtrap.io/api/send";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.mailtrapApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: config.smtpFrom },
        to: [{ email: message.to }],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`Mailtrap error ${response.status}: ${body}`);
    }
  }
}

export class MailjetEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    if (!config.mailjetApiKey || !config.mailjetApiSecret) {
      throw new Error("Mailjet strategy requires mailjet_api_key and mailjet_api_secret in .env");
    }
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.mailjetApiKey}:${config.mailjetApiSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: config.smtpFrom },
            To: [{ Email: message.to }],
            Subject: message.subject,
            TextPart: message.text,
            HTMLPart: message.html,
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`Mailjet error ${response.status}: ${body}`);
    }
  }
}

function createEmailService(): EmailService {
  switch (config.emailStrategy) {
    case "smtp":
      return new SmtpEmailService();
    case "sendgrid":
      return new SendGridEmailService();
    case "mailgun":
      return new MailgunEmailService();
    case "resend":
      return new ResendEmailService();
    case "mailtrap":
      return new MailtrapEmailService();
    case "mailjet":
      return new MailjetEmailService();
    case "console":
    default:
      return new ConsoleEmailService();
  }
}

export const emailService: EmailService = createEmailService();
