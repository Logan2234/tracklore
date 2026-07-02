import type { CatalogSource, MediaType } from "../enums";

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
