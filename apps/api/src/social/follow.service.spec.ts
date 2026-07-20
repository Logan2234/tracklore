import { NotificationType } from "@tracklore/shared";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { FollowService } from "./follow.service";
import type { VisibilityService } from "./visibility.service";

// Minimal prisma stub: user.findUnique dispatches on whether it's queried by
// username (target/relationship lookups) or id (actor lookup for the payload).
function makeService(opts: {
  targetAccess: "PUBLIC" | "PRIVATE";
  upsertStatus?: "ACCEPTED" | "PENDING";
}) {
  const create = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    user: {
      findUnique: jest.fn(
        ({ where }: { where: { username?: string; id?: string } }) => {
          if (where.username) {
            return Promise.resolve({
              id: "target",
              profileAccess: opts.targetAccess,
            });
          }

          return Promise.resolve({ username: "alice", displayName: "Alice" });
        },
      ),
    },
    block: { findUnique: jest.fn().mockResolvedValue(null) },
    follow: {
      upsert: jest.fn().mockResolvedValue({
        status:
          opts.upsertStatus ??
          (opts.targetAccess === "PUBLIC" ? "ACCEPTED" : "PENDING"),
      }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaService;

  const visibility = {
    getRelation: jest.fn().mockResolvedValue({}),
    toRelationshipDto: jest.fn().mockReturnValue({}),
  } as unknown as VisibilityService;

  const notifications = { create } as unknown as NotificationService;

  return {
    service: new FollowService(prisma, visibility, notifications),
    prisma,
    create,
  };
}

describe("FollowService notifications", () => {
  it("posts a FOLLOW notification when following a public profile", async () => {
    const { service, create } = makeService({ targetAccess: "PUBLIC" });
    await service.follow("viewer", "alice");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "target",
        type: NotificationType.FOLLOW,
        dedupeKey: "follow:viewer",
      }),
    );
  });

  it("posts a FOLLOW_REQUEST notification when requesting a private profile", async () => {
    const { service, create } = makeService({ targetAccess: "PRIVATE" });
    await service.follow("viewer", "alice");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "target",
        type: NotificationType.FOLLOW_REQUEST,
        dedupeKey: "request:viewer",
      }),
    );
  });

  it("posts a FOLLOW_ACCEPTED notification to the requester on approval", async () => {
    const { service, prisma, create } = makeService({
      targetAccess: "PRIVATE",
    });
    (prisma.follow.findUnique as jest.Mock).mockResolvedValue({
      id: "f1",
      followerId: "requester",
      followeeId: "me",
      status: "PENDING",
    });
    await service.acceptRequest("me", "f1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "requester",
        type: NotificationType.FOLLOW_ACCEPTED,
        dedupeKey: "accept:me",
      }),
    );
  });
});
