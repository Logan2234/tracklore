import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { hashToken } from "../auth/auth.service";
import { UsersController } from "./users.controller";

describe("UsersController — email change", () => {
  const userId = "user-1";
  let prisma: any;
  let mail: any;
  let controller: UsersController;
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash("correct-password", 4);
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailChangeRequest: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    mail = {
      sendEmailChangeCode: jest.fn(),
      sendEmailChanged: jest.fn(),
    };
    const security = { record: jest.fn() };
    const dataExport = { buildExport: jest.fn() };
    controller = new UsersController(
      prisma,
      mail,
      security as any,
      dataExport as any,
    );
  });

  describe("changeEmail", () => {
    it("rejects an incorrect current password without creating a request", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });

      await expect(
        controller.changeEmail(
          { sub: userId } as any,
          { newEmail: "new@example.com", currentPassword: "wrong" } as any,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.create).not.toHaveBeenCalled();
    });

    it("creates a pending request and emails the code, without touching User.email", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: userId, passwordHash }) // current user
        .mockResolvedValueOnce(null); // no email collision

      await controller.changeEmail(
        { sub: userId } as any,
        {
          newEmail: "new@example.com",
          currentPassword: "correct-password",
        } as any,
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.emailChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            newEmail: "new@example.com",
          }),
        }),
      );
      expect(mail.sendEmailChangeCode).toHaveBeenCalledWith(
        "new@example.com",
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe("confirmEmailChange", () => {
    function pendingRequest(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: "req-1",
        userId,
        newEmail: "new@example.com",
        codeHash: hashToken("123456"),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
        ...overrides,
      };
    }

    it("applies the new email and notifies both addresses on a correct code", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: "old@example.com",
        passwordHash,
      });
      prisma.emailChangeRequest.findFirst.mockResolvedValueOnce(
        pendingRequest(),
      );
      prisma.user.update.mockResolvedValueOnce({
        id: userId,
        email: "new@example.com",
        displayName: "Alice",
        username: "alice",
        birthDate: null,
        allowAdultContent: false,
        notifyInApp: true,
        notifyEmail: false,
        notifyPush: false,
        emailVerified: false,
        entitlements: [],
        role: "USER",
        enabledDomains: [],
        createdAt: new Date(),
      });

      await controller.confirmEmailChange(
        { sub: userId } as any,
        { code: "123456" } as any,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: "new@example.com" },
      });
      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mail.sendEmailChanged).toHaveBeenCalledWith(
        "old@example.com",
        "new@example.com",
      );
    });

    it("rejects a wrong code and increments attempts", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      prisma.emailChangeRequest.findFirst.mockResolvedValueOnce(
        pendingRequest(),
      );

      await expect(
        controller.confirmEmailChange(
          { sub: userId } as any,
          { code: "000000" } as any,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("deletes the request after the max number of failed attempts", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      prisma.emailChangeRequest.findFirst.mockResolvedValueOnce(
        pendingRequest({ attempts: 4 }),
      );

      await expect(
        controller.confirmEmailChange(
          { sub: userId } as any,
          { code: "000000" } as any,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.emailChangeRequest.update).not.toHaveBeenCalled();
    });

    it("rejects an expired code", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      prisma.emailChangeRequest.findFirst.mockResolvedValueOnce(
        pendingRequest({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(
        controller.confirmEmailChange(
          { sub: userId } as any,
          { code: "123456" } as any,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
