import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  EntryStatus as DbEntryStatus,
  LibraryEntry,
  MediaItem,
  Prisma,
} from '@prisma/client';
import type {
  EntryEpisodesResponseDto,
  EntryStatus,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaType,
  ProgressDto,
} from '@tracklore/shared';
import { MediaItemService } from '../catalog/media-item.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { UpsertEntryDto } from './dto/upsert-entry.dto';
import { WatchEpisodeDto } from './dto/watch-episode.dto';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
  ) {}

  /** First touch of a media persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(userId: string, dto: UpsertEntryDto): Promise<LibraryEntryDto> {
    const mediaItem = await this.mediaItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
      dto.type,
    );

    const changes = {
      status: dto.status as DbEntryStatus | undefined,
      rating: dto.rating,
      notes: dto.notes,
      favorite: dto.favorite,
      archived: dto.archived,
    };
    const entry = await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      update: changes,
      create: { userId, mediaItemId: mediaItem.id, ...changes },
      include: { mediaItem: true },
    });

    return this.toEntryDto(entry, await this.computeProgress(userId, mediaItem.id));
  }

  async listEntries(
    userId: string,
    filters: { status?: EntryStatus; type?: MediaType },
  ): Promise<LibraryEntryDto[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        status: filters.status as DbEntryStatus | undefined,
        mediaItem: filters.type ? { type: filters.type } : undefined,
      },
      include: { mediaItem: true },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      entries.map(async (entry) =>
        this.toEntryDto(entry, await this.computeProgress(userId, entry.mediaItemId)),
      ),
    );
  }

  async getEntry(userId: string, entryId: string): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.libraryEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { mediaItem: true },
    });
    return this.toEntryDto(entry, await this.computeProgress(userId, entry.mediaItemId));
  }

  async updateEntry(userId: string, entryId: string, dto: UpdateEntryDto): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const entry = await this.prisma.libraryEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status as DbEntryStatus | undefined,
        rating: dto.rating,
        notes: dto.notes,
        favorite: dto.favorite,
        archived: dto.archived,
        startedAt: dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt: dto.finishedAt === undefined ? undefined : toDateOrNull(dto.finishedAt),
      },
      include: { mediaItem: true },
    });

    return this.toEntryDto(entry, await this.computeProgress(userId, entry.mediaItemId));
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.libraryEntry.delete({ where: { id: entryId } });
  }

  /** Persisted seasons/episodes of an entry's media, with the user's watch counts. */
  async getEntryEpisodes(userId: string, entryId: string): Promise<EntryEpisodesResponseDto> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: entry.mediaItemId },
      orderBy: { number: 'asc' },
      include: {
        episodes: {
          orderBy: { number: 'asc' },
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
    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      throw new NotFoundException('Episode not found');
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

  async deleteWatch(userId: string, watchId: string): Promise<void> {
    const watch = await this.prisma.episodeWatch.findUnique({ where: { id: watchId } });
    if (!watch) {
      throw new NotFoundException('Watch not found');
    }
    if (watch.userId !== userId) {
      throw new ForbiddenException('This watch belongs to another user');
    }
    await this.prisma.episodeWatch.delete({ where: { id: watchId } });
  }

  private async assertEntryOwnership(userId: string, entryId: string): Promise<LibraryEntry> {
    const entry = await this.prisma.libraryEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Library entry not found');
    }
    if (entry.userId !== userId) {
      throw new ForbiddenException('This entry belongs to another user');
    }
    return entry;
  }

  /**
   * Season 0 holds specials on TMDB: they are watchable but excluded from the
   * watched/total progress so "100%" means the regular run is complete.
   */
  private async computeProgress(userId: string, mediaItemId: string): Promise<ProgressDto | null> {
    const regularEpisodes: Prisma.EpisodeWhereInput = {
      season: { mediaItemId, number: { gt: 0 } },
    };

    const totalEpisodes = await this.prisma.episode.count({ where: regularEpisodes });
    if (totalEpisodes === 0) {
      return null; // Movies (or media without any episode listing).
    }

    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episode: regularEpisodes },
      distinct: ['episodeId'],
      select: { episodeId: true },
    });

    return { watchedEpisodes: watched.length, totalEpisodes };
  }

  private toEntryDto(
    entry: LibraryEntry & { mediaItem: MediaItem },
    progress: ProgressDto | null,
  ): LibraryEntryDto {
    return {
      id: entry.id,
      mediaItem: {
        id: entry.mediaItem.id,
        type: entry.mediaItem.type,
        title: entry.mediaItem.title,
        posterUrl: entry.mediaItem.posterUrl,
        canonicalSource: entry.mediaItem.canonicalSource,
      },
      status: entry.status,
      rating: entry.rating,
      notes: entry.notes,
      favorite: entry.favorite,
      archived: entry.archived,
      startedAt: entry.startedAt?.toISOString() ?? null,
      finishedAt: entry.finishedAt?.toISOString() ?? null,
      progress,
    };
  }
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
