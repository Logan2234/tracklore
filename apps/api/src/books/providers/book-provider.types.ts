import type { BookSource, BookSummaryDto } from "@tracklore/shared";

export interface ProviderBookExternalId {
  source: BookSource;
  externalId: string;
}

/** Everything a provider knows about one book, in canonical form. */
export interface ProviderBookDetails {
  summary: BookSummaryDto;
  overview: string | null;
  genres: string[];
  pageCount: number | null;
  releaseDate: string | null;
  externalIds: ProviderBookExternalId[];
}

export interface BookCatalogProvider {
  readonly source: BookSource;
  search(query: string): Promise<BookSummaryDto[]>;
  /** Resolve a single work by ISBN; null when the source knows none. */
  searchByIsbn(isbn: string): Promise<BookSummaryDto | null>;
  getDetails(sourceId: string): Promise<ProviderBookDetails>;
}
