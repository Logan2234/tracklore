import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: "access-secret",
  JWT_REFRESH_SECRET: "refresh-secret",
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice",
    passwordHash: "irrelevant",
    birthDate: null,
    allowAdultContent: false,
    notifyInApp: true,
    notifyEmail: true,
    notifyPush: true,
    entitlements: [],
    enabledDomains: ["MOVIE", "SERIES", "ANIME", "GAME", "BOOK"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function makeService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest
      .fn()
      .mockImplementation(async (payload: Record<string, unknown>) =>
        payload.jti ? `refresh-${payload.jti}` : `access-${payload.sub}`,
      ),
    verifyAsync: jest.fn().mockResolvedValue({}),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: jest.fn((key: string) => SECRETS[key]),
  } as unknown as ConfigService;

  const service = new AuthService(prisma, jwtService, configService);
  return { service, prisma, jwtService, configService };
}

describe("AuthService.register", () => {
  it("throws ConflictException when the email is already taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with a bcrypt hash and opens a session", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email uniqueness check
      .mockResolvedValueOnce(null); // username uniqueness check
    (prisma.user.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    const result = await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
    });

    const createArgs = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.email).toBe("alice@example.com");
    expect(
      await bcrypt.compare("secret1234", createArgs.data.passwordHash),
    ).toBe(true);
    expect(createArgs.data.username).toBe("alice");

    expect(result.user.email).toBe("alice@example.com");
    expect(result.tokens.accessToken).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it("appends a random suffix when the slugified username is taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email uniqueness
      .mockResolvedValueOnce(makeUser()) // "alice" taken
      .mockResolvedValueOnce(null); // suffixed candidate free
    (prisma.user.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
    });

    const createArgs = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.username).toMatch(/^alice.+/);
  });
});

describe("AuthService.login", () => {
  it("throws UnauthorizedException when no user matches the identifier", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.login({ identifier: "nobody", password: "whatever" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the password doesn't match", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      makeUser({ passwordHash }),
    );

    await expect(
      service.login({ identifier: "alice@example.com", password: "wrong" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("returns tokens and records a session on success", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(result.user.id).toBe(user.id);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id }),
      }),
    );
  });
});

describe("AuthService.refresh", () => {
  it("throws UnauthorizedException when the JWT itself fails verification", async () => {
    const { service, jwtService } = makeService();
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("bad"));

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when no matching session is stored", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when the stored session already expired", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "rt-1",
      expiresAt: new Date(Date.now() - 1000),
      user: makeUser(),
    });

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rotates the stored token in place and returns a fresh pair", async () => {
    const { service, prisma } = makeService();
    const user = makeUser();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken("old-token"),
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    const tokens = await service.refresh("old-token");

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1" },
        data: expect.objectContaining({
          tokenHash: hashToken(tokens.refreshToken),
        }),
      }),
    );
  });
});

describe("AuthService.logout", () => {
  it("deletes the refresh token matching the presented value's hash", async () => {
    const { service, prisma } = makeService();

    await service.logout("some-refresh-token");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("some-refresh-token") },
    });
  });
});

describe("AuthService.requestPasswordReset", () => {
  it("returns null without touching the database when the email is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const token = await service.requestPasswordReset("nobody@example.com");

    expect(token).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("issues a token and clears any previous ones for the account", async () => {
    const { service, prisma } = makeService();
    const user = makeUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    const token = await service.requestPasswordReset(user.email);

    expect(token).toEqual(expect.any(String));
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          tokenHash: hashToken(token as string),
        }),
      }),
    );
  });
});

describe("AuthService.resetPassword", () => {
  it("throws UnauthorizedException when the token is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      service.resetPassword("bad-token", "new-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the token has expired", async () => {
    const { service, prisma } = makeService();
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword("expired-token", "new-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("updates the password and revokes every session and reset token", async () => {
    const { service, prisma } = makeService();
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000),
    });

    await service.resetPassword("good-token", "brand-new-password");

    const updateArgs = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "user-1" });
    expect(
      await bcrypt.compare(
        "brand-new-password",
        updateArgs.data.passwordHash,
      ),
    ).toBe(true);
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});
