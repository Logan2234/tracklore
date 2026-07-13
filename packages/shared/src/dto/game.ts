import type { GameSource, GameStatus } from "../enums";

/** A game as returned by a live catalogue search (not persisted). */
export interface GameSummaryDto {
  source: GameSource;
  sourceId: string;
  title: string;
  /** First release year, when known. */
  year: number | null;
  coverUrl: string | null;
  /** 18+ title (IGDB "Erotic" theme). Restricted per-account, like media. */
  isAdult: boolean;
}

export interface GameSearchResponseDto {
  results: GameSummaryDto[];
}

/** Full game details, fetched live from the source. */
export interface GameDetailsDto extends GameSummaryDto {
  overview: string | null;
  /** Wide artwork/screenshot for the detail header, when available. */
  backdropUrl: string | null;
  genres: string[];
  platforms: string[];
  /** ISO first-release date; null when the source has none. */
  releaseDate: string | null;
}

/** A persisted game referenced by at least one user (on-demand cache). */
export interface GameItemDto {
  id: string;
  title: string;
  coverUrl: string | null;
  canonicalSource: GameSource;
  /** External ID in `canonicalSource`, used to address the game detail page. */
  sourceId: string;
}

export interface GameEntryDto {
  id: string;
  game: GameItemDto;
  status: GameStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  /** Total time played, in minutes (imported from Steam or set manually). */
  playtimeMinutes: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
}

/** Body for creating/updating a library entry from a catalogue game. */
export interface UpsertGameEntryDto {
  source: GameSource;
  sourceId: string;
  status?: GameStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Body for patching an existing game library entry. */
export interface UpdateGameEntryDto {
  status?: GameStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  /** Total time played, in minutes. */
  playtimeMinutes?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/**
 * Everything the game detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the game is not in the library.
 */
export interface GameDetailDto extends GameDetailsDto {
  entry: GameEntryDto | null;
}

/** How often a genre appears across the user's games. */
export interface GameGenreCountDto {
  genre: string;
  count: number;
}

/** How many of the user's games are available on a platform. */
export interface GamePlatformCountDto {
  platform: string;
  count: number;
}

// --- Steam import ---

/** One owned Steam game matched to an IGDB entry (preview step). */
export interface SteamMatchedGameDto {
  /** IGDB id — the catalogue identity used to persist the game. */
  sourceId: string;
  title: string;
  coverUrl: string | null;
  /** Total time played on Steam, in minutes. */
  playtimeMinutes: number;
  /** Played in the last two weeks (Steam `playtime_2weeks`). */
  recentlyPlayed: boolean;
  /** Already in the user's Tracklore library (so the UI can flag/skip it). */
  alreadyInLibrary: boolean;
}

/** Preview of a Steam import: what we could match, before writing anything. */
export interface SteamImportPreviewDto {
  /** Resolved 64-bit SteamID we fetched the library for. */
  steamId: string;
  /** Total games owned on Steam. */
  totalOwned: number;
  /** Owned games matched to an IGDB entry (sorted by playtime, desc). */
  matched: SteamMatchedGameDto[];
  /** Owned games IGDB has no entry for (skipped). */
  unmatchedCount: number;
}

/** One game the user chose to import, with the status to assign it. */
export interface SteamImportCommitGameDto {
  sourceId: string;
  status: GameStatus;
  playtimeMinutes: number;
}

export interface SteamImportPreviewRequestDto {
  /** SteamID64, a vanity name, or a full steamcommunity.com profile URL. */
  steamId: string;
}

export interface SteamImportCommitRequestDto {
  games: SteamImportCommitGameDto[];
}

export interface SteamImportResultDto {
  imported: number;
}

/**
 * Aggregated stats for the user's game library. No playtime yet (games have no
 * session model), so figures are library counts + the status funnel + genre and
 * platform breakdowns.
 */
export interface GameStatsDto {
  totalGames: number;
  backlog: number;
  playing: number;
  completed: number;
  dropped: number;
  favorites: number;
  /** Most-common platforms across the library, descending (top few). */
  topPlatforms: GamePlatformCountDto[];
  /** Most-common genres across the library, descending (top few). */
  topGenres: GameGenreCountDto[];
}
