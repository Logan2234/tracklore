import type {
  BookDetailDto,
  BookEntryDto,
  BookSearchResponseDto,
  BookStatsDto,
  BookStatus,
  GoodreadsImportCommitRequestDto,
  GoodreadsImportPreviewDto,
  GoodreadsImportPreviewRequestDto,
  GoodreadsImportResultDto,
  StoryGraphImportCommitRequestDto,
  StoryGraphImportPreviewDto,
  StoryGraphImportPreviewRequestDto,
  StoryGraphImportResultDto,
  UpdateBookEntryDto,
  UpsertBookEntryDto,
} from "@tracklore/shared";
import { request } from "./core";

export function searchBooks(query: string): Promise<BookSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/books/search?${params}`);
}

export function listBooks(
  filters: { status?: BookStatus } = {},
): Promise<BookEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/books${suffix}`);
}

export function getBookStats(): Promise<BookStatsDto> {
  return request("/books/stats");
}

/** Book detail (catalogue metadata + the user's library state). */
export function getBookDetail(
  source: string,
  sourceId: string,
): Promise<BookDetailDto> {
  return request(`/books/${source.toLowerCase()}/${sourceId}`);
}

export function upsertBookEntry(
  body: UpsertBookEntryDto,
): Promise<BookEntryDto> {
  return request("/books", { method: "PUT", body });
}

export function updateBookEntry(
  entryId: string,
  body: UpdateBookEntryDto,
): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteBookEntry(entryId: string): Promise<void> {
  return request(`/books/entries/${entryId}`, { method: "DELETE" });
}

/** Log a completed reread (a completion beyond the entry's first one). */
export function addBookReplay(entryId: string): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });
}

export function deleteBookReplay(replayId: string): Promise<void> {
  return request(`/books/replays/${replayId}`, { method: "DELETE" });
}

/** Parse + resolve a StoryGraph CSV against Google Books (writes nothing). */
export function previewStoryGraphImport(
  body: StoryGraphImportPreviewRequestDto,
): Promise<StoryGraphImportPreviewDto> {
  return request("/books/import/storygraph/preview", { method: "POST", body });
}

/** Persist the chosen StoryGraph books as library entries. */
export function commitStoryGraphImport(
  body: StoryGraphImportCommitRequestDto,
): Promise<StoryGraphImportResultDto> {
  return request("/books/import/storygraph/commit", { method: "POST", body });
}

/** Parse + resolve a Goodreads CSV against Google Books (writes nothing). */
export function previewGoodreadsImport(
  body: GoodreadsImportPreviewRequestDto,
): Promise<GoodreadsImportPreviewDto> {
  return request("/books/import/goodreads/preview", { method: "POST", body });
}

/** Persist the chosen Goodreads books as library entries. */
export function commitGoodreadsImport(
  body: GoodreadsImportCommitRequestDto,
): Promise<GoodreadsImportResultDto> {
  return request("/books/import/goodreads/commit", { method: "POST", body });
}
