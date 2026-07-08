import type { CatalogSource, EntryStatus, MediaType } from "../enums";
import type { UserDto } from "./auth";

/** One library entry in a data export: the media plus the user's tracking. */
export interface DataExportEntry {
  media: {
    type: MediaType;
    title: string;
    canonicalSource: CatalogSource;
    /** ID in `canonicalSource` — forms the catalogue identity with `type`. */
    sourceId: string;
    /** All known cross-source identifiers (TMDB, ANILIST, TVDB, IMDB). */
    externalIds: { source: string; externalId: string }[];
  };
  status: EntryStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** One episode viewing in a data export (rewatches appear as separate rows). */
export interface DataExportWatch {
  media: { type: MediaType; title: string; sourceId: string };
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  watchedAt: string;
  rating: number | null;
}

/** Full portable dump of everything the account holds (GDPR "download my data"). */
export interface UserDataExportDto {
  /** ISO datetime the export was produced. */
  exportedAt: string;
  account: UserDto;
  library: DataExportEntry[];
  episodeWatches: DataExportWatch[];
}
