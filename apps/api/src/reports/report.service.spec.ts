import type { PrismaService } from "../prisma/prisma.service";
import { ReportService } from "./report.service";

function make(
  overrides: Partial<Record<string, Partial<Record<string, jest.Mock>>>> = {},
) {
  const prisma = {
    report: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      ...overrides.report,
    },
    comment: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.comment,
    },
    user: { findUnique: jest.fn().mockResolvedValue(null), ...overrides.user },
    mediaItem: { findUnique: jest.fn().mockResolvedValue(null) },
    gameItem: { findUnique: jest.fn().mockResolvedValue(null) },
    bookItem: { findUnique: jest.fn().mockResolvedValue(null) },
    musicItem: { findUnique: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;

  return { svc: new ReportService(prisma), prisma };
}

describe("ReportService.create", () => {
  it("persists a report against a polymorphic target", async () => {
    const { svc, prisma } = make();
    await svc.create("reporter1", "COMMENT" as never, "c1", "spam");
    expect(prisma.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: "reporter1",
        targetType: "COMMENT",
        targetId: "c1",
        reason: "spam",
      },
    });
  });
});

describe("ReportService.list — target resolution", () => {
  it("resolves a COMMENT target to an excerpt", async () => {
    const { svc } = make({
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "r1",
            targetType: "COMMENT",
            targetId: "c1",
            reason: null,
            status: "PENDING",
            createdAt: new Date(),
            resolvedAt: null,
            reporter: {
              id: "u1",
              username: "u1",
              displayName: "U1",
              profileAccess: "PUBLIC",
            },
          },
        ]),
      },
      comment: {
        findUnique: jest.fn().mockResolvedValue({
          text: "this is spam",
          deletedAt: null,
          targetType: "MEDIA",
          targetId: "m1",
          author: { username: "spammer" },
        }),
      },
    });
    const page = await svc.list(undefined);
    expect(page.reports[0].target?.label).toContain("spammer");
    expect(page.reports[0].target?.label).toContain("this is spam");
  });

  it("shows a tombstone label for an already-deleted comment", async () => {
    const { svc } = make({
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "r1",
            targetType: "COMMENT",
            targetId: "c1",
            reason: null,
            status: "PENDING",
            createdAt: new Date(),
            resolvedAt: null,
            reporter: {
              id: "u1",
              username: "u1",
              displayName: "U1",
              profileAccess: "PUBLIC",
            },
          },
        ]),
      },
      comment: {
        findUnique: jest.fn().mockResolvedValue({
          text: null,
          deletedAt: new Date(),
          targetType: "MEDIA",
          targetId: "m1",
          author: { username: "spammer" },
        }),
      },
    });
    const page = await svc.list(undefined);
    expect(page.reports[0].target?.label).toContain("commentaire supprimé");
  });
});

describe("ReportService.resolve", () => {
  it("throws when the report is not (still) pending", async () => {
    const { svc } = make({
      report: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    });
    await expect(svc.resolve("admin1", "r1", "RESOLVED")).rejects.toThrow();
  });

  it("marks a pending report resolved", async () => {
    const { svc, prisma } = make();
    await svc.resolve("admin1", "r1", "RESOLVED");
    expect(prisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", status: "PENDING" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedById: "admin1",
        }),
      }),
    );
  });
});
