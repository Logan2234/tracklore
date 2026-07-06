import type { CatalogSource, EntryStatus, MediaType } from "../enums";

/** A persisted media referenced by at least one user (on-demand cache). */
export interface MediaItemDto {
  id: string;
  type: MediaType;
  title: string;
  posterUrl: string | null;
  canonicalSource: CatalogSource;
  /**
   * External ID in `canonicalSource`. With `type` it forms the catalogue
   * identity used to address the media page (`/media/{type}/{sourceId}`).
   */
  sourceId: string;
}

export interface LibraryEntryDto {
  id: string;
  mediaItem: MediaItemDto;
  status: EntryStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  archived: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Episode progress, only for series/anime. */
  progress: ProgressDto | null;
}

/** The next episode to watch (first released, unwatched regular episode). */
export interface NextEpisodeDto {
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
}

export interface ProgressDto {
  watchedEpisodes: number;
  totalEpisodes: number;
  /** One-click "resume" target; null when caught up (or nothing released next). */
  nextEpisode: NextEpisodeDto | null;
}

/** Body for creating/updating a library entry from a catalogue media. */
export interface UpsertLibraryEntryDto {
  source: CatalogSource;
  sourceId: string;
  /** Required because TMDB movie and TV IDs live in separate namespaces. */
  type: MediaType;
  status?: EntryStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  archived?: boolean;
}

/** One watch event for one episode; several rows for the same episode = rewatches. */
export interface EpisodeWatchDto {
  id: string;
  episodeId: string;
  watchedAt: string;
  rating: number | null;
}

/** Persisted episode enriched with the current user's watch count. */
export interface EpisodeWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  airDate: string | null;
  watchCount: number;
}

export interface SeasonWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  episodes: EpisodeWithWatchesDto[];
}

export interface EntryEpisodesResponseDto {
  seasons: SeasonWithWatchesDto[];
}

/** An upcoming episode of a tracked series/anime (release calendar). */
export interface CalendarEntryDto {
  mediaItem: MediaItemDto;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  /** ISO air date (always in the future for the calendar feed). */
  airDate: string;
}

/** Watch time for one media type (used for the "time split" breakdown). */
export interface TypeHoursDto {
  type: MediaType;
  hours: number;
}

/** How often a genre appears across watched titles (weighted by viewings). */
export interface GenreCountDto {
  genre: string;
  count: number;
}

/** Aggregated viewing statistics for the current user. */
export interface StatsDto {
  /** Rounded total hours watched (episodes hors specials + seen movies). */
  hoursWatched: number;
  /** Total episode viewings, rewatches included, specials excluded. */
  episodesWatched: number;
  /** Series/anime library entries marked COMPLETED. */
  seriesCompleted: number;
  /** Movie library entries marked COMPLETED (seen). */
  moviesWatched: number;
  /** Watch time split by media type, descending. */
  timeByType: TypeHoursDto[];
  /** Most-watched genres, descending (top few). */
  topGenres: GenreCountDto[];
}
