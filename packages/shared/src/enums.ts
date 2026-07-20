// String-literal const objects instead of TS enums: same ergonomics,
// but the values survive as plain strings across the API boundary.

/**
 * Top-level content domain a user can compose their app from. MEDIA groups
 * MOVIE/SERIES/ANIME; BOOKS, GAMES and MUSIC have their own screens (search,
 * library, stats, imports). `User.enabledDomains` records which ones the user
 * keeps visible — the nav filters on it today (see web `isDomainEnabled`);
 * search and notification filtering still follow.
 *
 * PODCASTS and BOARDGAMES (board games — distinct from GAMES, i.e. video games)
 * are placeholders for a planned P3 extension: no screens or catalogue tables
 * back them yet, they surface everywhere as "coming soon" and are off by
 * default (never in the `enabledDomains` default), opt-in from /account.
 */
export const Domain = {
  MEDIA: "MEDIA",
  BOOKS: "BOOKS",
  GAMES: "GAMES",
  MUSIC: "MUSIC",
  PODCASTS: "PODCASTS",
  BOARDGAMES: "BOARDGAMES",
} as const;
export type Domain = (typeof Domain)[keyof typeof Domain];

/**
 * Operational permission level, orthogonal to `User.entitlements` (the future
 * paid-tier seam). A single self-host admin today; `ADMIN` is granted via the
 * `ADMIN_EMAIL` bootstrap or the admin panel, never by entitlement value.
 */
export const Role = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

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
  TMDB: MediaSource.TMDB,
  ANILIST: MediaSource.ANILIST,
} as const;
export type CatalogSource = (typeof CatalogSource)[keyof typeof CatalogSource];

/** Source a game's catalogue data comes from. IGDB is the only one today. */
export const GameSource = {
  IGDB: "IGDB",
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
 * How the user holds a game, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/SUBSCRIPTION pair with a
 * free-form `ownershipSource` (e.g. "Steam", "Xbox Game Pass").
 */
export const GameOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  SUBSCRIPTION: "SUBSCRIPTION",
  BORROWED: "BORROWED",
} as const;
export type GameOwnershipStatus =
  (typeof GameOwnershipStatus)[keyof typeof GameOwnershipStatus];

/** Source a book's catalogue data comes from. Google Books only. */
export const BookSource = {
  GOOGLE_BOOKS: "GOOGLE_BOOKS",
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
 * How the user holds a book, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/AUDIO pair with a free-form
 * `ownershipSource` (e.g. "Kindle", "Audible").
 */
export const BookOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  AUDIO: "AUDIO",
  BORROWED: "BORROWED",
} as const;
export type BookOwnershipStatus =
  (typeof BookOwnershipStatus)[keyof typeof BookOwnershipStatus];

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

/**
 * How the user holds a movie/series/anime, if at all. NONE (default, unset)
 * is the vast majority of entries — this is opt-in. DIGITAL/STREAMING pair
 * with a free-form `ownershipSource` (e.g. "Apple TV", "Netflix").
 */
export const MediaOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  STREAMING: "STREAMING",
  BORROWED: "BORROWED",
} as const;
export type MediaOwnershipStatus =
  (typeof MediaOwnershipStatus)[keyof typeof MediaOwnershipStatus];

/** Source a music item's catalogue data comes from. MusicBrainz only. */
export const MusicSource = {
  MUSICBRAINZ: "MUSICBRAINZ",
} as const;
export type MusicSource = (typeof MusicSource)[keyof typeof MusicSource];

/**
 * Status of an album in a user's library. Deliberately binary (unlike
 * GameStatus/BookStatus): an album listen is a short, single-session event,
 * so there is no "in progress" or "dropped" state — just whether it's been
 * heard. TO_LISTEN doubles as the wishlist.
 */
export const MusicStatus = {
  TO_LISTEN: "TO_LISTEN",
  LISTENED: "LISTENED",
} as const;
export type MusicStatus = (typeof MusicStatus)[keyof typeof MusicStatus];

/**
 * How the user holds an album, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/STREAMING pair with a
 * free-form `ownershipSource` (e.g. "Bandcamp", "Spotify").
 */
