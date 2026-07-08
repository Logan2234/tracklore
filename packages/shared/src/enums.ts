// String-literal const objects instead of TS enums: same ergonomics,
// but the values survive as plain strings across the API boundary.

/**
 * Top-level content domain a user can compose their app from. MEDIA groups
 * MOVIE/SERIES/ANIME; BOOKS and GAMES are nav placeholders until their screens
 * land at P3. `User.enabledDomains` records which ones the user keeps visible —
 * the nav filters on it today (see web `isDomainEnabled`); search and
 * notification filtering follow at P3.
 */
export const Domain = {
  MEDIA: "MEDIA",
  BOOKS: "BOOKS",
  GAMES: "GAMES",
} as const;
export type Domain = (typeof Domain)[keyof typeof Domain];

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

/**
 * Status of a media in a user's library. PLANNED doubles as the watchlist.
 *
 * DROPPED is the only user-set status (a manual "I quit, won't return"
 * override); the others are derived at read time from watch progress + airing
 * status (see `LibraryService.deriveStatus`). UP_TO_DATE ("caught up") applies
 * to series/anime that are fully watched but still airing — it is never
 * persisted. A WATCHING entry left untouched for a while reads as "dormant"
 * (see `isDormant`), a derived signal — not a status.
 */
export const EntryStatus = {
  WATCHING: "WATCHING",
  COMPLETED: "COMPLETED",
  PLANNED: "PLANNED",
  DROPPED: "DROPPED",
  UP_TO_DATE: "UP_TO_DATE",
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];
