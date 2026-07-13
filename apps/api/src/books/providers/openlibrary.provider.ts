import { Injectable, NotFoundException } from "@nestjs/common";
import { BookSource, BookSummaryDto } from "@tracklore/shared";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./book-provider.types";

const SEARCH_URL = "https://openlibrary.org/search.json";
const BASE_URL = "https://openlibrary.org";
const COVERS_URL = "https://covers.openlibrary.org/b/id";

// Fields the search endpoint returns for both list and single-work lookups.
// `author_key` lets the detail view resolve the author's Wikidata id.
const SEARCH_FIELDS =
  "key,title,author_name,author_key,first_publish_year,cover_i,number_of_pages_median,subject";

// Subjects come back long and noisy (dozens per work); keep a handful so genre
// display and stats stay meaningful.
const MAX_SUBJECTS = 8;

interface OpenLibraryDoc {
  key: string; // "/works/OL27482W".
  title?: string;
  author_name?: string[];
  author_key?: string[]; // "OL23919A"; parallel to author_name.
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

interface OpenLibrarySearch {
  docs: OpenLibraryDoc[];
}

interface OpenLibraryWork {
  // Description is either a plain string or a { type, value } typed-text block.
  description?: string | { value: string };
}

interface OpenLibraryAuthor {
  remote_ids?: { wikidata?: string };
}

/**
 * Books, from Open Library — keyless, like AniList. The search endpoint carries
 * everything a summary needs (title, authors, first publish year, cover, page
 * count, subjects) in one call. Details add the description from the work
 * document, which the search index does not expose.
 */
@Injectable()
export class OpenLibraryProvider implements BookCatalogProvider {
  readonly source = BookSource.OPENLIBRARY;

  async search(query: string): Promise<BookSummaryDto[]> {
    const params = new URLSearchParams({
      q: query,
      fields: SEARCH_FIELDS,
      limit: "20",
    });
    const data = await this.get<OpenLibrarySearch>(`${SEARCH_URL}?${params}`);
    return data.docs.map((doc) => this.toSummary(doc));
  }

  /**
   * Resolve a single work by ISBN — the precise path for imports that carry one.
   * Returns null when Open Library knows no edition with that ISBN.
   */
  async searchByIsbn(isbn: string): Promise<BookSummaryDto | null> {
    const params = new URLSearchParams({
      isbn,
      fields: SEARCH_FIELDS,
      limit: "1",
    });
    const data = await this.get<OpenLibrarySearch>(`${SEARCH_URL}?${params}`);
    const doc = data.docs[0];
    return doc ? this.toSummary(doc) : null;
  }

  async getDetails(sourceId: string): Promise<ProviderBookDetails> {
    // One search call resolves the work by key (authors, year, cover, pages,
    // subjects); the work document then adds the description.
    const params = new URLSearchParams({
      q: `key:/works/${sourceId}`,
      fields: SEARCH_FIELDS,
      limit: "1",
    });
    const [search, work] = await Promise.all([
      this.get<OpenLibrarySearch>(`${SEARCH_URL}?${params}`),
      this.get<OpenLibraryWork>(`${BASE_URL}/works/${sourceId}.json`).catch(
        () => null,
      ),
    ]);

    const doc = search.docs[0];
    if (!doc) {
      throw new NotFoundException("Book not found on Open Library");
    }

    return {
      summary: this.toSummary(doc),
      overview: describe(work),
      genres: (doc.subject ?? []).slice(0, MAX_SUBJECTS),
      pageCount: doc.number_of_pages_median ?? null,
      // Open Library exposes only a publication year, no full date.
      releaseDate: null,
      authorWikidataId: await this.authorWikidataId(doc.author_key?.[0]),
      externalIds: [
        { source: BookSource.OPENLIBRARY, externalId: sourceId },
      ],
    };
  }

  /** Best-effort: the primary author's Wikidata id, for an external link. */
  private async authorWikidataId(key?: string): Promise<string | null> {
    if (!key) return null;
    return this.get<OpenLibraryAuthor>(`${BASE_URL}/authors/${key}.json`)
      .then((a) => a.remote_ids?.wikidata ?? null)
      .catch(() => null);
  }

  private toSummary(doc: OpenLibraryDoc): BookSummaryDto {
    return {
      source: BookSource.OPENLIBRARY,
      sourceId: workId(doc.key),
      title: doc.title ?? "Sans titre",
      authors: doc.author_name ?? [],
      year: doc.first_publish_year ?? null,
      coverUrl:
        doc.cover_i != null ? `${COVERS_URL}/${doc.cover_i}-L.jpg` : null,
    };
  }

  private async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Open Library request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

/** Strip the "/works/" prefix from an Open Library key → the bare work id. */
function workId(key: string): string {
  return key.replace(/^\/works\//, "");
}

/** Normalise a work description (plain string or typed-text block) to text. */
function describe(work: OpenLibraryWork | null): string | null {
  if (!work?.description) return null;
  const text =
    typeof work.description === "string"
      ? work.description
      : work.description.value;
  return text.trim() || null;
}
