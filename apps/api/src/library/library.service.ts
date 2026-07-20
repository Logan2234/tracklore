import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ExternalSource as DbExternalSource,
  LibraryEntry,
  MediaExternalId,
  MediaItem,
  Prisma,
} from "@prisma/client";
import type {
  CalendarEntryDto,
  CatalogSource,
  EntryEpisodesResponseDto,
  EntryStatus,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaDetailDto,
  MediaItemDto,
  MediaType,
  PagedResult,
  ProgressDto,
  StatsDto,
} from "@tracklore/shared";
import { ActivityType, isDormant, ReviewTargetType } from "@tracklore/shared";
import { MediaItemService } from "../catalog/media-item.service";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
import { ActivityService } from "../social/activity.service";
import { AgeGateService } from "../users/age-gate.service";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
import { deriveStatus, normalizeAiringFinished } from "./status.util";
import { aggregateStats } from "./stats.util";

// Reused include: entries always need the media + its external IDs (sourceId).
// `satisfies` (not a type annotation) keeps the literal shape so Prisma can
// still infer the joined payload type from it.
const ENTRY_INCLUDE = {
  mediaItem: { include: { externalIds: true } },
} satisfies Prisma.LibraryEntryInclude;

/** LibraryEntry joined with its media and the media's external IDs. */
type EntryWithMedia = Prisma.LibraryEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

const PAGE_SIZE = 40;

type MediaSortKey =
  | "recent"
  | "added"
  | "title"
  | "rating"
  | "progress"
  | "finished"
  | "started"
  | "status";
const MEDIA_SORT_KEYS: MediaSortKey[] = [
  "recent",
  "added",
  "title",
  "rating",
  "progress",
  "finished",
  "started",
  "status",
];
// Order used by the "Statut" sort.
const MEDIA_STATUS_SORT_ORDER: EntryStatus[] = [
  "WATCHING",
  "PLANNED",
  "UP_TO_DATE",
  "COMPLETED",
  "DROPPED",
];

