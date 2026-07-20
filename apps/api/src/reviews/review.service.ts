import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type ReviewDto,
  type ReviewRevisionDto,
  ReviewTargetType,
  type ReviewVisibility,
  type UpsertReviewDto,
  type UserSummaryDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { computeIsFriend } from "../social/visibility.util";
import { VisibilityService } from "../social/visibility.service";

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

    return this.toDto(row, await this.author(userId));
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

  /** Every review the current user has written (newest first). */
  async listMine(userId: string): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    const author = await this.author(userId);
    return rows.map((r) => this.toDto(r, author));
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

  private async author(userId: string): Promise<UserSummaryDto> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTHOR_SELECT,
    }) as Promise<UserSummaryDto>;
  }
}
