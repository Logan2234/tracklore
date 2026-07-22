import type { PrismaService } from "../prisma/prisma.service";
import { PrivacyService } from "./privacy.service";
import type { VisibilityService } from "./visibility.service";

function make() {
  const userUpdate = jest.fn().mockResolvedValue(undefined);
  const followersCount = jest.fn().mockResolvedValue(3);
  const outgoingCount = jest.fn().mockResolvedValue(2);
  const listsCount = jest.fn().mockResolvedValue(1);
  const followDeleteMany = jest.fn().mockResolvedValue(undefined);
  const listUpdateMany = jest.fn().mockResolvedValue(undefined);
  const transaction = jest.fn((ops: unknown[]) => Promise.all(ops));

  const prisma = {
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ profileAccess: "PRIVATE" }),
      update: userUpdate,
    },
    follow: {
      count: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) =>
          "followeeId" in where ? followersCount() : outgoingCount(),
        ),
      deleteMany: followDeleteMany,
    },
    list: {
      count: listsCount,
      updateMany: listUpdateMany,
    },
    visibilitySetting: { upsert: jest.fn() },
    $transaction: transaction,
  } as unknown as PrismaService;

  const visibility = {
    getSettingsMap: jest.fn().mockResolvedValue(new Map()),
    audienceFor: jest.fn().mockReturnValue("FRIENDS"),
  } as unknown as VisibilityService;

  return {
    svc: new PrivacyService(prisma, visibility),
    transaction,
    followDeleteMany,
    listUpdateMany,
    userUpdate,
  };
}

describe("PrivacyService.previewGhostSwitch", () => {
  it("returns the live counts of what a switch would affect", async () => {
    const { svc } = make();
    const impact = await svc.previewGhostSwitch("u1");
    expect(impact).toEqual({
      followersToRemove: 3,
      outgoingFollowsToCancel: 2,
      listsToDowngrade: 1,
    });
  });
});

describe("PrivacyService.updateSettings — Figurant switch cleanup", () => {
  it("cleans up follows/lists atomically when switching to GHOST", async () => {
    const { svc, transaction, followDeleteMany, listUpdateMany, userUpdate } =
      make();
    await svc.updateSettings("u1", { profileAccess: "GHOST" as never });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { profileAccess: "GHOST" } }),
    );
    expect(followDeleteMany).toHaveBeenCalledWith({
      where: { followeeId: "u1" },
    });
    expect(followDeleteMany).toHaveBeenCalledWith({
      where: {
        followerId: "u1",
        followee: { profileAccess: { not: "PUBLIC" } },
      },
    });
    expect(listUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", visibility: { not: "PRIVATE" } },
      data: { visibility: "PRIVATE" },
    });
  });

  it("does not run the cleanup when switching to a non-GHOST access", async () => {
    const { svc, followDeleteMany, listUpdateMany } = make();
    await svc.updateSettings("u1", { profileAccess: "PUBLIC" as never });
    expect(followDeleteMany).not.toHaveBeenCalled();
    expect(listUpdateMany).not.toHaveBeenCalled();
  });
});