export interface ListEntriesFilters {
  q?: string;
  favorite?: boolean;
  /** "DORMANT" is accepted alongside real `EntryStatus` values — see `isDormant`. */
  statuses?: string[];
  types?: MediaType[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function mediaProgressPct(entry: LibraryEntryDto): number {
  if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
  return Math.round(
    (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
  );
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareMediaEntries(
  sort: MediaSortKey,
  a: LibraryEntryDto,
  b: LibraryEntryDto,
): number {
  switch (sort) {
    case "title":
      return a.mediaItem.title.localeCompare(b.mediaItem.title, "fr");
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "progress":
      return mediaProgressPct(b) - mediaProgressPct(a);
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "started":
      return timeMs(b.startedAt) - timeMs(a.startedAt);
    case "status":
      return (
        MEDIA_STATUS_SORT_ORDER.indexOf(a.status) -
        MEDIA_STATUS_SORT_ORDER.indexOf(b.status)
      );
    case "added":
      return b.createdAt.localeCompare(a.createdAt);
    case "recent":
      return timeMs(b.lastWatchedAt) - timeMs(a.lastWatchedAt);
  }
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
  ) {}

  /** First touch of a media persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertEntryDto,
  ): Promise<LibraryEntryDto> {
    const mediaItem = await this.mediaItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
      dto.type,
    );

    const before = await this.prisma.libraryEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      update: changes,
      create: { userId, mediaItemId: mediaItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, mediaItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    // The /10 rating lives in Review (the single source of truth).
    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
        dto.rating,
      );
    }

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, mediaItem.id),
      await this.lastWatchedAt(userId, mediaItem.id),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
      ),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<LibraryEntryDto>> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        mediaItem:
          filters.types && filters.types.length > 0
            ? { type: { in: filters.types } }
            : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MEDIA,
      entries.map((e) => e.mediaItemId),
    );
    const dtos = await Promise.all(
      entries.map(async (entry) =>
        this.toEntryDto(
          entry,
          await this.computeProgress(userId, entry.mediaItemId),
          await this.lastWatchedAt(userId, entry.mediaItemId),
          ratings.get(entry.mediaItemId) ?? null,
        ),
      ),
    );

    // Status is derived, so filter on the effective status, not the stored
    // one — "DORMANT" is a synthetic refinement of WATCHING (see isDormant).
    const q = filters.q?.trim().toLowerCase();
    const filtered = dtos.filter((dto) => {
      if (
        filters.statuses &&
        filters.statuses.length > 0 &&
        !filters.statuses.some((s) =>
          s === "DORMANT" ? isDormant(dto) : dto.status === s,
        )
      )
        return false;
      if (filters.favorite && !dto.favorite) return false;
      if (q && !dto.mediaItem.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sort = MEDIA_SORT_KEYS.includes(filters.sort as MediaSortKey)
      ? (filters.sort as MediaSortKey)
      : "recent";
    const asc = filters.order === "asc";
    filtered.sort((a, b) => {
      const c = compareMediaEntries(sort, a, b);
      return asc ? -c : c;
    });

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const start = (page - 1) * PAGE_SIZE;
    return {
      items: filtered.slice(start, start + PAGE_SIZE),
      total: filtered.length,
      hasMore: filtered.length > page * PAGE_SIZE,
    };
  }

  async getEntry(userId: string, entryId: string): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.libraryEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, entry.mediaItemId),
      await this.lastWatchedAt(userId, entry.mediaItemId),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
      ),
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateEntryDto,
  ): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const before = await this.prisma.libraryEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true },
    });

    const entry = await this.prisma.libraryEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: dto.ownershipSource,
      },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, entry.mediaItemId, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
        dto.rating,
      );
    }

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, entry.mediaItemId),
      await this.lastWatchedAt(userId, entry.mediaItemId),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
      ),
    );
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.libraryEntry.delete({ where: { id: entryId } });
  }

  /**
   * Emits the activity events for a media entry write: a status milestone (via
   * the shared transition rules) and, separately, a FAVORITED event when a work
   * is newly favourited (profile-timeline only, per the matrix).
   */
  private async emitEntryActivity(
    userId: string,
    mediaItemId: string,
    change: {
      prevStatus: string | null;
      nextStatus: string;
      prevFavorite: boolean;
      nextFavorite: boolean;
    },
  ): Promise<void> {
    const transition = classifyStatusTransition(
      "MEDIA",
      change.prevStatus,
      change.nextStatus,
    );

    if (transition) {
      await this.activity.emit({
        userId,
        type: transition.type,
        domain: "MEDIA",
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        homeFeed: transition.homeFeed,
      });
    }

    if (change.nextFavorite && !change.prevFavorite) {
      await this.activity.emit({
        userId,
        type: ActivityType.FAVORITED,
        domain: "MEDIA",
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        homeFeed: false,
      });
    }
  }

  /** Persisted seasons/episodes of an entry's media, with the user's watch counts. */
  async getEntryEpisodes(
    userId: string,
    entryId: string,
  ): Promise<EntryEpisodesResponseDto> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: entry.mediaItemId },
      orderBy: { number: "asc" },
      include: {
        episodes: {
          orderBy: { number: "asc" },
          include: { watches: { where: { userId }, select: { id: true } } },
        },
      },
    });

