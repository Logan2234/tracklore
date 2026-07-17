/**
 * Canonical, source-agnostic import model. Every import source (TV Time today,
 * Trakt/Letterboxd/MAL tomorrow) parses its own export format down to this
 * shape; everything downstream — catalogue resolution, the reconciliation plan
 * and the write phase — is generic and consumes only what is defined here.
 * Adding a source therefore means writing one more {@link ImportSource.parse}.
 */

/** External identifiers a source may expose for a title (any subset). */
type ExternalIdMap = {
  tvdb?: string;
  tmdb?: string;
  imdb?: string;
  anilist?: string;
};

/** One distinct watched episode of a show, rewatches folded into the count. */
interface ImportWatchedEpisode {
  season: number;
  episode: number;
  /** The source's own episode id (e.g. TVDB) — used to fold in rewatch counts. */
  sourceEpisodeId: string;
  /** Approximate: sources store record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Base watch + rewatches. Always >= 1. */
  totalWatches: number;
}

export interface ImportShow {
  title: string;
  externalIds: ExternalIdMap;
  /** Distinct watched episodes; empty means the show is only on the watchlist. */
  episodes: ImportWatchedEpisode[];
}

export interface ImportMovie {
  title: string;
  year: number | null;
  /** true → watched (COMPLETED); false → watchlist (PLANNED). */
  watched: boolean;
  externalIds: ExternalIdMap;
}

export interface ParsedImport {
  /** Which source produced this (matches {@link ImportSource.key}). */
  source: string;
  shows: ImportShow[];
  movies: ImportMovie[];
}

/**
 * A user-data source that can be imported into the library. Only the parsing
 * (and which identifiers a source carries) is source-specific.
 */
export interface ImportSource {
  readonly key: string;
  /** Raw uploaded bytes → canonical model. Throws on a malformed export. */
  parse(input: Buffer): ParsedImport;
}
