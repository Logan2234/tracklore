import {
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
  ProgressDto,
} from "@tracklore/shared";
import { MediaItemService } from "../catalog/media-item.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
import { deriveStatus, normalizeAiringFinished } from "./status.util";

/** Reused include: entries always need the media + its external IDs (sourceId).
 * `satisfies` (not a type annotation) keeps the literal shape so Prisma can
 * still infer the joined payload type from it. */
const ENTRY_INCLUDE = {
  mediaItem: { include: { externalIds: true } },
} satisfies Prisma.LibraryEntryInclude;

/** LibraryEntry joined with its media and the media's external IDs. */
type EntryWithMedia = Prisma.LibraryEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
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

    const changes = {
      status: dto.status,
      rating: dto.rating,
      notes: dto.notes,
      favorite: dto.favorite,
      archived: dto.archived,
    };
    const entry = await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      update: changes,
      create: { userId, mediaItemId: mediaItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, mediaItem.id),
    );
  }

  async listEntries(
    userId: string,
    filters: { status?: EntryStatus; type?: MediaType },
  ): Promise<LibraryEntryDto[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        mediaItem: filters.type ? { type: filters.type } : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const dtos = await Promise.all(
      entries.map(async (entry) =>
        this.toEntryDto(
          entry,
          await this.computeProgress(userId, entry.mediaItemId),
        ),
      ),
    );

    // Status is derived, so filter on the effective status, not the stored one.
    return filters.status
      ? dtos.filter((dto) => dto.status === filters.status)
      : dtos;
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
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateEntryDto,
  ): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const entry = await this.prisma.libraryEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        rating: dto.rating,
        notes: dto.notes,
        favorite: dto.favorite,
        archived: dto.archived,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
      },
      include: ENTRY_INCLUDE,
    });

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, entry.mediaItemId),
    );
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.libraryEntry.delete({ where: { id: entryId } });
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

    const watch = await this.prisma.episodeWatch.create({
      data: {
        userId,
        episodeId,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : undefined,
        rating: dto.rating,
      },
    });
    return {
      id: watch.id,
      episodeId: watch.episodeId,
      watchedAt: watch.watchedAt.toISOString(),
      rating: watch.rating,
    };
  }

  /**
   * Mark every not-yet-watched episode of a season as watched in one go.
   * Already-watched episodes are skipped so this never inflates rewatch counts.
   */
  async watchSeason(userId: string, seasonId: string): Promise<void> {
    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true },
    });
    if (episodes.length === 0) {
      throw new NotFoundException("Season not found or has no episodes");
    }
    await this.markUnwatched(
      userId,
      episodes.map((e) => e.id),
    );
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

    if (target.season.number === 0) {
      await this.markUnwatched(userId, [episodeId]);
      return;
    }

    const episodes = await this.prisma.episode.findMany({
      where: {
        season: { mediaItemId: target.season.mediaItemId, number: { gt: 0 } },
      },
      select: { id: true, number: true, season: { select: { number: true } } },
    });
    const throughIds = episodes
      .filter(
        (e) =>
          e.season.number < target.season.number ||
          (e.season.number === target.season.number &&
            e.number <= target.number),
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

  async deleteWatch(userId: string, watchId: string): Promise<void> {
    const watch = await this.prisma.episodeWatch.findUnique({
      where: { id: watchId },
    });
    if (!watch) {
      throw new NotFoundException("Watch not found");
    }
    if (watch.userId !== userId) {
      throw new ForbiddenException("This watch belongs to another user");
    }
    await this.prisma.episodeWatch.delete({ where: { id: watchId } });
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

    const totalEpisodes = await this.prisma.episode.count({
      where: regularEpisodes,
    });
    if (totalEpisodes === 0) {
      return null; // Movies (or media without any episode listing).
    }

    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episode: regularEpisodes },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });

    return { watchedEpisodes: watched.length, totalEpisodes };
  }

  private toEntryDto(
    entry: EntryWithMedia,
    progress: ProgressDto | null,
  ): LibraryEntryDto {
    const media = entry.mediaItem;
    const status = deriveStatus(
      media.type,
      progress,
      normalizeAiringFinished(media.status),
      entry.status,
    );
    return {
      id: entry.id,
      mediaItem: toMediaItemDto(media),
      status,
      rating: entry.rating,
      notes: entry.notes,
      favorite: entry.favorite,
      archived: entry.archived,
      startedAt: entry.startedAt?.toISOString() ?? null,
      finishedAt: entry.finishedAt?.toISOString() ?? null,
      progress,
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
        source_externalId: {
          source: source as DbExternalSource,
          externalId: sourceId,
        },
      },
      include: { mediaItem: true },
    });

    if (ref) {
      return this.mediaDetailFromCache(userId, source, sourceId, ref.mediaItem);
    }

    const details = await this.mediaItemService.getLiveDetails(
      source,
      sourceId,
      type,
    );
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
          include: { watches: { where: { userId }, select: { id: true } } },
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
      entry,
    };
  }
}

/** External ID of a media in its own canonical source (always present). */
function canonicalSourceId(
  media: MediaItem & { externalIds: MediaExternalId[] },
): string {
  return (
    media.externalIds.find((ext) => ext.source === media.canonicalSource)
      ?.externalId ?? ""
  );
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
    sourceId: canonicalSourceId(media),
  };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
