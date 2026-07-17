import type { BookOwnershipStatus, BookSource, BookStatus } from "../enums";
import type { RatingDto } from "./catalog";
import type { ImportResultDto } from "./import";
import type { GenreCountDto } from "./library";

/** A book as returned by a live catalogue search (not persisted). */
export interface BookSummaryDto {
  source: BookSource;
  sourceId: string;
  title: string;
  /** Author names, when known. */
  authors: string[];
  /** First publication year, when known. */
  year: number | null;
  coverUrl: string | null;
  /** 18+ title (Google Books "MATURE"). Restricted per-account, like media. */
  isAdult: boolean;
}

export interface BookSearchResponseDto {
  results: BookSummaryDto[];
}

/** Full book details, fetched live from the source. */
export interface BookDetailsDto extends BookSummaryDto {
  overview: string | null;
  subtitle: string | null;
  publisher: string | null;
  /** Subjects/genres the source tags the book with. */
  genres: string[];
  /** Number of pages, when known. */
  pageCount: number | null;
  /** ISO first-publication date; null when the source has none. */
  releaseDate: string | null;
  /** Permalink to the volume's Google Books page, when known. */
  website: string | null;
  /** Other books by the primary author — stands in for "similar titles". */
  sameAuthorBooks: BookSummaryDto[];
  /** Google Books' own average rating, when known. */
  ratings: RatingDto[];
}

/** A persisted book referenced by at least one user (on-demand cache). */
export interface BookItemDto {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  canonicalSource: BookSource;
  /** External ID in `canonicalSource`, used to address the book detail page. */
  sourceId: string;
}

/** One completed reread, beyond the entry's own (first) completion. */
export interface BookReplayDto {
  id: string;
  /** ISO date the reread was completed. */
  finishedAt: string;
}

export interface BookEntryDto {
  id: string;
  book: BookItemDto;
  status: BookStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  /** Current reading position, in pages (0 = not started). */
  currentPage: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** Completed rereads beyond the first, most recent first. */
  replays: BookReplayDto[];
  /** How the user holds this book, if set (NONE = unset). */
  ownershipStatus: BookOwnershipStatus;
  /** Free-form detail for DIGITAL/AUDIO (e.g. "Kindle"); null otherwise. */
  ownershipSource: string | null;
}

/** Body for logging a completed reread. */
export interface AddBookReplayDto {
  /** ISO date; defaults to now. */
  finishedAt?: string;
}

