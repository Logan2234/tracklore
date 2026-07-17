import { Injectable, NotFoundException } from "@nestjs/common";
import type { UserDataExportDto } from "@tracklore/shared";
import { toUserDto } from "../auth/auth.service";
import {
  canonicalExternalId,
  toExternalIdDtos,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Builds the full portable data dump (GDPR "download my data"). Shared by the
 * self-service export (`UsersController.exportData`, always the caller's own
 * account) and the admin-triggered export (`AdminUsersController`, any account) so
 * the two never drift out of sync.
 */
@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildExport(userId: string): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [entries, watches, gameEntries, bookEntries, notifications] =
      await Promise.all([
        this.prisma.libraryEntry.findMany({
          where: { userId },
          include: { mediaItem: { include: { externalIds: true } } },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.episodeWatch.findMany({
          where: { userId },
          include: {
            episode: {
              include: {
                season: {
                  include: { mediaItem: { include: { externalIds: true } } },
                },
              },
            },
          },
          orderBy: { watchedAt: "asc" },
        }),
        this.prisma.gameEntry.findMany({
          where: { userId },
          include: {
            gameItem: { include: { externalIds: true } },
            replays: { orderBy: { finishedAt: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.bookEntry.findMany({
          where: { userId },
          include: {
            bookItem: { include: { externalIds: true } },
            replays: { orderBy: { finishedAt: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: toUserDto(user),
      library: entries.map((entry) => ({
        media: {
          type: entry.mediaItem.type,
          title: entry.mediaItem.title,
          canonicalSource: entry.mediaItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.mediaItem,
            entry.mediaItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.mediaItem.externalIds),
        },
        status: entry.status,
        rating: entry.rating,
        notes: entry.notes,
        favorite: entry.favorite,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      episodeWatches: watches.map((watch) => {
        const media = watch.episode.season.mediaItem;
        return {
          media: {
            type: media.type,
            title: media.title,
            sourceId: canonicalExternalId(media, media.externalIds),
          },
          seasonNumber: watch.episode.season.number,
          episodeNumber: watch.episode.number,
          episodeTitle: watch.episode.title,
          watchedAt: watch.watchedAt.toISOString(),
        };
      }),
      games: gameEntries.map((entry) => ({
        game: {
          title: entry.gameItem.title,
          canonicalSource: entry.gameItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.gameItem,
            entry.gameItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.gameItem.externalIds),
        },
        status: entry.status,
        rating: entry.rating,
        notes: entry.notes,
        favorite: entry.favorite,
        playtimeMinutes: entry.playtimeMinutes,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((r) => r.finishedAt.toISOString()),
      })),
      books: bookEntries.map((entry) => ({
        book: {
          title: entry.bookItem.title,
          authors: entry.bookItem.authors,
          canonicalSource: entry.bookItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.bookItem,
            entry.bookItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.bookItem.externalIds),
        },
        status: entry.status,
        rating: entry.rating,
        notes: entry.notes,
        favorite: entry.favorite,
        currentPage: entry.currentPage,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((r) => r.finishedAt.toISOString()),
      })),
      notifications: notifications.map((n) => ({
        type: n.type,
        mediaTitle: n.mediaTitle,
        mediaType: n.mediaType,
        seasonNumber: n.seasonNumber,
        episodeNumber: n.episodeNumber,
        episodeTitle: n.episodeTitle,
        airDate: n.airDate.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }
}
