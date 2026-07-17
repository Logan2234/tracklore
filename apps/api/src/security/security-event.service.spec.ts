import type { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "./security-event.service";

function makeService() {
  const prisma = {
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;

  return { service: new SecurityEventService(prisma), prisma };
}

describe("SecurityEventService.record", () => {
  it("persists the event, defaulting a missing userId to null", async () => {
    const { service, prisma } = makeService();

    await service.record({
      type: "LOGIN_FAILED",
      identifier: "nobody@example.com",
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "LOGIN_FAILED",
        userId: null,
        identifier: "nobody@example.com",
        detail: undefined,
        userAgent: undefined,
      },
    });
  });
});

describe("SecurityEventService.list", () => {
  it("defaults to page 1 and filters by type + a case-insensitive identifier match", async () => {
    const { service, prisma } = makeService();

    await service.list({ type: "USER_DELETED", identifier: "Alice" });

    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "USER_DELETED",
          identifier: { contains: "Alice", mode: "insensitive" },
        },
        skip: 0,
        take: 50,
      }),
    );
  });

  it("pages by 50, offsetting by (page - 1) * 50", async () => {
    const { service, prisma } = makeService();

    await service.list({ page: 3 });

    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });
});
