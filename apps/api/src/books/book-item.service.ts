import { Injectable } from "@nestjs/common";
import type { BookItem } from "@prisma/client";
import type {
  BookDetailsDto,
  BookSource,
  BookSummaryDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleBooksProvider } from "./providers/google-books.provider";
import { OpenLibraryProvider } from "./providers/openlibrary.provider";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./providers/book-provider.types";

// A cached book referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BookItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleBooksProvider: GoogleBooksProvider,
    private readonly openLibraryProvider: OpenLibraryProvider,
  ) {}

  providerFor(source: BookSource): BookCatalogProvider {
    switch (source) {
      case "GOOGLE_BOOKS":
        return this.googleBooksProvider;
      case "OPENLIBRARY":
      default:
        return this.openLibraryProvider;
    }
  }

  /**
   * Providers to try, in priority order: Google Books first when a key is
   * configured (richer data), then Open Library (keyless fallback). Without a
   * key, Google is skipped entirely so we never hit its exhausted keyless quota.
   */
  private orderedProviders(): BookCatalogProvider[] {
    return this.googleBooksProvider.isConfigured()
      ? [this.googleBooksProvider, this.openLibraryProvider]
      : [this.openLibraryProvider];
  }

  /** Free-text catalogue search: first provider that returns any result wins. */
  async search(query: string): Promise<BookSummaryDto[]> {
    for (const provider of this.orderedProviders()) {
      const results = await provider.search(query).catch(() => []);
      if (results.length > 0) return results;
    }
    return [];
  }

  /**
   * Resolve one book (an ISBN and/or a free-text query) to a single catalogue
   * work. Each provider is tried ISBN-first, then by query; the first hit — from
   * Google Books when available, else Open Library — is returned.
   */
  async resolve(isbn: string | null, query: string): Promise<BookSummaryDto | null> {
    for (const provider of this.orderedProviders()) {
      if (isbn) {
        const byIsbn = await provider.searchByIsbn(isbn).catch(() => null);
        if (byIsbn) return byIsbn;
      }
      const results = await provider.search(query).catch(() => []);
      if (results[0]) return results[0];
    }
    return null;
  }

  /** Live details straight from the provider — nothing is persisted. */
  async getLiveDetails(
    source: BookSource,
    sourceId: string,
  ): Promise<BookDetailsDto> {
    const details = await this.providerFor(source).getDetails(sourceId);
    return {
      ...details.summary,
      overview: details.overview,
      genres: details.genres,
      pageCount: details.pageCount,
      releaseDate: details.releaseDate,
      authorWikidataId: details.authorWikidataId,
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing a book.
   * Fetches from the canonical source and persists the book with its external
   * IDs. Throttled by lastSyncedAt (24h TTL).
   */
  async upsertFromSource(
    source: BookSource,
    sourceId: string,
  ): Promise<BookItem> {
    const existingRef = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
      include: { bookItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.bookItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.bookItem;
    }

    const details = await this.providerFor(source).getDetails(sourceId);
    return this.persistDetails(source, details);
  }

  /**
   * Persist a book from details already fetched from the provider (create or
   * refresh).
   */
  async persistDetails(
    source: BookSource,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    const canonicalId = details.externalIds.find(
      (ext) => ext.source === source,
    )?.externalId;
    if (!canonicalId) {
      throw new Error(`Provider details for ${source} carry no ${source} id`);
    }

    const existingRef = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: canonicalId } },
    });
    return existingRef
      ? this.refresh(existingRef.bookItemId, details)
      : this.createFresh(source, details);
  }

  private async createFresh(
    source: BookSource,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    return this.prisma.bookItem.create({
      data: {
        ...this.baseFields(details),
        canonicalSource: source,
        externalIds: {
          create: details.externalIds.map((ext) => ({
            source: ext.source,
            externalId: ext.externalId,
          })),
        },
      },
    });
  }

  private async refresh(
    bookItemId: string,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    const item = await this.prisma.bookItem.update({
      where: { id: bookItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.bookExternalId.upsert({
        where: {
          source_externalId: { source: ext.source, externalId: ext.externalId },
        },
        update: { bookItemId },
        create: { bookItemId, source: ext.source, externalId: ext.externalId },
      });
    }

    return item;
  }

  private baseFields(details: ProviderBookDetails) {
    return {
      title: details.summary.title,
      authors: details.summary.authors,
      coverUrl: details.summary.coverUrl,
      overview: details.overview,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      genres: details.genres,
      pageCount: details.pageCount,
      lastSyncedAt: new Date(),
    };
  }
}
