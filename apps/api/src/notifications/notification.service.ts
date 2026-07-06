import { Injectable } from "@nestjs/common";
import type {
  MediaExternalId,
  MediaItem,
  Notification,
} from "@prisma/client";
import type {
  MediaType,
  NotificationDto,
  NotificationFeedDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { selectNewEpisodeNotifications } from "./notification.util";

/** How far back a scan looks, so following an old show never floods the feed. */
const WINDOW_DAYS = 14;
/** Most recent notifications returned in the feed. */
const FEED_LIMIT = 50;

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect episodes of the user's tracked (non-dropped) shows that aired in the
   * last {@link WINDOW_DAYS} days and create one notification each (idempotent).
   * Returns how many were created.
   */
  async scan(userId: string): Promise<number> {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gt: since, lte: now },
        season: {
          number: { gt: 0 },
          mediaItem: {
            entries: { some: { userId, status: { not: "DROPPED" } } },
          },
        },
      },
      include: {
        season: { include: { mediaItem: { include: { externalIds: true } } } },
      },
    });
    if (episodes.length === 0) return 0;

    const existing = await this.prisma.notification.findMany({
      where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
      select: { episodeId: true },
    });
    const alreadyNotified = new Set(existing.map((n) => n.episodeId));

    const toCreate = selectNewEpisodeNotifications(
      episodes.map((e) => ({
        episodeId: e.id,
        // Non-null: guaranteed by the `airDate` filter above.
        airDate: e.airDate!,
        seasonNumber: e.season.number,
        episodeNumber: e.number,
        episodeTitle: e.title,
        mediaTitle: e.season.mediaItem.title,
        mediaType: e.season.mediaItem.type as MediaType,
        sourceId: canonicalSourceId(e.season.mediaItem),
      })),
      { since, now, alreadyNotified },
    );
    if (toCreate.length === 0) return 0;

    await this.prisma.notification.createMany({
      data: toCreate.map((n) => ({ userId, ...n })),
      skipDuplicates: true,
    });
    return toCreate.length;
  }

  async feed(userId: string): Promise<NotificationFeedDto> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: FEED_LIMIT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { notifications: rows.map(toDto), unread };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

function canonicalSourceId(
  media: MediaItem & { externalIds: MediaExternalId[] },
): string {
  return (
    media.externalIds.find((ext) => ext.source === media.canonicalSource)
      ?.externalId ?? ""
  );
}

function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    mediaTitle: n.mediaTitle,
    mediaType: n.mediaType as MediaType,
    sourceId: n.sourceId,
    seasonNumber: n.seasonNumber,
    episodeNumber: n.episodeNumber,
    episodeTitle: n.episodeTitle,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}
