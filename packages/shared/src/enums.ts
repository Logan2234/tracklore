// String-literal const objects instead of TS enums: same ergonomics,
// but the values survive as plain strings across the API boundary.

/**
 * Top-level content domain a user can compose their app from. MEDIA groups
 * MOVIE/SERIES/ANIME; BOOKS and GAMES have their own screens (search, library,
 * stats, imports) as of P3. `User.enabledDomains` records which ones the user
 * keeps visible — the nav filters on it today (see web `isDomainEnabled`);
 * search and notification filtering still follow.
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
 * Source a game's catalogue data comes from. IGDB is the only one we fetch from
 * today; RAWG is reserved so the multi-source seam exists before it lands.
 */
export const GameSource = {
  IGDB: "IGDB",
  RAWG: "RAWG",
} as const;
export type GameSource = (typeof GameSource)[keyof typeof GameSource];

/**
 * Status of a game in a user's library. Unlike media (whose status is derived
 * from episode progress), a game's status is entirely user-set: there is no
 * per-episode progress to infer "playing" or "completed" from. BACKLOG doubles
 * as the wishlist ("want to play").
 */
export const GameStatus = {
  BACKLOG: "BACKLOG",
  PLAYING: "PLAYING",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

/**
 * Source a book's catalogue data comes from. GOOGLE_BOOKS is tried first when a
 * GOOGLE_BOOKS_API_KEY is configured (richer data), falling back to OPENLIBRARY
 * (keyless, like AniList) — so a library can hold books from either source.
 */
export const BookSource = {
  GOOGLE_BOOKS: "GOOGLE_BOOKS",
  OPENLIBRARY: "OPENLIBRARY",
} as const;
export type BookSource = (typeof BookSource)[keyof typeof BookSource];

/**
 * Status of a book in a user's library. Like GameStatus it is entirely
 * user-set: books have no per-chapter progress to derive "reading"/"read" from
 * (page progress is tracked separately, on the entry). TO_READ doubles as the
 * wishlist ("want to read").
 */
export const BookStatus = {
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
  DROPPED: "DROPPED",
} as const;
export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];

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