    return {
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          watchCount: episode.watches.length,
        })),
      })),
    };
  }

  async watchEpisode(
    userId: string,
    episodeId: string,
    dto: WatchEpisodeDto,
  ): Promise<EpisodeWatchDto> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
    });

    if (!episode) {
      throw new NotFoundException("Episode not found");
    }

    if (episode.airDate && episode.airDate > new Date()) {
      throw new BadRequestException("Cet épisode n'est pas encore sorti");
    }

    const watch = await this.prisma.episodeWatch.create({
      data: {
        userId,
        episodeId,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : undefined,
      },
    });
    return {
      id: watch.id,
      episodeId: watch.episodeId,
      watchedAt: watch.watchedAt.toISOString(),
    };
  }

  /**
   * Mark every not-yet-watched episode of a season as watched in one go.
   * Already-watched episodes are skipped so this never inflates rewatch counts.
   */
  async watchSeason(userId: string, seasonId: string): Promise<void> {
    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true, airDate: true },
    });

    if (episodes.length === 0) {
      throw new NotFoundException("Season not found or has no episodes");
    }

    // Unreleased episodes (future airDate) are silently skipped rather than
    // blocking the whole season.
    const now = new Date();
    const airedIds = episodes
      .filter((e) => !e.airDate || e.airDate <= now)
      .map((e) => e.id);
    await this.markUnwatched(userId, airedIds);
  }

  /**
   * "Watch up to here": mark every regular episode of the series from the start
   * up to and including the given one (specials excluded — they are not part of
   * the linear run). If the target itself is a special, only it is marked.
   */
  async watchThrough(userId: string, episodeId: string): Promise<void> {
    const target = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { season: true },
    });

    if (!target) {
      throw new NotFoundException("Episode not found");
    }

    if (target.airDate && target.airDate > new Date()) {
      throw new BadRequestException("Cet épisode n'est pas encore sorti");
    }

    if (target.season.number === 0) {
      await this.markUnwatched(userId, [episodeId]);
      return;
    }

    const episodes = await this.prisma.episode.findMany({
      where: {
        season: { mediaItemId: target.season.mediaItemId, number: { gt: 0 } },
      },
      select: {
        id: true,
        number: true,
        airDate: true,
        season: { select: { number: true } },
      },
    });
    const now = new Date();
    const throughIds = episodes
      .filter(
        (e) =>
          (e.season.number < target.season.number ||
            (e.season.number === target.season.number &&
              e.number <= target.number)) &&
          (!e.airDate || e.airDate <= now),
      )
      .map((e) => e.id);
    await this.markUnwatched(userId, throughIds);
  }

  /** Create a watch for each of the given episodes the user hasn't watched yet. */
  private async markUnwatched(
    userId: string,
    episodeIds: string[],
  ): Promise<void> {
    if (episodeIds.length === 0) return;
    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodeIds } },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const watchedIds = new Set(watched.map((w) => w.episodeId));
    const toCreate = episodeIds
      .filter((id) => !watchedIds.has(id))
      .map((id) => ({ userId, episodeId: id }));

    if (toCreate.length > 0) {
      await this.prisma.episodeWatch.createMany({ data: toCreate });
    }
  }

  /**
   * Upcoming episodes (air date today or later) of the series/anime the user
   * tracks, excluding dropped ones — the release calendar.
   */
  async getCalendar(userId: string): Promise<CalendarEntryDto[]> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gte: startOfToday },
        season: {
          mediaItem: {
            entries: { some: { userId, status: { not: "DROPPED" } } },
          },
        },
      },
      orderBy: { airDate: "asc" },
      take: 60,
      include: {
        season: {
          include: { mediaItem: { include: { externalIds: true } } },
        },
      },
    });

    return episodes.map((episode) => ({
      mediaItem: toMediaItemDto(episode.season.mediaItem),
      seasonNumber: episode.season.number,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      // airDate is guaranteed non-null by the `gte` filter above.
      airDate: episode.airDate!.toISOString(),
    }));
  }

  /** Aggregated viewing statistics for the profile's stats page. */
  async getStats(userId: string): Promise<StatsDto> {
    const [watches, entries] = await Promise.all([
      this.prisma.episodeWatch.findMany({
        where: { userId },
        select: {
          episode: {
            select: {
              season: {
                select: {
                  number: true,
                  mediaItem: {
                    select: { type: true, genres: true, runtimeMin: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.libraryEntry.findMany({
        where: { userId },
        select: {
          status: true,
          mediaItem: { select: { type: true, genres: true, runtimeMin: true } },
        },
      }),
    ]);

    return aggregateStats(
      watches.map((w) => ({
        seasonNumber: w.episode.season.number,
        type: w.episode.season.mediaItem.type as MediaType,
        genres: w.episode.season.mediaItem.genres,
        runtimeMin: w.episode.season.mediaItem.runtimeMin,
      })),
      entries.map((e) => ({
        type: e.mediaItem.type as MediaType,
        status: e.status as EntryStatus,
        genres: e.mediaItem.genres,
        runtimeMin: e.mediaItem.runtimeMin,
      })),
    );
  }

  /**
   * Undo watching an episode: removes the user's most recent watch for it
   * (so it decrements a rewatch count, and unwatches the episode at one watch).
   */
  async unwatchEpisode(userId: string, episodeId: string): Promise<void> {
    const latest = await this.prisma.episodeWatch.findFirst({
      where: { userId, episodeId },
      orderBy: { watchedAt: "desc" },
    });

    if (!latest) {
      throw new NotFoundException("No watch to undo for this episode");
    }

    await this.prisma.episodeWatch.delete({ where: { id: latest.id } });
  }

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<LibraryEntry> {
    const entry = await this.prisma.libraryEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException("Library entry not found");
    }

    if (entry.userId !== userId) {
      throw new ForbiddenException("This entry belongs to another user");
    }

    return entry;
  }

  /**
   * Season 0 holds specials on TMDB: they are watchable but excluded from the
   * watched/total progress so "100%" means the regular run is complete.
   */
  private async computeProgress(
    userId: string,
    mediaItemId: string,
  ): Promise<ProgressDto | null> {
    const regularEpisodes: Prisma.EpisodeWhereInput = {
      season: { mediaItemId, number: { gt: 0 } },
    };

    const episodes = await this.prisma.episode.findMany({
      where: regularEpisodes,
      orderBy: [{ season: { number: "asc" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        airDate: true,
        season: { select: { number: true } },
      },
    });

    if (episodes.length === 0) {
      return null; // Movies (or media without any episode listing).
    }

    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episode: regularEpisodes },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const watchedIds = new Set(watched.map((w) => w.episodeId));

    // Next up: first unwatched episode that has aired (null airDate = AniList's
    // generated episodes, treated as available).
    const now = new Date();
    const next = episodes.find(
      (e) => !watchedIds.has(e.id) && (e.airDate === null || e.airDate <= now),
    );

    return {
      watchedEpisodes: watchedIds.size,
      totalEpisodes: episodes.length,
      nextEpisode: next
        ? {
            episodeId: next.id,
            seasonNumber: next.season.number,
            episodeNumber: next.number,
          }
        : null,
    };
  }

  /** Most recent viewing of a media (max episode watch), or null if never. */
  private async lastWatchedAt(
    userId: string,
    mediaItemId: string,
  ): Promise<Date | null> {
    const agg = await this.prisma.episodeWatch.aggregate({
      where: { userId, episode: { season: { mediaItemId } } },
      _max: { watchedAt: true },
    });
    return agg._max.watchedAt;
  }

  private toEntryDto(
    entry: EntryWithMedia,
    progress: ProgressDto | null,
    watchedAt: Date | null,
    rating: number | null,
  ): LibraryEntryDto {
    const media = entry.mediaItem;
    const status = deriveStatus(
      media.type,
      progress,
      normalizeAiringFinished(media.status),
      entry.status,
    );
    // Movies have no episode watches: fall back to when it was marked finished.
    const lastWatchedAt = watchedAt ?? entry.finishedAt;
    return {
      id: entry.id,
      mediaItem: toMediaItemDto(media),
      status,
      rating,
      notes: entry.notes,
      favorite: entry.favorite,
      startedAt: entry.startedAt?.toISOString() ?? null,
      finishedAt: entry.finishedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      lastWatchedAt: lastWatchedAt?.toISOString() ?? null,
      progress,
      ownershipStatus: entry.ownershipStatus,
      ownershipSource: entry.ownershipSource,
    };
  }

  /**
   * Unified media page (`/media/{type}/{id}`): metadata + the current user's
   * library state in one call. Served from the cache when the media is already
   * persisted, otherwise fetched live (persisting nothing — an unreferenced
   * media must not enter the on-demand cache just because it was previewed).
   */
  async getMediaDetail(
    userId: string,
    type: MediaType,
    sourceId: string,
  ): Promise<MediaDetailDto> {
    const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";

    const ref = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId_type: {
          source: source as DbExternalSource,
          externalId: sourceId,
          type,
        },
      },
      include: { mediaItem: true },
    });

    if (ref) {
      const detail = await this.mediaDetailFromCache(
        userId,
        source,
        sourceId,
        ref.mediaItem,
      );
      const allowAdult = await this.ageGate.allowsAdultContent(userId);
      this.ageGate.assertAdultAllowed(detail.isAdult, allowAdult);
      return detail;
    }

    const details = await this.mediaItemService.getLiveDetails(
      source,
      sourceId,
      type,
    );
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    this.ageGate.assertAdultAllowed(details.isAdult, allowAdult);
    return {
      source,
      sourceId,
      type,
      title: details.title,
      originalTitle: details.originalTitle ?? null,
      year: details.year,
      posterUrl: details.posterUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      genres: details.genres,
      airingStatus: details.status,
      airingFinished: normalizeAiringFinished(details.status),
      isAdult: details.isAdult,
      seasons: details.seasons.map((season) => ({
        id: null,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: null,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate,
          watchCount: 0,
          watches: [],
        })),
      })),
      entry: null,
    };
  }

  private async mediaDetailFromCache(
    userId: string,
    source: CatalogSource,
    sourceId: string,
    media: MediaItem,
  ): Promise<MediaDetailDto> {
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      orderBy: { number: "asc" },
      include: {
        episodes: {
          orderBy: { number: "asc" },
          include: {
            watches: {
              where: { userId },
              orderBy: { watchedAt: "desc" },
              select: { id: true, watchedAt: true },
            },
          },
        },
      },
    });

    const entryRow = await this.prisma.libraryEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      include: ENTRY_INCLUDE,
    });
    const entry = entryRow
      ? this.toEntryDto(
          entryRow,
          await this.computeProgress(userId, media.id),
          await this.lastWatchedAt(userId, media.id),
          await this.reviews.getRating(
            userId,
            ReviewTargetType.MEDIA,
            media.id,
          ),
        )
      : null;

    return {
      source,
      sourceId,
      type: media.type,
      title: media.title,
      // Original title is not persisted separately; only used for matching.
      originalTitle: null,
      year: media.releaseDate ? media.releaseDate.getFullYear() : null,
      posterUrl: media.posterUrl,
      backdropUrl: media.backdropUrl,
      overview: media.overview,
      genres: media.genres,
      airingStatus: media.status,
      airingFinished: normalizeAiringFinished(media.status),
      isAdult: media.isAdult,
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          watchCount: episode.watches.length,
          watches: episode.watches.map((w) => ({
            id: w.id,
            episodeId: episode.id,
            watchedAt: w.watchedAt.toISOString(),
          })),
        })),
      })),
      entry,
    };
  }
}

function toMediaItemDto(
  media: MediaItem & { externalIds: MediaExternalId[] },
): MediaItemDto {
  return {
    id: media.id,
    type: media.type,
    title: media.title,
    posterUrl: media.posterUrl,
    canonicalSource: media.canonicalSource,
    sourceId: canonicalExternalId(media, media.externalIds),
  };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
