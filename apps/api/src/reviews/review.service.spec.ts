import type { PrismaService } from "../prisma/prisma.service";
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
  return new ReviewService(prisma, visibility);
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

  it("omits GHOST authors", async () => {
    const svc = make(
      [review("r", { id: "ghost", profileAccess: "GHOST" }, "PUBLIC")],
      {},
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
