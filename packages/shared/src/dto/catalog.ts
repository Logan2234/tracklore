import type { CatalogSource, MediaType } from "../enums";
import type { EpisodeWatchDto, LibraryEntryDto } from "./library";

/** A media as returned by a live catalogue search (not persisted). */
export interface MediaSummaryDto {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
  title: string;
  /**
   * Original-language title, when the source provides one (TMDB
   * `original_title`/`original_name`). Lets title matching succeed against the
   * original title even when `title` is a localized (e.g. en-US) variant.
   */
  originalTitle?: string | null;
  year: number | null;
  posterUrl: string | null;
}

export interface SearchResponseDto {
  results: MediaSummaryDto[];
}

export interface EpisodeDto {
  /** Internal ID, only present once the media is persisted. */
  id: string | null;
  number: number;
  title: string | null;
  airDate: string | null;
}

export interface SeasonDto {
  id: string | null;
  number: number;
  title: string | null;
  episodes: EpisodeDto[];
}

/** Full media details, fetched live from the source (seasons included for series/anime). */
export interface MediaDetailsDto extends MediaSummaryDto {
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  /** In-production / ended / releasing… free-form, source-dependent. */
  status: string | null;
  seasons: SeasonDto[];
}

/** One episode on the unified media page, carrying the user's watch history. */
export interface MediaDetailEpisodeDto {
  /** null until the media is persisted (i.e. not yet in anyone's library). */
  id: string | null;
  number: number;
  title: string | null;
  airDate: string | null;
  watchCount: number;
  /** The current user's viewings of this episode (date + rating), most recent first. */
  watches: EpisodeWatchDto[];
}

export interface MediaDetailSeasonDto {
  id: string | null;
  number: number;
  title: string | null;
  episodes: MediaDetailEpisodeDto[];
}

/**
 * Everything the unified media page (`/media/{type}/{id}`) needs in one call:
 * catalogue metadata (cached if persisted, else fetched live) + the current
 * user's library state. `entry` is null when the media is not in the library.
 */
export interface MediaDetailDto {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  genres: string[];
  /** Raw airing status from the source (e.g. "Ended", "RELEASING"). */
  airingStatus: string | null;
  /** Normalised: the show has finished airing (no more episodes coming). */
  airingFinished: boolean;
  seasons: MediaDetailSeasonDto[];
  entry: LibraryEntryDto | null;
}
