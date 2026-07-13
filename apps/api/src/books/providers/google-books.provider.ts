import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookSource, BookSummaryDto } from "@tracklore/shared";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./book-provider.types";

const API_URL = "https://www.googleapis.com/books/v1/volumes";

interface GoogleImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
}

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  publishedDate?: string; // "2013", "2013-09" or "2013-09-17".
  description?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: GoogleImageLinks;
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
 * Books, from the Google Books API. A single call carries everything we need
 * (title, authors, description, categories, page count and a cover) for both
 * search and details. Its keyless quota is shared and quickly exhausted, so we
 * only use it when a GOOGLE_BOOKS_API_KEY is configured (see `isConfigured`) and
 * always send that key — otherwise the caller falls back to Open Library.
 */
@Injectable()
export class GoogleBooksProvider implements BookCatalogProvider {
  readonly source = BookSource.GOOGLE_BOOKS;

  constructor(private readonly configService: ConfigService) {}

  /** Whether a Google Books API key is set — required to use this provider. */
  isConfigured(): boolean {
    return !!this.configService.get<string>("GOOGLE_BOOKS_API_KEY");
  }

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
      genres: info.categories ?? [],
      pageCount: info.pageCount ?? null,
      releaseDate: toIsoDate(info.publishedDate),
      externalIds: [{ source: BookSource.GOOGLE_BOOKS, externalId: volume.id }],
    };
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
   * serves the odd transient 5xx, so a single retry is made before giving up —
   * the caller then falls back to Open Library.
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