export const MusicOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  STREAMING: "STREAMING",
  BORROWED: "BORROWED",
} as const;
export type MusicOwnershipStatus =
  (typeof MusicOwnershipStatus)[keyof typeof MusicOwnershipStatus];

/**
 * Kind of sensitive account action tracked on the admin "Sécurité" page.
 * LOGIN_FAILED is included alongside the account-lifecycle/credential events
 * because the instance can be exposed to the internet (ngrok) — a spike of
 * failed logins is the one signal that actually matters there.
 */
export const SecurityEventType = {
  USER_REGISTERED: "USER_REGISTERED",
  USER_DELETED: "USER_DELETED",
  EMAIL_CHANGED: "EMAIL_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  LOGIN_FAILED: "LOGIN_FAILED",
} as const;
export type SecurityEventType =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

// ---------------------------------------------------------------------------
// Social (P4). All of it is gated behind the runtime `SOCIAL_ENABLED` flag.
// ---------------------------------------------------------------------------

/**
 * How reachable a user's profile is — the "authentication" layer of visibility.
 * Acts as a cap over the per-facet audience settings (see VisibilityAudience):
 * a PRIVATE profile can never expose anything as PUBLIC.
 * - PUBLIC:  anyone can reach the profile and follow it (asymmetric).
 * - PRIVATE: content is reachable only through an accepted (reciprocal) follow.
 * - GHOST ("Figurant"): unfindable, unfollowable, activity private. The user can
 *   still consume/participate anonymously (follow public profiles, comment,
 *   react, review under a per-thread pseudonym) but is never exposed.
 */
export const ProfileAccess = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
  GHOST: "GHOST",
} as const;
export type ProfileAccess = (typeof ProfileAccess)[keyof typeof ProfileAccess];

/**
 * Who may see a given passive-content facet — the "authorization" layer.
 * Ordered NONE < FRIENDS < PUBLIC; the effective audience is capped by
 * ProfileAccess (a PRIVATE profile tops out at FRIENDS).
 */
export const VisibilityAudience = {
  PUBLIC: "PUBLIC",
  FRIENDS: "FRIENDS",
  NONE: "NONE",
} as const;
export type VisibilityAudience =
  (typeof VisibilityAudience)[keyof typeof VisibilityAudience];

/**
 * The passive-content facets whose visibility a user tunes per domain. Kept
 * deliberately coarse (2 facets) to keep the privacy screen legible; can be
 * split later without breaking the model.
 * - LIBRARY:  presence + status + progress + favorites for that domain.
 * - ACTIVITY: appearance in the activity feed for that domain.
 * Published content (reviews, comments) is NOT a facet — reviews carry their
 * own explicit scope, comments are public by nature.
 */
export const VisibilityFacet = {
  LIBRARY: "LIBRARY",
  ACTIVITY: "ACTIVITY",
} as const;
export type VisibilityFacet =
  (typeof VisibilityFacet)[keyof typeof VisibilityFacet];

/**
 * State of a directed follow. A follow of a PUBLIC profile is ACCEPTED at once;
 * a follow of a PRIVATE profile is PENDING until the followee approves it.
 */
export const FollowStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
} as const;
export type FollowStatus = (typeof FollowStatus)[keyof typeof FollowStatus];

/**
 * What a review targets. A review carries a mandatory /10 rating + optional
 * text. Works span the four domains; SEASON/EPISODE add finer media levels.
 */
export const ReviewTargetType = {
  MEDIA: "MEDIA",
  SEASON: "SEASON",
  EPISODE: "EPISODE",
  GAME: "GAME",
  BOOK: "BOOK",
  MUSIC: "MUSIC",
} as const;
export type ReviewTargetType =
  (typeof ReviewTargetType)[keyof typeof ReviewTargetType];

/**
 * A review's own audience, chosen at publication (there is no PRIVATE — a
 * review is at least FRIENDS). The effect is only felt when social is enabled;
 * self-host keeps rating locally with nothing exposed. Reading others' reviews
 * and this audience are gated by the social flag.
 */
export const ReviewVisibility = {
  FRIENDS: "FRIENDS",
  PUBLIC: "PUBLIC",
} as const;
export type ReviewVisibility =
  (typeof ReviewVisibility)[keyof typeof ReviewVisibility];
