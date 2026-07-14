import nodemailer from "nodemailer";
import { MailService } from "./mail.service";

jest.mock("nodemailer");

describe("MailService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("is a no-op when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const service = new MailService();
    await service.sendWelcome("alice@example.com", "Alice");

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("sends through the configured transport when SMTP is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.SMTP_FROM = "Tracklore <no-reply@tracklore.app>";
    process.env.WEB_ORIGIN = "https://tracklore.example";

    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService();
    await service.sendPasswordResetLink("alice@example.com", "tok123");

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "user", pass: "pass" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Tracklore <no-reply@tracklore.app>",
        to: "alice@example.com",
        text: expect.stringContaining(
          "https://tracklore.example/reset-password?token=tok123",
        ),
      }),
    );
  });

  it("swallows send failures instead of throwing", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = jest.fn().mockRejectedValue(new Error("smtp down"));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService();
    await expect(
      service.sendPasswordChanged("alice@example.com"),
    ).resolves.toBeUndefined();
  });
});
