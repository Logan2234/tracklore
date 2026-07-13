import { Injectable } from "@nestjs/common";
import type {
  BookSummaryDto,
  StoryGraphImportCommitBookDto,
  StoryGraphImportPreviewDto,
  StoryGraphImportResultDto,
  StoryGraphMatchedBookDto,
} from "@tracklore/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { BookItemService } from "../book-item.service";
import { parseStoryGraphCsv } from "./storygraph-parse";
import type { ParsedStoryGraphRow } from "./storygraph-parse";

// Rows are resolved against the catalogue a few at a time — fast enough for a
// typical export while staying polite to a free, unauthenticated API.
const RESOLVE_CONCURRENCY = 5;

@Injectable()
export class StoryGraphImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookItemService: BookItemService,
  ) {}

  /**
   * Parse the CSV and resolve every row against Open Library — writing nothing.
   * Each row keeps its StoryGraph reading metadata (status/rating/notes/dates).
   */
  async preview(
    userId: string,
    csv: string,
  ): Promise<StoryGraphImportPreviewDto> {
    const rows = parseStoryGraphCsv(csv);

    const resolved = await mapWithConcurrency(
      rows,
      RESOLVE_CONCURRENCY,
      async (row) => ({ row, summary: await this.resolve(row) }),
    );

    const summaries = resolved
      .map((r) => r.summary)
      .filter((s): s is BookSummaryDto => s != null);
    const inLibrary = await this.trackedKeys(userId, summaries);

    const matched: StoryGraphMatchedBookDto[] = [];
    const unmatched: string[] = [];
    for (const { row, summary } of resolved) {
      if (!summary) {
        unmatched.push(row.title);
        continue;
      }
      matched.push({
        source: summary.source,
        sourceId: summary.sourceId,
        title: summary.title,
        authors: summary.authors,
        coverUrl: summary.coverUrl,
        csvTitle: row.title,
        status: row.status,
        rating: row.rating,
        notes: row.notes,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        alreadyInLibrary: inLibrary.has(refKey(summary.source, summary.sourceId)),
      });
    }

    return { totalRows: rows.length, matched, unmatched };
  }

  /**
   * Persist the chosen books (fetching each work's full details) and upsert a
   * library entry for each with its imported reading metadata.
   */
  async commit(
    userId: string,
    books: StoryGraphImportCommitBookDto[],
  ): Promise<StoryGraphImportResultDto> {
    let imported = 0;

    for (const book of books) {
      const details = await this.bookItemService
        .providerFor(book.source)
        .getDetails(book.sourceId)
        .catch(() => null);
      if (!details) continue;

      const bookItem = await this.bookItemService.persistDetails(
        book.source,
        details,
      );
      // A finished book with a known length reads as fully progressed.
      const currentPage =
        book.status === "READ" && details.pageCount ? details.pageCount : 0;

      const data = {
        status: book.status,
        rating: book.rating,
        notes: book.notes,
        currentPage,
        startedAt: book.startedAt ? new Date(book.startedAt) : null,
        finishedAt: book.finishedAt ? new Date(book.finishedAt) : null,
      };
      await this.prisma.bookEntry.upsert({
        where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
        update: data,
        create: { userId, bookItemId: bookItem.id, ...data },
      });
      imported++;
    }

    return { imported };
  }

  /** Resolve one row to a catalogue work: by ISBN first, then title+author. */
  private resolve(row: ParsedStoryGraphRow): Promise<BookSummaryDto | null> {
    const query = [row.title, row.authors[0]].filter(Boolean).join(" ");
    return this.bookItemService.resolve(row.isbn, query);
  }

  /** `source|externalId` keys (of the given set) the user already tracks. */
  private async trackedKeys(
    userId: string,
    summaries: BookSummaryDto[],
  ): Promise<Set<string>> {
    if (summaries.length === 0) return new Set();

    const externalIds = summaries.map((s) => s.sourceId);
    const wanted = new Set(summaries.map((s) => refKey(s.source, s.sourceId)));
    const refs = await this.prisma.bookExternalId.findMany({
      where: { externalId: { in: externalIds } },
      select: { source: true, externalId: true, bookItemId: true },
    });
    // Keep only refs whose (source, id) pair we actually asked about.
    const relevant = refs.filter((r) =>
      wanted.has(refKey(r.source, r.externalId)),
    );
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId, bookItemId: { in: relevant.map((r) => r.bookItemId) } },
      select: { bookItemId: true },
    });
    const owned = new Set(entries.map((e) => e.bookItemId));
    return new Set(
      relevant
        .filter((r) => owned.has(r.bookItemId))
        .map((r) => refKey(r.source, r.externalId)),
    );
  }
}

/** Stable key for a (source, external id) pair. */
function refKey(source: string, externalId: string): string {
  return `${source}|${externalId}`;
}

/** Map an array with a bounded number of in-flight async operations. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
