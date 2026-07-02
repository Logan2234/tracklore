import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogSource, MediaSource, MediaSummaryDto, MediaType } from '@tracklore/shared';
import type {
  CatalogProvider,
  ProviderExternalId,
  ProviderMediaDetails,
  ProviderSeason,
} from './provider.types';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

interface TmdbMovieResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
}

interface TmdbTvResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
}

interface TmdbExternalIds {
  imdb_id?: string | null;
  tvdb_id?: number | null;
}

interface TmdbMovieDetails extends TmdbMovieResult {
  overview?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  status?: string | null;
  external_ids?: TmdbExternalIds;
}

interface TmdbTvDetails extends TmdbTvResult {
  overview?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  status?: string | null;
  external_ids?: TmdbExternalIds;
  seasons?: { season_number: number; name?: string | null }[];
}

interface TmdbSeasonDetails {
  episodes?: { episode_number: number; name?: string | null; air_date?: string | null }[];
}

/** Films and (western) series, from The Movie Database. */
@Injectable()
export class TmdbProvider implements CatalogProvider {
  readonly source = CatalogSource.TMDB;

  constructor(private readonly configService: ConfigService) {}

  async search(query: string, type?: MediaType): Promise<MediaSummaryDto[]> {
    const wantMovies = type === undefined || type === MediaType.MOVIE;
    const wantSeries = type === undefined || type === MediaType.SERIES;

    const [movies, series] = await Promise.all([
      wantMovies
        ? this.get<{ results: TmdbMovieResult[] }>('/search/movie', { query })
        : Promise.resolve({ results: [] }),
      wantSeries
        ? this.get<{ results: TmdbTvResult[] }>('/search/tv', { query })
        : Promise.resolve({ results: [] }),
    ]);

    return [
      ...movies.results.map((m) => this.toMovieSummary(m)),
      ...series.results.map((s) => this.toTvSummary(s)),
    ];
  }

  async getDetails(sourceId: string, type: MediaType): Promise<ProviderMediaDetails> {
    return type === MediaType.MOVIE ? this.getMovieDetails(sourceId) : this.getTvDetails(sourceId);
  }

  private async getMovieDetails(sourceId: string): Promise<ProviderMediaDetails> {
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      append_to_response: 'external_ids',
    });

    return {
      summary: this.toMovieSummary(movie),
      overview: movie.overview ?? null,
      backdropUrl: movie.backdrop_path ? `${IMG}/w1280${movie.backdrop_path}` : null,
      genres: movie.genres?.map((g) => g.name) ?? [],
      status: movie.status ?? null,
      releaseDate: movie.release_date || null,
      externalIds: this.toExternalIds(String(movie.id), movie.external_ids),
      seasons: [],
    };
  }

  private async getTvDetails(sourceId: string): Promise<ProviderMediaDetails> {
    const tv = await this.get<TmdbTvDetails>(`/tv/${sourceId}`, {
      append_to_response: 'external_ids',
    });

    // Episode lists live on per-season endpoints.
    const seasons: ProviderSeason[] = await Promise.all(
      (tv.seasons ?? []).map(async (season) => {
        const detail = await this.get<TmdbSeasonDetails>(
          `/tv/${sourceId}/season/${season.season_number}`,
          {},
        );
        return {
          number: season.season_number,
          title: season.name ?? null,
          episodes: (detail.episodes ?? []).map((e) => ({
            number: e.episode_number,
            title: e.name ?? null,
            airDate: e.air_date || null,
          })),
        };
      }),
    );

    return {
      summary: this.toTvSummary(tv),
      overview: tv.overview ?? null,
      backdropUrl: tv.backdrop_path ? `${IMG}/w1280${tv.backdrop_path}` : null,
      genres: tv.genres?.map((g) => g.name) ?? [],
      status: tv.status ?? null,
      releaseDate: tv.first_air_date || null,
      externalIds: this.toExternalIds(String(tv.id), tv.external_ids),
      seasons,
    };
  }

  private toMovieSummary(movie: TmdbMovieResult): MediaSummaryDto {
    return {
      source: CatalogSource.TMDB,
      sourceId: String(movie.id),
      type: MediaType.MOVIE,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      posterUrl: movie.poster_path ? `${IMG}/w500${movie.poster_path}` : null,
    };
  }

  private toTvSummary(tv: TmdbTvResult): MediaSummaryDto {
    return {
      source: CatalogSource.TMDB,
      sourceId: String(tv.id),
      type: MediaType.SERIES,
      title: tv.name,
      year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
      posterUrl: tv.poster_path ? `${IMG}/w500${tv.poster_path}` : null,
    };
  }

  private toExternalIds(tmdbId: string, ids?: TmdbExternalIds) {
    const externalIds: ProviderExternalId[] = [
      { source: MediaSource.TMDB, externalId: tmdbId },
    ];
    if (ids?.imdb_id) {
      externalIds.push({ source: MediaSource.IMDB, externalId: ids.imdb_id });
    }
    if (ids?.tvdb_id) {
      externalIds.push({ source: MediaSource.TVDB, externalId: String(ids.tvdb_id) });
    }
    return externalIds;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.configService.getOrThrow<string>('TMDB_API_TOKEN')}`,
        Accept: 'application/json',
      },
    });
    if (response.status === 404) {
      throw new NotFoundException('Media not found on TMDB');
    }
    if (!response.ok) {
      throw new BadGatewayException(`TMDB request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
