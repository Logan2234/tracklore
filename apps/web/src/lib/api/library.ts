import type {
  CalendarEntryDto,
  EntryStatus,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaType,
  StatsDto,
  UpsertLibraryEntryDto,
} from "@tracklore/shared";
import { request } from "./core";

export function listLibrary(
  filters: {
    status?: EntryStatus;
    type?: MediaType;
  } = {},
): Promise<LibraryEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/library${suffix}`);
}

export function upsertLibraryEntry(
  body: UpsertLibraryEntryDto,
): Promise<LibraryEntryDto> {
  return request("/library", { method: "PUT", body });
}

export function updateLibraryEntry(
  entryId: string,
  body: Partial<
    Pick<
      LibraryEntryDto,
      | "status"
      | "rating"
      | "notes"
      | "favorite"
      | "ownershipStatus"
      | "ownershipSource"
    >
  >,
): Promise<LibraryEntryDto> {
  return request(`/library/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteLibraryEntry(entryId: string): Promise<void> {
  return request(`/library/entries/${entryId}`, { method: "DELETE" });
}

export function watchEpisode(episodeId: string): Promise<EpisodeWatchDto> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "POST",
    body: {},
  });
}

/** Mark every not-yet-watched episode of a season as watched. */
export function watchSeason(seasonId: string): Promise<void> {
  return request(`/library/seasons/${seasonId}/watches`, { method: "POST" });
}

/** Mark all regular episodes up to and including this one (specials excluded). */
export function watchThrough(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watch-through`, {
    method: "POST",
  });
}

/** Undo the most recent watch of an episode (unwatches it at a single watch). */
export function unwatchEpisode(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "DELETE",
  });
}

export function getCalendar(): Promise<CalendarEntryDto[]> {
  return request("/library/calendar");
}

export function getStats(): Promise<StatsDto> {
  return request("/library/stats");
}
