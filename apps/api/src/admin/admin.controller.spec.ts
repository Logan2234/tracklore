import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { MailService } from "../mail/mail.service";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminController } from "./admin.controller";
import type { AdminService } from "./admin.service";

function makeController() {
  const admin = {} as unknown as AdminService;
  const mail = {
    listTemplates: jest
      .fn()
      .mockReturnValue([{ key: "welcome", label: "Bienvenue" }]),
    isConfigured: jest.fn().mockReturnValue(true),
    renderTemplatePreview: jest.fn(),
    sendTemplateTest: jest.fn(),
  } as unknown as MailService;
  const push = {
    sendToUser: jest.fn(),
  } as unknown as PushService;
  const prisma = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const controller = new AdminController(admin, mail, push, prisma);
  return { controller, mail, push, prisma };
}

describe("AdminController emails", () => {
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

    expect(() => controller.previewEmailTemplate("nope")).toThrow(
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

describe("AdminController.sendAdminTestPush", () => {
  it("throws NotFoundException when no account matches the email", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.sendAdminTestPush({ email: "nobody@example.com" }),
    ).rejects.toThrow(NotFoundException);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it("sends to the matching account's devices", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });

    await controller.sendAdminTestPush({ email: "alice@example.com" });

    expect(push.sendToUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: expect.any(String) }),
    );
  });
});
