import type { CatalogSource, EntryStatus, MediaType } from "../enums";

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
  /** Import the ~hundreds of tracked movies (default true). */
  importMovies?: boolean;
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
  /** True when the run first wiped the user's library/history (see ImportCommitRequest). */
  overwrite: boolean;
  shows: {
    total: number;
    imported: number;
    watchlist: number;
  };
  episodes: {
    watched: number;
    watchesCreated: number;
    /** Watched episodes with no matching catalogue episode, e.g. numbering gaps (sample). */
    unmatched: UnmatchedEpisodeDto[];
  };
  movies: {
    total: number;
    imported: number;
    watchlist: number;
  };
}

export interface TvTimeImportJobDto {
  id: string;
  status: "running" | "completed" | "failed";
  progress: {
    shows: number;
    totalShows: number;
    movies: number;
    totalMovies: number;
  };
  /** Populated once an analysis job completes (reconciliation plan to review). */
  plan: ImportPlan | null;
  /** Populated once a commit job completes. */
  report: TvTimeImportReport | null;
  error: string | null;
}

// --- Interactive reconciliation (analyze → review → commit) ---

/** A catalogue title a source item resolved to during analysis. */
export interface ImportMatch {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
}

/** A show in the reconciliation plan, with its resolution outcome. */
export interface ImportPlanShow {
  /** Stable id used to carry the user's decision back to `commit`. */
  key: string;
  title: string;
  /** Distinct watched episodes from the export; 0 ⇒ watchlist. */
  episodesWatched: number;
  /** Resolved catalogue match, or null when it needs a manual search. */
  match: ImportMatch | null;
  /** Default inclusion — true when confidently resolved, false otherwise. */
  include: boolean;
}

/** A movie in the reconciliation plan. */
export interface ImportPlanMovie {
  key: string;
  title: string;
  year: number | null;
  /** true ⇒ would import as COMPLETED; false ⇒ watchlist (PLANNED). */
  watched: boolean;
  match: ImportMatch | null;
  include: boolean;
}

/**
 * The full analysis result, grouped into the collections the UI reconciles
 * one by one. Items with `match === null` are the "needs review" set (filtered
 * across collections client-side), where the user searches for the right title.
 */
export interface ImportPlan {
  seriesTracked: ImportPlanShow[];
  seriesWatchlist: ImportPlanShow[];
  moviesWatched: ImportPlanMovie[];
  moviesWatchlist: ImportPlanMovie[];
  counts: {
    shows: number;
    movies: number;
    /** Shows + movies with no automatic match. */
    unresolved: number;
  };
}

/** A catalogue target chosen manually for an unresolved item, at commit time. */
export interface ImportCommitOverride {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
}

/** The user's reconciliation decisions, sent to commit an analysed import. */
export interface ImportCommitRequest {
  /** Keys (from the plan) the user chose to import. */
  include: string[];
  /** Manual matches for items the analysis left unresolved, keyed by plan key. */
  overrides?: Record<string, ImportCommitOverride>;
  /** Wipe the library/history before writing (destructive replace). */
  overwrite?: boolean;
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
