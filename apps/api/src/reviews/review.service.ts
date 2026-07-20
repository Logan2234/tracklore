import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type MyReviewDto,
  type ReviewDto,
  type ReviewRevisionDto,
  type ReviewTargetSummaryDto,
  ReviewTargetType,
  type ReviewVisibility,
  type UpsertReviewDto,
  type UserSummaryDto,
} from "@tracklore/shared";
import { ActivityType, type Domain } from "@tracklore/shared";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { computeIsFriend } from "../social/visibility.util";
import { VisibilityService } from "../social/visibility.service";

/** Feed domain for a review target ("GAME" work lives in the GAMES domain…). */
const DOMAIN_BY_TARGET: Record<string, Domain> = {
  MEDIA: "MEDIA",
  SEASON: "MEDIA",
  EPISODE: "MEDIA",
  GAME: "GAMES",
  BOOK: "BOOKS",
  MUSIC: "MUSIC",
};

type ReviewRow = {
  id: string;
  targetType: string;
  targetId: string;
  rating: number;
  text: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
} as const;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly activity: ActivityService,
  ) {}

  private toDto(row: ReviewRow, author: UserSummaryDto): ReviewDto {
    return {
      id: row.id,
      targetType: row.targetType as ReviewTargetType,
      targetId: row.targetId,
      rating: row.rating,
      text: row.text,
      visibility: row.visibility as ReviewVisibility,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author,
    };
  }

  /** The current user's own review for a target, or null. Always available. */
  async getMine(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<ReviewDto | null> {
    const row = await this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
    if (!row) return null;
    const author = await this.author(userId);
    return this.toDto(row, author);
  }

  /**
   * Creates or updates the user's review for a target, snapshotting the new
   * state as a revision. Not social-gated — rating your own items always works.
   */
  async upsert(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
    dto: UpsertReviewDto,
  ): Promise<ReviewDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { defaultReviewVisibility: true },
    });
    const visibility = dto.visibility ?? user.defaultReviewVisibility;
    const text = dto.text ?? null;

    const row = await this.prisma.review.upsert({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
      update: { rating: dto.rating, text, visibility },
      create: {
        userId,
        targetType,
        targetId,
        rating: dto.rating,
        text,
        visibility,
      },
    });
    await this.prisma.reviewRevision.create({
      data: { reviewId: row.id, rating: dto.rating, text },
    });

    await this.emitReviewed(userId, targetType, targetId, dto.rating);

    return this.toDto(row, await this.author(userId));
  }

  /**
   * Bulk-deletes several of the user's reviews by review id (revisions
   * cascade). Scoped to `userId`, so unknown/foreign ids are silently ignored.
   * Returns the number actually deleted.
   */
  async removeMany(userId: string, ids: string[]): Promise<number> {
    const { count } = await this.prisma.review.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return count;
  }

  /**
   * Bulk-changes the audience of several of the user's reviews by review id.
   * Visibility isn't part of the revision snapshot (which tracks rating/text),
   * so no revision is recorded. Returns the number actually updated.
   */
  async setVisibilityMany(
    userId: string,
    ids: string[],
    visibility: ReviewVisibility,
  ): Promise<number> {
    const { count } = await this.prisma.review.updateMany({
      where: { id: { in: ids }, userId },
      data: { visibility },
    });
    return count;
  }

  /** Deletes the user's review for a target (revisions cascade). */
  async remove(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<void> {
    const { count } = await this.prisma.review.deleteMany({
      where: { userId, targetType, targetId },
    });
    if (count === 0) throw new NotFoundException();
  }

  /** The edit history of the user's own review (newest first). */
  async revisions(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<ReviewRevisionDto[]> {
    const review = await this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
      select: { id: true },
    });
    if (!review) return [];
    const rows = await this.prisma.reviewRevision.findMany({
      where: { reviewId: review.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Every review the current user has written (newest first), with targets. */
  async listMine(userId: string): Promise<MyReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    const [author, targets] = await Promise.all([
      this.author(userId),
      this.resolveTargets(rows),
    ]);
    return rows.map((r) => ({
      ...this.toDto(r, author),
      target: targets.get(`${r.targetType}:${r.targetId}`) ?? null,
    }));
  }

  /**
   * Resolves display info (title + image) for the work each review targets,
   * batched per type. SEASON/EPISODE aren't creatable from the UI yet, so they
   * fall back to a null target (rendered generically).
   */
  private async resolveTargets(
    rows: { targetType: string; targetId: string }[],
  ): Promise<Map<string, ReviewTargetSummaryDto>> {
    const idsByType = new Map<string, string[]>();

    for (const r of rows) {
      const arr = idsByType.get(r.targetType) ?? [];
      arr.push(r.targetId);
      idsByType.set(r.targetType, arr);
    }

    const map = new Map<string, ReviewTargetSummaryDto>();
    const canonicalExternalIdInclude = {
      canonicalSource: true,
      externalIds: { select: { source: true, externalId: true } },
    } as const;

    const add = (
      type: string,
      items: {
        id: string;
        title: string;
        image: string | null;
        href: string | null;
      }[],
    ) => {
      for (const i of items) {
        map.set(`${type}:${i.id}`, {
          title: i.title,
          imageUrl: i.image,
          href: i.href,
        });
      }
    };

    const mediaIds = idsByType.get(ReviewTargetType.MEDIA);

    if (mediaIds?.length) {
      const items = await this.prisma.mediaItem.findMany({
        where: { id: { in: mediaIds } },
        select: {
          id: true,
          title: true,
          posterUrl: true,
          type: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        ReviewTargetType.MEDIA,
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.posterUrl,
          href: this.detailHref(
            "media",
            canonicalExternalId(i, i.externalIds),
            i.type.toLowerCase(),
          ),
        })),
      );
    }

    const gameIds = idsByType.get(ReviewTargetType.GAME);

    if (gameIds?.length) {
      const items = await this.prisma.gameItem.findMany({
        where: { id: { in: gameIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        ReviewTargetType.GAME,
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("games", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    const bookIds = idsByType.get(ReviewTargetType.BOOK);

    if (bookIds?.length) {
      const items = await this.prisma.bookItem.findMany({
        where: { id: { in: bookIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        ReviewTargetType.BOOK,
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("books", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    const musicIds = idsByType.get(ReviewTargetType.MUSIC);

    if (musicIds?.length) {
      const items = await this.prisma.musicItem.findMany({
        where: { id: { in: musicIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        ReviewTargetType.MUSIC,
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("music", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    return map;
  }

  /**
   * Builds the client route to a work's detail page from its canonical source
   * id. Media nests the type (`/media/movie/42`); the others are flat. Returns
   * null when the source id is missing (no browsable target).
   */
  private detailHref(
    domain: "media" | "games" | "books" | "music",
    sourceId: string,
    mediaType?: string,
  ): string | null {
    if (!sourceId) return null;
    return domain === "media"
      ? `/media/${mediaType}/${sourceId}`
      : `/${domain}/${sourceId}`;
  }

  /**
   * Reviews others have written for a target, visible to the viewer. Social-
   * gated at the controller. Filters by each author's relationship and the
   * review's own audience; GHOST authors are omitted for now.
   */
  async listForTarget(
    viewerId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: { targetType, targetId },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: AUTHOR_SELECT } },
    });

    const visible: ReviewDto[] = [];

    for (const row of rows) {
      const author = row.user;

      if (author.id === viewerId) {
        visible.push(this.toDto(row, author));
        continue;
      }

      if (author.profileAccess === "GHOST") continue;
      const relation = await this.visibility.getRelation(viewerId, author);
      if (relation.blocking || relation.blockedByTarget) continue;
      const ok =
        row.visibility === "PUBLIC"
          ? author.profileAccess === "PUBLIC"
          : computeIsFriend(
              author.profileAccess,
              relation.following,
              relation.followsYou,
            );
      if (ok) visible.push(this.toDto(row, author));
    }

    return visible;
  }

  // --- Rating projection for the library services (entry DTOs keep `rating`,
  //     now sourced from Review). ---

  /** The user's ratings for many targets of one type, keyed by targetId. */
  async getRatings(
    userId: string,
    targetType: ReviewTargetType,
    targetIds: string[],
  ): Promise<Map<string, number>> {
    if (targetIds.length === 0) return new Map();
    const rows = await this.prisma.review.findMany({
      where: { userId, targetType, targetId: { in: targetIds } },
      select: { targetId: true, rating: true },
    });
    return new Map(rows.map((r) => [r.targetId, r.rating]));
  }

  /** The user's rating for a single target, or null. */
  async getRating(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<number | null> {
    const row = await this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
      select: { rating: true },
    });
    return row?.rating ?? null;
  }

  /**
   * Sets only the rating for a target, preserving any existing review text and
   * audience, and recording a revision. `null` removes the review entirely (a
   * review can't exist without a rating). Not social-gated.
   */
  async setRating(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
    rating: number | null,
  ): Promise<void> {
    if (rating === null) {
      await this.prisma.review.deleteMany({
        where: { userId, targetType, targetId },
      });
      return;
    }

    const existing = await this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
      select: { text: true },
    });

    if (existing) {
      const row = await this.prisma.review.update({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        data: { rating },
      });
      await this.prisma.reviewRevision.create({
        data: { reviewId: row.id, rating, text: existing.text },
      });
    } else {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { defaultReviewVisibility: true },
      });
      const row = await this.prisma.review.create({
        data: {
          userId,
          targetType,
          targetId,
          rating,
          visibility: user.defaultReviewVisibility,
        },
      });
      await this.prisma.reviewRevision.create({
        data: { reviewId: row.id, rating },
      });
    }

    await this.emitReviewed(userId, targetType, targetId, rating);
  }

  /**
   * Records a REVIEWED activity event for a review write (from either the full
   * editor or the quick-rating path). A work-level review is a home-feed
   * milestone; season/episode reviews stay on the profile timeline (per the
   * feed matrix). No-op for unknown target types.
   */
  private async emitReviewed(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
    rating: number,
  ): Promise<void> {
    const domain = DOMAIN_BY_TARGET[targetType];
    if (!domain) return;

    const level =
      targetType === "SEASON"
        ? "SEASON"
        : targetType === "EPISODE"
          ? "EPISODE"
          : "WORK";

    await this.activity.emit({
      userId,
      type: ActivityType.REVIEWED,
      domain,
      targetType,
      targetId,
      level,
      homeFeed: level === "WORK",
      data: { rating },
    });
  }

  private async author(userId: string): Promise<UserSummaryDto> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTHOR_SELECT,
    }) as Promise<UserSummaryDto>;
  }
}
