import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { MailService } from "../mail/mail.service";
import { AdminEmailsController } from "./admin-emails.controller";

function makeController() {
  const mail = {
    listTemplates: jest
      .fn()
      .mockReturnValue([{ key: "welcome", label: "Bienvenue" }]),
    isConfigured: jest.fn().mockReturnValue(true),
    renderTemplatePreview: jest.fn(),
    sendTemplateTest: jest.fn(),
  } as unknown as MailService;

  const controller = new AdminEmailsController(mail);
  return { controller, mail };
}

describe("AdminEmailsController", () => {
  it("lists templates alongside SMTP configuration state", () => {
    const { controller } = makeController();
    const result = controller.listEmailTemplates();
    expect(result).toEqual({
      templates: [{ key: "welcome", label: "Bienvenue" }],
      smtpConfigured: true,
    });
  });

  it("throws NotFoundException previewing an unknown template", () => {
    const { controller, mail } = makeController();
    (mail.renderTemplatePreview as jest.Mock).mockReturnValue(null);

    expect(() => controller.previewEmailTemplate("nope", {})).toThrow(
      NotFoundException,
    );
  });

  it("rejects test-send when SMTP isn't configured", async () => {
    const { controller, mail } = makeController();
    (mail.isConfigured as jest.Mock).mockReturnValue(false);

    await expect(
      controller.sendTestEmail("welcome", { to: "a@b.com" }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(mail.sendTemplateTest).not.toHaveBeenCalled();
  });

  it("throws NotFoundException test-sending an unknown template", async () => {
    const { controller, mail } = makeController();
    (mail.sendTemplateTest as jest.Mock).mockResolvedValue(false);

    await expect(
      controller.sendTestEmail("nope", { to: "a@b.com" }),
    ).rejects.toThrow(NotFoundException);
  });
});
