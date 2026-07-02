import type { EntryStatus } from "../enums";

/**
 * Raw CSV text extracted from a TV Time GDPR export, one field per relevant
 * file. The server builds this by unzipping the uploaded archive. Every field
 * is optional at this layer: the parser degrades gracefully when one is absent
 * (e.g. no rewatch file → no rewatches); required-file validation happens
 * upstream, right after unzipping.
 */
export interface TvTimeImportFilesDto {
  /** `tracking-prod-records-v2.csv` — one row per watched episode (source of truth). */
  episodesCsv?: string;
  /** `tracking-prod-records.csv` — movies (watched vs watchlist) via the `type` column. */
  recordsCsv?: string;
  /** `rewatched_episode.csv` — per-episode rewatch counter (`cpt`). */
  rewatchedCsv?: string;
  /** `user_tv_show_data.csv` — show names + TVDB id + episodes-seen count (watchlist detection). */
  showsCsv?: string;
}

export interface StartTvTimeImportDto {
  /**
   * The TV Time GDPR export `.zip`, base64-encoded. The server unzips it and
   * extracts the CSVs it needs (see {@link TvTimeImportFilesDto}); base64 keeps
   * the existing JSON transport (no multipart, no new server dependency).
   */
  zipBase64: string;
  /** When true, reconcile against TMDB and produce a report but write nothing. */
  dryRun?: boolean;
  /** Import the ~hundreds of tracked movies (default true). */
  importMovies?: boolean;
  /**
   * When true, wipe the user's library and watch history before importing
   * (destructive replace); otherwise the import is additive. Ignored on a
   * dry run, which writes nothing.
   */
  overwrite?: boolean;
}

/** One watched episode of a show, identified by its season/episode numbers. */
export interface EpisodeRefDto {
  season: number;
  episode: number;
}

/**
 * A show whose TVDB id did not resolve to a TMDB series. We keep the watch
 * data from the export so the report can show what would be imported once the
 * show is reconciled (and tell a watchlist entry apart from a started one).
 */
export interface UnresolvedShowDto {
  title: string;
  /** TheTVDB id — the identifier TMDB could not map. */
  tvdbId: string;
  /** Distinct watched episodes; empty ⇒ watchlist (never started). */
  episodes: EpisodeRefDto[];
}

/** A movie with no confident TMDB match. */
export interface UnresolvedMovieDto {
  title: string;
  /** Release year from the export, when present. */
  year: number | null;
  /** true ⇒ already watched (would import as COMPLETED); false ⇒ watchlist. */
  watched: boolean;
}

export interface UnmatchedEpisodeDto {
  show: string;
  season: number;
  episode: number;
}

/**
 * Outcome of a run. Counts are exact; the sample arrays are capped so a large
 * export cannot bloat the response — the counts tell the full story.
 */
export interface TvTimeImportReport {
  dryRun: boolean;
  /** True when the run first wiped the user's library/history (see StartTvTimeImportDto). */
  overwrite: boolean;
  shows: {
    total: number;
    imported: number;
    watchlist: number;
    /** Shows whose TVDB id did not resolve to a TMDB series (sample). */
    unresolved: UnresolvedShowDto[];
  };
  episodes: {
    watched: number;
    watchesCreated: number;
    /** Watched episodes with no matching TMDB episode, e.g. TVDB numbering gaps (sample). */
    unmatched: UnmatchedEpisodeDto[];
  };
  movies: {
    total: number;
    imported: number;
    watchlist: number;
    /** Titles with no confident TMDB match — validate manually (sample). */
    unresolved: UnresolvedMovieDto[];
  };
}

export interface TvTimeImportJobDto {
  id: string;
  status: "running" | "completed" | "failed";
  dryRun: boolean;
  progress: {
    shows: number;
    totalShows: number;
    movies: number;
    totalMovies: number;
  };
  /** Populated once the job leaves the `running` state. */
  report: TvTimeImportReport | null;
  error: string | null;
}

/** Cap on how many sample items each report array holds. */
export const IMPORT_REPORT_SAMPLE_CAP = 100;

export function entryStatusFromProgress(
  watched: number,
  total: number,
): EntryStatus {
  if (watched === 0) return "PLANNED";
  if (total > 0 && watched >= total) return "COMPLETED";
  return "WATCHING";
}