/** Body for creating/updating a library entry from a catalogue book. */
export interface UpsertBookEntryDto {
  source: BookSource;
  sourceId: string;
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Body for patching an existing book library entry. */
export interface UpdateBookEntryDto {
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  /** Current reading position, in pages. */
  currentPage?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  ownershipStatus?: BookOwnershipStatus;
  ownershipSource?: string | null;
}

/**
 * Everything the book detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the book is not in the library.
 */
export interface BookDetailDto extends BookDetailsDto {
  entry: BookEntryDto | null;
}

// --- CSV import (StoryGraph + Goodreads share one shape; they only differ in
// whether the source export has a "date started" column) ---

/**
 * One CSV row from a StoryGraph/Goodreads export matched to a Google Books
 * volume (preview step). The reading metadata (status/rating/notes/dates) is
 * already mapped from the row; the user only chooses whether to import it and
 * may tweak the status.
 */
export interface CsvMatchedBookDto<TStartedAt> {
  source: BookSource;
  /** Catalogue id in `source` — the identity used to persist the book. */
  sourceId: string;
  /** Title of the matched catalogue work (may differ from the CSV title). */
  title: string;
  authors: string[];
  coverUrl: string | null;
  /** Original title from the CSV, shown when the match looks uncertain. */
  csvTitle: string;
  status: BookStatus;
  /** 0–10 (source's 0–5 stars doubled); null when unrated. */
  rating: number | null;
  /** The CSV review, kept as the entry's notes; null when empty. */
  notes: string | null;
  startedAt: TStartedAt;
  finishedAt: string | null;
  ownershipStatus: BookOwnershipStatus;
  /** Source's "Read Count" — logs (count - 1) replays on import. */
  readCount: number;
  /** Already in the user's Tracklore library (so the UI can flag/skip it). */
  alreadyInLibrary: boolean;
}

/**
 * One CSV row Google Books had no volume for — the reading metadata is kept
 * so the user can still import it once manually associated to a book.
 */
export interface CsvUnmatchedBookDto<TStartedAt> {
  csvTitle: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  startedAt: TStartedAt;
  finishedAt: string | null;
  ownershipStatus: BookOwnershipStatus;
  readCount: number;
}

/** Preview of a CSV import: what we could match, before writing anything. */
export interface CsvImportPreviewDto<TStartedAt> {
  /** Total data rows read from the CSV. */
  totalRows: number;
  /** Rows matched to a Google Books volume. */
  matched: CsvMatchedBookDto<TStartedAt>[];
  /** Rows Google Books had no volume for — may be associated manually. */
  unmatched: CsvUnmatchedBookDto<TStartedAt>[];
  /**
   * How many of `unmatched` failed because the Google Books call itself
   * errored (rate limit, outage) rather than genuinely finding no volume —
   * distinguishes "retry the import later" from "needs manual matching".
   */
  apiErrorCount: number;
}

/** One book the user chose to import, with the reading metadata to assign it. */
export interface CsvImportCommitBookDto<TStartedAt> {
  source: BookSource;
  sourceId: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  startedAt: TStartedAt;
  finishedAt: string | null;
  ownershipStatus: BookOwnershipStatus;
  readCount: number;
}

interface CsvImportPreviewRequestDto {
  /** The raw export CSV text. */
  csv: string;
}

interface CsvImportCommitRequestDto<TStartedAt> {
  books: CsvImportCommitBookDto<TStartedAt>[];
}

// --- StoryGraph import ---
// (ownershipStatus derived from the CSV's "Format" + "Owned?" columns)

export type StoryGraphMatchedBookDto = CsvMatchedBookDto<string | null>;
export type StoryGraphUnmatchedBookDto = CsvUnmatchedBookDto<string | null>;
export type StoryGraphImportPreviewDto = CsvImportPreviewDto<string | null>;
export type StoryGraphImportCommitBookDto = CsvImportCommitBookDto<
  string | null
>;
export type StoryGraphImportPreviewRequestDto = CsvImportPreviewRequestDto;
export type StoryGraphImportCommitRequestDto = CsvImportCommitRequestDto<
  string | null
>;
export type StoryGraphImportResultDto = ImportResultDto;

// --- Goodreads import ---
// (ownershipStatus derived from the CSV's "Owned Copies" + "Binding" columns;
// the export has no "date started" column, hence `startedAt: null`)

export type GoodreadsMatchedBookDto = CsvMatchedBookDto<null>;
export type GoodreadsUnmatchedBookDto = CsvUnmatchedBookDto<null>;
export type GoodreadsImportPreviewDto = CsvImportPreviewDto<null>;
export type GoodreadsImportCommitBookDto = CsvImportCommitBookDto<null>;
export type GoodreadsImportPreviewRequestDto = CsvImportPreviewRequestDto;
export type GoodreadsImportCommitRequestDto = CsvImportCommitRequestDto<null>;
export type GoodreadsImportResultDto = ImportResultDto;

/** How many of the user's books an author wrote. */
export interface BookAuthorCountDto {
  author: string;
  count: number;
}

/**
 * Aggregated stats for the user's book library: library counts + the status
 * funnel + genre and author breakdowns.
 */
export interface BookStatsDto {
  totalBooks: number;
  toRead: number;
  reading: number;
  read: number;
  dropped: number;
  favorites: number;
  /** Most-read authors across the library, descending (top few). */
  topAuthors: BookAuthorCountDto[];
  /** Most-common genres across the library, descending (top few). */
  topGenres: GenreCountDto[];
}
