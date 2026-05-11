import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config", () => ({
  config: {
    smtpFrom: "noreply@mars-terraform.local",
    mailtrapApiToken: "test-api-token",
    mailtrapInboxId: "12345",
  },
}));

import { MailtrapEmailService } from "./emailService";

describe("MailtrapEmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should send email via Mailtrap sandbox API with inbox id", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "{}",
    });

    const service = new MailtrapEmailService();
    await service.send({
      to: "user@example.com",
      subject: "Test Subject",
      text: "Test body",
      html: "<p>Test body</p>",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(url).toBe("https://sandbox.api.mailtrap.io/api/send/12345");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-token",
        "Content-Type": "application/json",
      },
    });

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: { email: "noreply@mars-terraform.local" },
      to: [{ email: "user@example.com" }],
      subject: "Test Subject",
      text: "Test body",
      html: "<p>Test body</p>",
    });
  });

  it("should throw when Mailtrap API returns error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const service = new MailtrapEmailService();
    await expect(
      service.send({
        to: "user@example.com",
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow("Mailtrap error 401: Unauthorized");
  });

  it("should send email via Mailtrap without inbox id", async () => {
    vi.resetModules();
    vi.doMock("../config", () => ({
      config: {
        smtpFrom: "noreply@test.local",
        mailtrapApiToken: "token-xyz",
        mailtrapInboxId: "",
      },
    }));

    const { MailtrapEmailService: FreshService } = await import("./emailService");
    const service = new FreshService();

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "{}",
    });

    await service.send({
      to: "user@example.com",
      subject: "Test",
      text: "Body",
    });

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://sandbox.api.mailtrap.io/api/send");
  });
});
