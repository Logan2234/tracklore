import type { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";
import type { PushService } from "./push.service";

describe("NotificationService.scanAll", () => {
  function makeService(userIds: string[]) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(userIds.map((id) => ({ id }))),
      },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn() } as never;
    const service = new NotificationService(prisma, push);
    return { service, prisma };
  }

  it("only queries users with in-app notifications enabled", async () => {
    const { service, prisma } = makeService([]);
    await service.scanAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { notifyInApp: true },
      select: { id: true },
    });
  });

  it("scans every eligible user and sums the created count", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const created = await service.scanAll();

    expect(created).toBe(3);
    expect(scan).toHaveBeenCalledTimes(3);
    expect(scan).toHaveBeenNthCalledWith(1, "u1");
    expect(scan).toHaveBeenNthCalledWith(2, "u2");
    expect(scan).toHaveBeenNthCalledWith(3, "u3");
  });

  it("keeps scanning the rest of the batch when one user fails", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(4);

    const created = await service.scanAll();

    expect(created).toBe(5);
    expect(scan).toHaveBeenCalledTimes(3);
  });
});

describe("NotificationService.scan (push)", () => {
  const episode = {
    id: "ep1",
    number: 5,
    title: "The One With The Finale",
    airDate: new Date(),
    season: {
      number: 2,
      mediaItem: {
        title: "Severance",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "42" }],
        entries: [{ createdAt: new Date(0) }],
      },
    },
  };

  function makeService(
    notifyPush: boolean,
    enabledDomains: string[] = ["MEDIA", "BOOKS", "GAMES"],
  ) {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ notifyInApp: true, notifyPush, enabledDomains }),
      },
      episode: { findMany: jest.fn().mockResolvedValue([episode]) },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn() } as unknown as PushService;
    const service = new NotificationService(prisma, push);
    return { service, push, prisma };
  }

  it("sends a push per new notification when notifyPush is enabled", async () => {
    const { service, push } = makeService(true);
    await service.scan("u1");
    expect(push.sendToUser).toHaveBeenCalledWith("u1", {
      title: "Severance",
      body: "S2E5 · The One With The Finale",
      url: "/media/series/42",
    });
  });

  it("skips push entirely when notifyPush is disabled", async () => {
    const { service, push } = makeService(false);
    await service.scan("u1");
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it("creates no episode notifications when the MEDIA domain is disabled", async () => {
    const { service, push, prisma } = makeService(true, ["BOOKS", "GAMES"]);
    const created = await service.scan("u1");
    expect(created).toBe(0);
    // Filtered before any episode lookup or push.
    expect(prisma.episode.findMany).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
