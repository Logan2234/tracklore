import type { BookSource, BookStatus } from "../enums";

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
}

export interface BookSearchResponseDto {
  results: BookSummaryDto[];
}

/** Full book details, fetched live from the source. */
export interface BookDetailsDto extends BookSummaryDto {
  overview: string | null;
  /** Subjects/genres the source tags the book with. */
  genres: string[];
  /** Number of pages, when known. */
  pageCount: number | null;
  /** ISO first-publication date; null when the source has none. */
  releaseDate: string | null;
  /** Wikidata id (`Q…`) of the primary author, for an external link; null when unknown. */
  authorWikidataId: string | null;
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
}

/**
 * Everything the book detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the book is not in the library.
 */
export interface BookDetailDto extends BookDetailsDto {
  entry: BookEntryDto | null;
}

/** How often a genre appears across the user's books. */
export interface BookGenreCountDto {
  genre: string;
  count: number;
}

// --- StoryGraph import ---

/**
 * One CSV row from a StoryGraph export matched to an Open Library work (preview
 * step). The reading metadata (status/rating/notes/dates) is already mapped from
 * the row; the user only chooses whether to import it and may tweak the status.
 */
export interface StoryGraphMatchedBookDto {
  /** Catalogue the book was resolved against (Google Books or Open Library). */
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
  /** 0–10 (StoryGraph's 0–5 stars doubled); null when unrated. */
  rating: number | null;
  /** The CSV review, kept as the entry's notes; null when empty. */
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** Already in the user's Tracklore library (so the UI can flag/skip it). */
  alreadyInLibrary: boolean;
}

/** Preview of a StoryGraph import: what we could match, before writing anything. */
export interface StoryGraphImportPreviewDto {
  /** Total data rows read from the CSV. */
  totalRows: number;
  /** Rows matched to an Open Library work. */
  matched: StoryGraphMatchedBookDto[];
  /** Titles of rows Open Library had no work for (skipped). */
  unmatched: string[];
}

/** One book the user chose to import, with the reading metadata to assign it. */
export interface StoryGraphImportCommitBookDto {
  source: BookSource;
  sourceId: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface StoryGraphImportPreviewRequestDto {
  /** The raw StoryGraph export CSV text. */
  csv: string;
}

export interface StoryGraphImportCommitRequestDto {
  books: StoryGraphImportCommitBookDto[];
}

export interface StoryGraphImportResultDto {
  imported: number;
}

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
  topGenres: BookGenreCountDto[];
}
