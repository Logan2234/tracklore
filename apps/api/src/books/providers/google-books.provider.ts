import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RatingDto } from "@tracklore/shared";
import { BookSource, BookSummaryDto } from "@tracklore/shared";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./book-provider.types";

const API_URL = "https://www.googleapis.com/books/v1/volumes";

// Google Books has no "similar books" endpoint; other works by the primary
// author is the closest keyless equivalent. Capped so the carousel stays a
// quick browse, not an endless scroll.
const MAX_SAME_AUTHOR_BOOKS = 10;

interface GoogleImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
}

interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string; // "2013", "2013-09" or "2013-09-17".
  description?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: GoogleImageLinks;
  // Stable permalink to the volume's Google Books page. `previewLink` also
  // exists but opens the embedded preview reader instead — not what we want
  // for a plain external link.
  canonicalVolumeLink?: string;
  averageRating?: number; // 1–5.
  ratingsCount?: number;
}

interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
}

interface GoogleVolumeList {
  totalItems: number;
  items?: GoogleVolume[];
}

/**
 * Books, from the Google Books API — the sole book source. A single call
 * carries everything we need (title, authors, description, categories, page
 * count and a cover) for both search and details.
 */
@Injectable()
export class GoogleBooksProvider implements BookCatalogProvider {
  readonly source = BookSource.GOOGLE_BOOKS;

  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<BookSummaryDto[]> {
    const params = new URLSearchParams({
      q: query,
      maxResults: "20",
      printType: "books",
    });
    const data = await this.get<GoogleVolumeList>(`?${params}`);
    return (data.items ?? []).map((v) => this.toSummary(v));
  }

  async searchByIsbn(isbn: string): Promise<BookSummaryDto | null> {
    const params = new URLSearchParams({
      q: `isbn:${isbn}`,
      maxResults: "1",
      printType: "books",
    });
    const data = await this.get<GoogleVolumeList>(`?${params}`);
    const volume = data.items?.[0];
    return volume ? this.toSummary(volume) : null;
  }

  async getDetails(sourceId: string): Promise<ProviderBookDetails> {
    let volume: GoogleVolume;
    try {
      volume = await this.get<GoogleVolume>(`/${encodeURIComponent(sourceId)}`);
    } catch {
      throw new NotFoundException("Book not found on Google Books");
    }

    const info = volume.volumeInfo ?? {};
    return {
      summary: this.toSummary(volume),
      overview: info.description ? stripHtml(info.description) : null,
      subtitle: info.subtitle ?? null,
      publisher: info.publisher ?? null,
      genres: info.categories ?? [],
      pageCount: info.pageCount ?? null,
      releaseDate: toIsoDate(info.publishedDate),
      website: info.canonicalVolumeLink ?? null,
      sameAuthorBooks: await this.sameAuthorBooks(volume.id, info.authors?.[0]),
      ratings: toRatings(info),
      externalIds: [{ source: BookSource.GOOGLE_BOOKS, externalId: volume.id }],
    };
  }

  /** Other books by the primary author, excluding this one. */
  private async sameAuthorBooks(
    excludeId: string,
    author: string | undefined,
  ): Promise<BookSummaryDto[]> {
    if (!author) return [];

    // Drop quotes so the author name can't break out of the query literal.
    const safeAuthor = author.replace(/"/g, "");
    const results = await this.search(`inauthor:"${safeAuthor}"`).catch(
      () => [],
    );
    return results
      .filter((b) => b.sourceId !== excludeId)
      .slice(0, MAX_SAME_AUTHOR_BOOKS);
  }

  private toSummary(volume: GoogleVolume): BookSummaryDto {
    const info = volume.volumeInfo ?? {};
    return {
      source: BookSource.GOOGLE_BOOKS,
      sourceId: volume.id,
      title: info.title ?? "Sans titre",
      authors: info.authors ?? [],
      year: parseYear(info.publishedDate),
      coverUrl: coverUrl(info.imageLinks),
    };
  }

  /**
   * GET a Google Books path, appending the (required) API key. Google Books
   * serves the odd transient 5xx, so a single retry is made before giving up.
   */
  private async get<T>(path: string): Promise<T> {
    const key = this.configService.getOrThrow<string>("GOOGLE_BOOKS_API_KEY");
    const sep = path.includes("?") ? "&" : "?";
    const url = `${API_URL}${path}${sep}key=${key}`;

    let response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status >= 500) {
      response = await fetch(url, { headers: { Accept: "application/json" } });
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Google Books request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

/** Google Books' own average rating (1–5), when known. */
function toRatings(info: GoogleVolumeInfo): RatingDto[] {
  if (info.averageRating == null) return [];
  const count = info.ratingsCount ? ` (${info.ratingsCount})` : "";
  return [{ source: "Google Books", score: `${info.averageRating}/5${count}` }];
}

/** Google serves thumbnails over http; upgrade to https so the PWA can load them. */
function coverUrl(links: GoogleImageLinks | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail;
  return raw ? raw.replace(/^http:/, "https:") : null;
}

function parseYear(publishedDate: string | undefined): number | null {
  const year = Number(publishedDate?.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

/** Keep only full YYYY-MM-DD dates as an ISO string; partial dates → null. */
function toIsoDate(publishedDate: string | undefined): string | null {
  if (!publishedDate || !/^\d{4}-\d{2}-\d{2}$/.test(publishedDate)) return null;
  const date = new Date(publishedDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Google descriptions sometimes carry light HTML; we render them as plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
