import type {
  GameDetailDto,
  GameEntryDto,
  GameSearchResponseDto,
  GameStatsDto,
  GameStatus,
  SteamImportCommitRequestDto,
  SteamImportPreviewDto,
  SteamImportPreviewRequestDto,
  SteamImportResultDto,
  UpdateGameEntryDto,
  UpsertGameEntryDto,
} from "@tracklore/shared";
import { request } from "./core";

export function searchGames(query: string): Promise<GameSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/games/search?${params}`);
}

export function listGames(
  filters: { status?: GameStatus } = {},
): Promise<GameEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/games${suffix}`);
}

export function getGameStats(): Promise<GameStatsDto> {
  return request("/games/stats");
}

/** Resolve + match a Steam library against IGDB (writes nothing). */
export function previewSteamImport(
  body: SteamImportPreviewRequestDto,
): Promise<SteamImportPreviewDto> {
  return request("/games/import/steam/preview", { method: "POST", body });
}

/** Persist the chosen Steam games as library entries. */
export function commitSteamImport(
  body: SteamImportCommitRequestDto,
): Promise<SteamImportResultDto> {
  return request("/games/import/steam/commit", { method: "POST", body });
}

/** Game detail (catalogue metadata + the user's library state). */
export function getGameDetail(
  source: string,
  sourceId: string,
): Promise<GameDetailDto> {
  return request(`/games/${source.toLowerCase()}/${sourceId}`);
}

export function upsertGameEntry(
  body: UpsertGameEntryDto,
): Promise<GameEntryDto> {
  return request("/games", { method: "PUT", body });
}

export function updateGameEntry(
  entryId: string,
  body: UpdateGameEntryDto,
): Promise<GameEntryDto> {
  return request(`/games/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteGameEntry(entryId: string): Promise<void> {
  return request(`/games/entries/${entryId}`, { method: "DELETE" });
}

/** Log a completed replay (a completion beyond the entry's first one). */
export function addGameReplay(entryId: string): Promise<GameEntryDto> {
  return request(`/games/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });
}

export function deleteGameReplay(replayId: string): Promise<void> {
  return request(`/games/replays/${replayId}`, { method: "DELETE" });
}
