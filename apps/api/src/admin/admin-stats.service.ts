import { Injectable } from "@nestjs/common";
import type {
  AdminStatsDto,
  AdminTrendsDto,
  TrendPeriod,
} from "@tracklore/shared";
import { Domain, MediaType } from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  bucketize,
  cumulativeBucketize,
  trendBucketStarts,
} from "./admin-stats.util";

// Mirrors the 24h refresh TTL in MediaItemService — a freshness proxy only
// (games/books have no periodic refresh cron yet, so they're not counted here).
const MEDIA_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Instance-wide dashboard: cross-account aggregates for the admin Statistiques page. */
  async getStats(): Promise<AdminStatsDto> {
    const [accounts, cache, activity, databaseBytes, weekly] =
      await Promise.all([
        this.accountsStats(),
        this.cacheStats(),
        this.activityStats(),
        this.databaseSize(),
        this.getTrends("week"),
      ]);
    return {
      accounts,
      cache,
      activity,
      databaseBytes,
      generatedAt: weekly.generatedAt,
      trends: weekly.trends,
    };
  }

  private async accountsStats(): Promise<AdminStatsDto["accounts"]> {
    const [total, byDomain, withPush] = await Promise.all([
      this.prisma.user.count(),
      Promise.all(
        Object.values(Domain).map(async (domain) => ({
          domain,
          count: await this.prisma.user.count({
            where: { enabledDomains: { has: domain } },
          }),
        })),
      ),
      this.prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
    ]);
    return { total, byDomain, withPush };
  }

  private async cacheStats(): Promise<AdminStatsDto["cache"]> {
    const [
      mediaByType,
      totalGames,
      totalBooks,
      totalSeasons,
      totalEpisodes,
      staleMediaCount,
    ] = await Promise.all([
      Promise.all(
        Object.values(MediaType).map(async (type) => ({
          type,
          count: await this.prisma.mediaItem.count({ where: { type } }),
        })),
      ),
      this.prisma.gameItem.count(),
      this.prisma.bookItem.count(),
      this.prisma.season.count(),
      this.prisma.episode.count(),
      this.prisma.mediaItem.count({
        where: {
          lastSyncedAt: { lt: new Date(Date.now() - MEDIA_SYNC_TTL_MS) },
        },
      }),
    ]);
    return {
      mediaByType,
      totalGames,
      totalBooks,
      totalSeasons,
      totalEpisodes,
      staleMediaCount,
    };
  }

  private async activityStats(): Promise<AdminStatsDto["activity"]> {
    const [
      totalLibraryEntries,
      totalGameEntries,
      totalBookEntries,
      totalEpisodeWatches,
      totalNotifications,
      totalPushDevices,
    ] = await Promise.all([
      this.prisma.libraryEntry.count(),
      this.prisma.gameEntry.count(),
      this.prisma.bookEntry.count(),
      this.prisma.episodeWatch.count(),
      this.prisma.notification.count(),
      this.prisma.pushSubscription.count(),
    ]);
    return {
      totalLibraryEntries,
      totalGameEntries,
      totalBookEntries,
      totalEpisodeWatches,
      totalNotifications,
      totalPushDevices,
    };
  }

  /**
   * Sum of every app table's on-disk size (data + indexes) — a live snapshot,
   * not tracked over time (see the admin-panel-idea memory for why).
   */
  private async databaseSize(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ bytes: bigint }[]>`
      SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(tablename))), 0)::bigint AS bytes
      FROM pg_tables
      WHERE schemaname = current_schema()
    `;
    return Number(row.bytes);
  }

  /** Trend series for one period — the re-queryable part of the stats page. */
  async getTrends(period: TrendPeriod): Promise<AdminTrendsDto> {
    const now = new Date();
    const starts = trendBucketStarts(period, now);
    const windowStart = starts[0];
    const since = { gte: windowStart };
    const before = { lt: windowStart };

    const [
      mediaCreated,
      gamesCreated,
      booksCreated,
      watches,
      accounts,
      notifications,
      mediaBefore,
      gamesBefore,
      booksBefore,
    ] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      this.prisma.gameItem.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      this.prisma.bookItem.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      this.prisma.episodeWatch.findMany({
        where: { watchedAt: since },
        select: { watchedAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      this.prisma.mediaItem.count({ where: { createdAt: before } }),
      this.prisma.gameItem.count({ where: { createdAt: before } }),
      this.prisma.bookItem.count({ where: { createdAt: before } }),
    ]);

    const catalogDates = [
      ...mediaCreated.map((m) => m.createdAt),
      ...gamesCreated.map((g) => g.createdAt),
      ...booksCreated.map((b) => b.createdAt),
    ];

    return {
      period,
      generatedAt: now.toISOString(),
      trends: {
        catalogGrowth: cumulativeBucketize(
          catalogDates,
          starts,
          mediaBefore + gamesBefore + booksBefore,
        ),
        watchActivity: bucketize(
          watches.map((w) => w.watchedAt),
          starts,
        ),
        newAccounts: bucketize(
          accounts.map((a) => a.createdAt),
          starts,
        ),
        notifications: bucketize(
          notifications.map((n) => n.createdAt),
          starts,
        ),
      },
    };
  }
}
