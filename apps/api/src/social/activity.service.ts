import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  type ActivityEventDto,
  type ActivityFeedDto,
  type ActivityLevel,
  type ActivityType,
  type Domain,
  VisibilityFacet,
} from "@tracklore/shared";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { resolveFacet } from "./visibility.util";
import { VisibilityService } from "./visibility.service";

/** What a domain service passes to record an activity event. */
export interface EmitActivityInput {
  userId: string;
  type: ActivityType;
  domain: Domain;
  /** "MEDIA" | "GAME" | "BOOK" | "MUSIC". */
  targetType: string;
  /** Internal catalogue item id (MediaItem/GameItem/BookItem/MusicItem). */
  targetId: string;
  level?: ActivityLevel;
  /** Whether it surfaces on followers' home feed (matrix milestone). */
  homeFeed?: boolean;
  data?: Record<string, unknown>;
}

type EventRow = {
  id: string;
  userId: string;
  type: string;
  domain: string;
  targetType: string;
  targetId: string;
  level: string;
  title: string;
  imageUrl: string | null;
  href: string | null;
  data: Prisma.JsonValue;
  createdAt: Date;
};

const PAGE_SIZE = 30;
const PREVIEW_SIZE = 6;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * Records an activity event. Resolves the target's display snapshot itself so
   * callers stay thin. Best-effort: a feed-write failure never breaks the user
   * action that triggered it, so this swallows and logs its own errors.
   */
  async emit(input: EmitActivityInput): Promise<void> {
    try {
      const snap = await this.resolveSnapshot(input.targetType, input.targetId);
      if (!snap) return;

      await this.prisma.activityEvent.create({
        data: {
          userId: input.userId,
          type: input.type,
          domain: input.domain,
          targetType: input.targetType,
          targetId: input.targetId,
          level: input.level ?? "WORK",
          homeFeed: input.homeFeed ?? false,
          title: snap.title,
          imageUrl: snap.imageUrl,
          href: snap.href,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit ${input.type} activity for user ${input.userId}`,
        err,
      );
    }
  }

  /**
   * The home feed: recent `homeFeed` milestones from the users the viewer
   * follows, gated by each actor's Activité audience, aggregated and paginated.
   */
  async homeFeed(
    viewerId: string,
    cursor?: string,
    limit = PAGE_SIZE,
  ): Promise<ActivityFeedDto> {
    const followeeIds = await this.followeeIds(viewerId);
    if (followeeIds.length === 0) return { events: [], nextCursor: null };

    const rows = await this.prisma.activityEvent.findMany({
      where: {
        userId: { in: followeeIds },
        homeFeed: true,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

  /** A short home-page teaser of the home feed. */
  async homePreview(viewerId: string): Promise<ActivityEventDto[]> {
    const feed = await this.homeFeed(viewerId, undefined, PREVIEW_SIZE);
    return feed.events;
  }

  /**
   * A user's profile timeline: everything they did that the viewer may see,
   * filtered per-domain by the actor's Activité audience. The caller has already
   * checked the profile is reachable at all.
   */
  async profileTimeline(
    viewerId: string,
    target: { id: string; profileAccess: string },
    cursor?: string,
    limit = PAGE_SIZE,
  ): Promise<ActivityFeedDto> {
    const rows = await this.prisma.activityEvent.findMany({
      where: {
        userId: target.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

  // --- internals -----------------------------------------------------------

  private async followeeIds(viewerId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: "ACCEPTED" },
      select: { followeeId: true },
    });
    return follows.map((f) => f.followeeId);
  }

  /**
   * Shared feed builder: visibility-gates the raw rows against each actor's
   * Activité audience, aggregates binges, hydrates the actor, and paginates.
   */
  private async buildFeed(
    viewerId: string,
    rows: EventRow[],
    limit: number,
  ): Promise<ActivityFeedDto> {
    const visible = await this.filterVisible(viewerId, rows);
    const hasMore = visible.length > limit;
    const page = visible.slice(0, limit);
    const nextCursor = hasMore
      ? page[page.length - 1].createdAt.toISOString()
      : null;

    const actors = await this.actors(page.map((e) => e.userId));
    const aggregated = aggregate(page);

    const events: ActivityEventDto[] = aggregated.map((e) => ({
      id: e.id,
      type: e.type as ActivityType,
      domain: e.domain as Domain,
      targetType: e.targetType,
      level: e.level as ActivityLevel,
      title: e.title,
      imageUrl: e.imageUrl,
      href: e.href,
      data: (e.data ?? {}) as Record<string, unknown>,
      createdAt: e.createdAt.toISOString(),
      actor: actors.get(e.userId) ?? { username: "", displayName: "" },
      count: e.count,
    }));

    return { events, nextCursor };
  }

  /**
   * Keeps only events whose actor exposes that domain's Activité to the viewer.
   * Relation + settings are resolved once per actor and reused across their
   * events (a feed page spans few actors).
   */
  private async filterVisible(
    viewerId: string,
    rows: EventRow[],
  ): Promise<EventRow[]> {
    const cache = new Map<string, (domain: string) => boolean>();

    const gateFor = async (actorId: string) => {
      const cached = cache.get(actorId);
      if (cached) return cached;

      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, profileAccess: true },
      });

      if (!actor) {
        const deny = () => false;
        cache.set(actorId, deny);
        return deny;
      }

      const [relation, settings] = await Promise.all([
        this.visibility.getRelation(viewerId, actor),
        this.visibility.getSettingsMap(actorId),
      ]);

      const gate = (domain: string) =>
        resolveFacet(
          actor.profileAccess,
          this.visibility.audienceFor(
            settings,
            domain as Domain,
            VisibilityFacet.ACTIVITY,
          ),
          relation,
        );
      cache.set(actorId, gate);
      return gate;
    };

    const kept: EventRow[] = [];

    for (const row of rows) {
      const gate = await gateFor(row.userId);
      if (gate(row.domain)) kept.push(row);
    }

    return kept;
  }

  private async actors(
    ids: string[],
  ): Promise<Map<string, { username: string; displayName: string }>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, username: true, displayName: true },
    });
    return new Map(
      users.map((u) => [
        u.id,
        { username: u.username, displayName: u.displayName },
      ]),
    );
  }

  /** Resolves a work's title/image/detail-link from its internal id. */
  private async resolveSnapshot(
    targetType: string,
    targetId: string,
  ): Promise<{
    title: string;
    imageUrl: string | null;
    href: string | null;
  } | null> {
    const withIds = {
      canonicalSource: true,
      externalIds: { select: { source: true, externalId: true } },
    } as const;

    switch (targetType) {
      case "MEDIA": {
        const i = await this.prisma.mediaItem.findUnique({
          where: { id: targetId },
          select: { title: true, posterUrl: true, type: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.posterUrl,
          href: src ? `/media/${i.type.toLowerCase()}/${src}` : null,
        };
      }

      case "GAME": {
        const i = await this.prisma.gameItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/games/${src}` : null,
        };
      }

      case "BOOK": {
        const i = await this.prisma.bookItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/books/${src}` : null,
        };
      }

      case "MUSIC": {
        const i = await this.prisma.musicItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/music/${src}` : null,
        };
      }

      default:
        return null;
    }
  }
}

/** Collapses consecutive PROGRESS events on the same work into one, counted. */
function aggregate(rows: EventRow[]): (EventRow & { count: number })[] {
  const out: (EventRow & { count: number })[] = [];

  for (const row of rows) {
    const last = out[out.length - 1];

    if (
      last &&
      last.type === "PROGRESS" &&
      row.type === "PROGRESS" &&
      last.userId === row.userId &&
      last.targetId === row.targetId
    ) {
      last.count += 1;
      continue;
    }

    out.push({ ...row, count: 1 });
  }

  return out;
}
