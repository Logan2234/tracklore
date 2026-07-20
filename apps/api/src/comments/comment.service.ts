import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type CommentDto,
  type CommentEmote,
  type CommentPageDto,
  type CommentReactionSummaryDto,
  type CommentTargetType,
  COMMENT_REACTION_NOTIFY_THRESHOLD,
  NotificationType,
  type UserSummaryDto,
} from "@tracklore/shared";
import { resolveWorkHref } from "../common/work-href.util";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { VisibilityService } from "../social/visibility.service";
import type { CreateCommentBody } from "./dto/create-comment.dto";
import type { UpdateCommentBody } from "./dto/update-comment.dto";
import { extractMentions } from "./mention.util";

const PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
} as const;

type CommentRow = {
  id: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  authorId: string;
  text: string | null;
  spoilerTag: boolean;
  edited: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: UserSummaryDto;
};

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * A page of top-level comments for a target (oldest first, so a thread reads
   * top-to-bottom), each with its replies attached. Rows from a blocked
   * relationship (either direction) are dropped after the page is fetched, so
   * a page can come back smaller than PAGE_SIZE when blocks are involved —
   * accepted, matches how listForTarget already filters reviews.
   */
  async list(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    cursor?: string,
  ): Promise<CommentPageDto> {
    const rows = await this.prisma.comment.findMany({
      where: { targetType, targetId, parentId: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { author: { select: AUTHOR_SELECT } },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    const visible = await this.filterBlocked(viewerId, page);

    const replyRows = visible.length
      ? await this.prisma.comment.findMany({
          where: { parentId: { in: visible.map((c) => c.id) } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { author: { select: AUTHOR_SELECT } },
        })
      : [];
    const visibleReplies = await this.filterBlocked(viewerId, replyRows);

    const allIds = [...visible, ...visibleReplies].map((c) => c.id);
    const [reactionMap, myReactionMap] = await this.loadReactions(
      viewerId,
      allIds,
    );

    const toDtoWithMask = async (row: CommentRow): Promise<CommentDto> =>
      this.toDto(row, reactionMap, myReactionMap, viewerId);

    const repliesByParent = new Map<string, CommentRow[]>();

    for (const r of visibleReplies) {
      const arr = repliesByParent.get(r.parentId!) ?? [];
      arr.push(r);
      repliesByParent.set(r.parentId!, arr);
    }

    const comments = await Promise.all(
      visible.map(async (c) => {
        const dto = await toDtoWithMask(c);
        dto.replies = await Promise.all(
          (repliesByParent.get(c.id) ?? []).map(toDtoWithMask),
        );
        return dto;
      }),
    );

    return {
      comments,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async create(authorId: string, body: CreateCommentBody): Promise<CommentDto> {
    let parent: { id: string; authorId: string } | null = null;

    if (body.parentId) {
      const found = await this.prisma.comment.findUnique({
        where: { id: body.parentId },
        select: { id: true, authorId: true, parentId: true },
      });

      if (!found || found.parentId) {
        // Flat + one level: replying to a reply is rejected, the client
        // should have offered "reply" only on top-level comments.
        throw new NotFoundException("Parent comment not found");
      }

      parent = { id: found.id, authorId: found.authorId };
    }

    const spoilerTag = body.targetType === "MUSIC" ? false : !!body.spoilerTag;

    const row = await this.prisma.comment.create({
      data: {
        targetType: body.targetType,
        targetId: body.targetId,
        parentId: body.parentId ?? null,
        authorId,
        text: body.text,
        spoilerTag,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    await this.notifyOnCreate(row, parent);

    const [reactionMap, myReactionMap] = await this.loadReactions(authorId, [
      row.id,
    ]);
    const dto = await this.toDto(row, reactionMap, myReactionMap, authorId);
    dto.replies = [];
    return dto;
  }

  async update(
    authorId: string,
    id: string,
    body: UpdateCommentBody,
  ): Promise<CommentDto> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException();
    if (existing.authorId !== authorId) throw new ForbiddenException();

    const spoilerTag =
      existing.targetType === "MUSIC" ? false : !!body.spoilerTag;

    const row = await this.prisma.comment.update({
      where: { id },
      data: { text: body.text, spoilerTag, edited: true },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const [reactionMap, myReactionMap] = await this.loadReactions(authorId, [
      row.id,
    ]);
    const dto = await this.toDto(row, reactionMap, myReactionMap, authorId);
    dto.replies = [];
    return dto;
  }

  /** Soft-delete: clears the text and tombstones the row so replies stay attached. */
  async remove(authorId: string, id: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException();
    if (existing.authorId !== authorId) throw new ForbiddenException();

    await this.prisma.comment.update({
      where: { id },
      data: { text: null, deletedAt: new Date() },
    });
  }

  /** Upserts the viewer's reaction on a comment (a 2nd emote replaces the 1st). */
  async react(
    userId: string,
    commentId: string,
    emote: CommentEmote,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, deletedAt: true, authorId: true },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException();

    await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { emote },
      create: { commentId, userId, emote },
    });

    await this.maybeNotifyReactionThreshold(commentId, comment.authorId);
  }

  async unreact(userId: string, commentId: string): Promise<void> {
    await this.prisma.commentReaction.deleteMany({
      where: { commentId, userId },
    });
  }

  // --- internals ---

  private async filterBlocked(
    viewerId: string,
    rows: CommentRow[],
  ): Promise<CommentRow[]> {
    const visible: CommentRow[] = [];

    for (const row of rows) {
      if (row.authorId === viewerId) {
        visible.push(row);
        continue;
      }

      const relation = await this.visibility.getRelation(viewerId, {
        id: row.author.id,
        profileAccess: row.author.profileAccess,
      });
      if (!relation.blocking && !relation.blockedByTarget) visible.push(row);
    }

    return visible;
  }

  private async loadReactions(
    viewerId: string,
    commentIds: string[],
  ): Promise<
    [Map<string, CommentReactionSummaryDto[]>, Map<string, CommentEmote>]
  > {
    if (commentIds.length === 0) return [new Map(), new Map()];

    const rows = await this.prisma.commentReaction.findMany({
      where: { commentId: { in: commentIds } },
      select: { commentId: true, userId: true, emote: true },
    });

    const counts = new Map<string, Map<CommentEmote, number>>();
    const mine = new Map<string, CommentEmote>();

    for (const r of rows) {
      if (r.userId === viewerId) mine.set(r.commentId, r.emote);
      const byEmote = counts.get(r.commentId) ?? new Map();
      byEmote.set(r.emote, (byEmote.get(r.emote) ?? 0) + 1);
      counts.set(r.commentId, byEmote);
    }

    const summaries = new Map<string, CommentReactionSummaryDto[]>();

    for (const [commentId, byEmote] of counts) {
      summaries.set(
        commentId,
        [...byEmote.entries()].map(([emote, count]) => ({ emote, count })),
      );
    }

    return [summaries, mine];
  }

  private async toDto(
    row: CommentRow,
    reactionMap: Map<string, CommentReactionSummaryDto[]>,
    myReactionMap: Map<string, CommentEmote>,
    viewerId: string,
  ): Promise<CommentDto> {
    const masked = row.deletedAt
      ? false
      : await this.isMasked(
          viewerId,
          row.targetType as CommentTargetType,
          row.targetId,
          row.spoilerTag,
        );

    return {
      id: row.id,
      targetType: row.targetType as CommentTargetType,
      targetId: row.targetId,
      parentId: row.parentId,
      text: row.deletedAt ? null : row.text,
      deleted: !!row.deletedAt,
      edited: row.edited,
      spoilerTag: row.spoilerTag,
      masked,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.author,
      reactions: reactionMap.get(row.id) ?? [],
      myReaction: myReactionMap.get(row.id) ?? null,
      replies: [],
    };
  }

  /**
   * Whether a comment should render blurred for `viewerId` right now: the
   * manual tag, or an auto progression-based gate. SEASON/EPISODE compare
   * against actually-watched episodes; MEDIA/GAME/BOOK fall back to a binary
   * "has the viewer finished this work" check (no finer sub-target to compare
   * progress against at that level — a coarser, accepted tradeoff). MUSIC is
   * never masked (no narrative to spoil).
   */
  private async isMasked(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    spoilerTag: boolean,
  ): Promise<boolean> {
    if (targetType === "MUSIC") return false;
    if (spoilerTag) return true;

    if (targetType === "EPISODE") {
      const watched = await this.prisma.episodeWatch.findFirst({
        where: { userId: viewerId, episodeId: targetId },
        select: { id: true },
      });
      return !watched;
    }

    if (targetType === "SEASON") {
      const season = await this.prisma.season.findUnique({
        where: { id: targetId },
        select: { episodes: { select: { id: true } } },
      });
      if (!season || season.episodes.length === 0) return false;
      const watchedEpisodes = await this.prisma.episodeWatch.findMany({
        where: {
          userId: viewerId,
          episodeId: { in: season.episodes.map((e) => e.id) },
        },
        distinct: ["episodeId"],
        select: { episodeId: true },
      });
      return watchedEpisodes.length < season.episodes.length;
    }

    if (targetType === "MEDIA") {
      const entry = await this.prisma.libraryEntry.findUnique({
        where: {
          userId_mediaItemId: { userId: viewerId, mediaItemId: targetId },
        },
        select: { finishedAt: true },
      });
      return !entry?.finishedAt;
    }

    if (targetType === "GAME") {
      const entry = await this.prisma.gameEntry.findUnique({
        where: {
          userId_gameItemId: { userId: viewerId, gameItemId: targetId },
        },
        select: { finishedAt: true },
      });
      return !entry?.finishedAt;
    }

    // BOOK
    const entry = await this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId: viewerId, bookItemId: targetId } },
      select: { finishedAt: true },
    });
    return !entry?.finishedAt;
  }

  private async notifyOnCreate(
    row: CommentRow,
    parent: { id: string; authorId: string } | null,
  ): Promise<void> {
    const notifiedIds = new Set<string>([row.authorId]);

    if (parent && !notifiedIds.has(parent.authorId)) {
      if (await this.mayNotify(row.authorId, parent.authorId)) {
        await this.notify(parent.authorId, row, NotificationType.COMMENT_REPLY);
        notifiedIds.add(parent.authorId);
      }
    }

    const mentions = extractMentions(row.text ?? "");
    if (mentions.length === 0) return;

    const mentioned = await this.prisma.user.findMany({
      where: { username: { in: mentions } },
      select: { id: true },
    });

    for (const { id: userId } of mentioned) {
      if (notifiedIds.has(userId)) continue;

      if (await this.mayNotify(row.authorId, userId)) {
        await this.notify(userId, row, NotificationType.COMMENT_MENTION);
        notifiedIds.add(userId);
      }
    }
  }

  /** A block in either direction neutralizes the notification. */
  private async mayNotify(
    actorId: string,
    recipientId: string,
  ): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: actorId },
        ],
      },
      select: { id: true },
    });
    return !block;
  }

  private async notify(
    recipientId: string,
    row: CommentRow,
    type:
      | typeof NotificationType.COMMENT_REPLY
      | typeof NotificationType.COMMENT_MENTION,
  ): Promise<void> {
    const url = await resolveWorkHref(
      this.prisma,
      row.targetType,
      row.targetId,
    );
    const excerpt = (row.text ?? "").slice(0, EXCERPT_LENGTH);

    await this.notifications.create({
      userId: recipientId,
      type,
      title: row.author.displayName,
      body: excerpt,
      url,
      dedupeKey: `${type.toLowerCase()}:${row.id}:${recipientId}`,
      data: {
        actorUsername: row.author.username,
        actorDisplayName: row.author.displayName,
      },
    });
  }

  private async maybeNotifyReactionThreshold(
    commentId: string,
    authorId: string,
  ): Promise<void> {
    const count = await this.prisma.commentReaction.count({
      where: { commentId },
    });
    if (count !== COMMENT_REACTION_NOTIFY_THRESHOLD) return;

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { targetType: true, targetId: true },
    });
    if (!comment) return;

    const url = await resolveWorkHref(
      this.prisma,
      comment.targetType,
      comment.targetId,
    );

    await this.notifications.create({
      userId: authorId,
      type: NotificationType.COMMENT_REACTIONS,
      title: "Ton commentaire fait réagir",
      body: `${COMMENT_REACTION_NOTIFY_THRESHOLD} réactions`,
      url,
      dedupeKey: `reactions:${commentId}:${COMMENT_REACTION_NOTIFY_THRESHOLD}`,
    });
  }
}
