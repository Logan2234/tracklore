// String-literal const objects instead of TS enums: same ergonomics,
// but the values survive as plain strings across the API boundary.

/** Kind of media. MOVIE/SERIES come from TMDB, ANIME from AniList. */
export const MediaType = {
  MOVIE: "MOVIE",
  SERIES: "SERIES",
  ANIME: "ANIME",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

/**
 * External catalogue a media or an ID comes from.
 * TMDB and ANILIST are canonical (we fetch from them); TVDB and IMDB are
 * secondary identifiers kept for reconciliation (e.g. TV Time import).
 */
export const MediaSource = {
  TMDB: "TMDB",
  ANILIST: "ANILIST",
  TVDB: "TVDB",
  IMDB: "IMDB",
} as const;
export type MediaSource = (typeof MediaSource)[keyof typeof MediaSource];

/** Sources the catalogue can be queried from (canonical only). */
export const CatalogSource = {
  TMDB: "TMDB",
  ANILIST: "ANILIST",
} as const;
export type CatalogSource = (typeof CatalogSource)[keyof typeof CatalogSource];

/** Status of a media in a user's library. PLANNED doubles as the watchlist. */
export const EntryStatus = {
  WATCHING: "WATCHING",
  COMPLETED: "COMPLETED",
  PLANNED: "PLANNED",
  DROPPED: "DROPPED",
  PAUSED: "PAUSED",
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];
