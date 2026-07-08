import { Injectable } from "@nestjs/common";
import type { MediaItem } from "@prisma/client";
import type {
  CatalogSource,
  MediaDetailsDto,
  MediaType,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AnilistProvider } from "./providers/anilist.provider";
import type {
  CatalogProvider,
  ProviderMediaDetails,
} from "./providers/provider.types";
import { TmdbProvider } from "./providers/tmdb.provider";

// A cached media referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MediaItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbProvider: TmdbProvider,
    private readonly anilistProvider: AnilistProvider,
  ) {}

  providerFor(source: CatalogSource): CatalogProvider {
    return source === "TMDB" ? this.tmdbProvider : this.anilistProvider;
  }

  /** Live details straight from the provider — nothing is persisted. */
  async getLiveDetails(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<MediaDetailsDto> {
    const details = await this.providerFor(source).getDetails(sourceId, type);
    return {
      ...details.summary,
      overview: details.overview,
      backdropUrl: details.backdropUrl,
      genres: details.genres,
      status: details.status,
      seasons: details.seasons.map((season) => ({
        id: null,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({ id: null, ...episode })),
      })),
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing a media
   * (track, wishlist…). Fetches from the canonical source and persists the
   * media with its external IDs, seasons and episodes.
   */
  async upsertFromSource(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<MediaItem> {
    const existingRef = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId: {
          source: source,
          externalId: sourceId,
        },
      },
      include: { mediaItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.mediaItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.mediaItem;
    }

    const details = await this.providerFor(source).getDetails(sourceId, type);
    return existingRef
      ? this.refresh(existingRef.mediaItemId, details)
      : this.createFresh(source, type, details);
  }

  private async createFresh(
    source: CatalogSource,
    type: MediaType,
    details: ProviderMediaDetails,
  ): Promise<MediaItem> {
    return this.prisma.mediaItem.create({
      data: {
        ...this.baseFields(details),
        type: type,
        canonicalSource: source,
        externalIds: {
          create: details.externalIds.map((ext) => ({
            source: ext.source,
            externalId: ext.externalId,
          })),
        },
        seasons: {
          create: details.seasons.map((season) => ({
            number: season.number,
            title: season.title,
            episodes: {
              create: season.episodes.map((episode) => ({
                number: episode.number,
                title: episode.title,
                airDate: episode.airDate ? new Date(episode.airDate) : null,
              })),
            },
          })),
        },
      },
    });
  }

  private async refresh(
    mediaItemId: string,
    details: ProviderMediaDetails,
  ): Promise<MediaItem> {
    const item = await this.prisma.mediaItem.update({
      where: { id: mediaItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.mediaExternalId.upsert({
        where: {
          source_externalId: {
            source: ext.source,
            externalId: ext.externalId,
          },
        },
        update: { mediaItemId },
        create: {
          mediaItemId,
          source: ext.source,
          externalId: ext.externalId,
        },
      });
    }

    // Upsert (never delete) so episode watches always keep a valid target,
    // even if the source reorganises its listing.
    for (const season of details.seasons) {
      const storedSeason = await this.prisma.season.upsert({
        where: { mediaItemId_number: { mediaItemId, number: season.number } },
        update: { title: season.title },
        create: { mediaItemId, number: season.number, title: season.title },
      });

      for (const episode of season.episodes) {
        const airDate = episode.airDate ? new Date(episode.airDate) : null;
        await this.prisma.episode.upsert({
          where: {
            seasonId_number: {
              seasonId: storedSeason.id,
              number: episode.number,
            },
          },
          update: { title: episode.title, airDate },
          create: {
            seasonId: storedSeason.id,
            number: episode.number,
            title: episode.title,
            airDate,
          },
        });
      }
    }

    return item;
  }

  private baseFields(details: ProviderMediaDetails) {
    return {
      title: details.summary.title,
      posterUrl: details.summary.posterUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      status: details.status,
      genres: details.genres,
      runtimeMin: details.runtimeMin,
      isAdult: details.summary.isAdult,
      lastSyncedAt: new Date(),
    };
  }
}
