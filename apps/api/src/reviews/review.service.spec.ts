import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { ReviewService } from "./review.service";

const VIEWER = "viewer";

function review(
  id: string,
  author: { id: string; profileAccess: string },
  visibility: string,
) {
  return {
    id,
    targetType: "MEDIA",
    targetId: "m1",
    rating: 8,
    text: null,
    visibility,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: author.id,
      username: author.id,
      displayName: author.id,
      profileAccess: author.profileAccess,
    },
  };
}

function relation(over: Partial<ViewerRelation>): ViewerRelation {
  return {
    isSelf: false,
    following: false,
    requested: false,
    followsYou: false,
    isFriend: false,
    blocking: false,
    blockedByTarget: false,
    ...over,
  };
}

function make(rows: unknown[], relations: Record<string, ViewerRelation>) {
  const prisma = {
    review: { findMany: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const visibility = {
    getRelation: jest.fn((_v: string, target: { id: string }) =>
      Promise.resolve(relations[target.id] ?? relation({})),
    ),
  } as unknown as VisibilityService;
  const activity = { emit: jest.fn() } as unknown as ActivityService;
  return new ReviewService(prisma, visibility, activity);
}

describe("ReviewService.listForTarget", () => {
  it("always includes the viewer's own review", async () => {
    const svc = make(
      [review("r", { id: VIEWER, profileAccess: "PRIVATE" }, "FRIENDS")],
      {},
    );
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out.map((r) => r.id)).toEqual(["r"]);
  });

  it("shows a GHOST author's review under their derived pseudonym", async () => {
    const svc = make(
      [review("r", { id: "ghost", profileAccess: "GHOST" }, "FRIENDS")],
      {},
    );
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out).toHaveLength(1);
    expect(out[0].author.anonymized).toBe(true);
    expect(out[0].author.username).toBe("");
    expect(out[0].author.displayName).toMatch(/^Figurant n°\d{6}$/u);
  });

  it("still hides a GHOST author's review from someone they blocked", async () => {
    const svc = make(
      [review("r", { id: "ghost", profileAccess: "GHOST" }, "PUBLIC")],
      { ghost: relation({ blockedByTarget: true }) },
    );
    expect(
      await svc.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
  });

  it("shows a PUBLIC review only when the author's profile is public", async () => {
    const rows = [
      review("pub", { id: "a", profileAccess: "PUBLIC" }, "PUBLIC"),
      review("priv", { id: "b", profileAccess: "PRIVATE" }, "PUBLIC"),
    ];
    const svc = make(rows, {
      a: relation({}),
      b: relation({ following: true }),
    });
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out.map((r) => r.id)).toEqual(["pub"]);
  });

  it("shows a FRIENDS review only to a friend", async () => {
    const rows = [review("r", { id: "a", profileAccess: "PUBLIC" }, "FRIENDS")];
    const stranger = make(rows, { a: relation({ following: true }) }); // not mutual
    expect(
      await stranger.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
    const friend = make(rows, {
      a: relation({ following: true, followsYou: true, isFriend: true }),
    });
    expect(
      await friend.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(1);
  });

  it("omits reviews when either side blocks", async () => {
    const rows = [review("r", { id: "a", profileAccess: "PUBLIC" }, "PUBLIC")];
    const svc = make(rows, { a: relation({ blockedByTarget: true }) });
    expect(
      await svc.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
  });
});

function makeForWrite(
  existing: { rating: number; text: string | null } | null,
) {
  const row = {
    id: "r1",
    rating: 8,
    text: null,
    visibility: "FRIENDS",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const revisionCreate = jest.fn().mockResolvedValue({});
  const prisma = {
    review: {
      findUnique: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
    },
    reviewRevision: { create: revisionCreate },
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ defaultReviewVisibility: "FRIENDS" }),
    },
  } as unknown as PrismaService;
  const activity = { emit: jest.fn() } as unknown as ActivityService;
  const visibility = {} as unknown as VisibilityService;
  const svc = new ReviewService(prisma, visibility, activity);
  return { svc, revisionCreate };
}

describe("ReviewService.upsert — revision snapshotting", () => {
  it("creates a revision when the review is new", async () => {
    const { svc, revisionCreate } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });

  it("creates a revision when rating or text changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 6, text: null });
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });

  it("skips the revision when nothing changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: null });
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: null,
      visibility: "PUBLIC",
    });
    expect(revisionCreate).not.toHaveBeenCalled();
  });

  it("skips the revision when only the visibility changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: "hey" });
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: "hey",
      visibility: "PUBLIC",
    });
    expect(revisionCreate).not.toHaveBeenCalled();
  });
});

describe("ReviewService.setRating — revision snapshotting", () => {
  it("skips the revision when the rating is unchanged", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: null });
    await svc.setRating("u1", "MEDIA" as never, "m1", 8);
    expect(revisionCreate).not.toHaveBeenCalled();
  });

  it("creates a revision when the rating changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 6, text: null });
    await svc.setRating("u1", "MEDIA" as never, "m1", 8);
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });
});
