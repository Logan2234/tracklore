import type { CatalogSource, EntryStatus, MediaType } from '../enums';

/** A persisted media referenced by at least one user (on-demand cache). */
export interface MediaItemDto {
  id: string;
  type: MediaType;
  title: string;
  posterUrl: string | null;
  canonicalSource: CatalogSource;
}

export interface LibraryEntryDto {
  id: string;
  mediaItem: MediaItemDto;
  status: EntryStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  archived: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Episode progress, only for series/anime. */
  progress: ProgressDto | null;
}

export interface ProgressDto {
  watchedEpisodes: number;
  totalEpisodes: number;
}

/** Body for creating/updating a library entry from a catalogue media. */
export interface UpsertLibraryEntryDto {
  source: CatalogSource;
  sourceId: string;
  status?: EntryStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  archived?: boolean;
}

/** One watch event for one episode; several rows for the same episode = rewatches. */
export interface EpisodeWatchDto {
  id: string;
  episodeId: string;
  watchedAt: string;
  rating: number | null;
}
