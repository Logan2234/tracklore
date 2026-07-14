import { Injectable } from "@nestjs/common";
import type {
  BookSummaryDto,
  GoodreadsImportCommitBookDto,
  GoodreadsImportPreviewDto,
  GoodreadsImportResultDto,
  GoodreadsMatchedBookDto,
  GoodreadsUnmatchedBookDto,
} from "@tracklore/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { BookItemService } from "../book-item.service";
import { parseGoodreadsCsv } from "./goodreads-parse";
import type { ParsedGoodreadsRow } from "./goodreads-parse";

// Rows are resolved against the catalogue a few at a time — fast enough for a
// typical export while staying polite to the Google Books API.
const RESOLVE_CONCURRENCY = 5;

@Injectable()
export class GoodreadsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookItemService: BookItemService,
  ) {}

  /**
   * Parse the CSV and resolve every row against Google Books — writing
   * nothing. Rows with an ISBN are resolved together in a handful of batched
   * calls (see `BookItemService.resolveByIsbns`); the rest fall back to an
   * individual title+author search. Each row keeps its Goodreads reading
   * metadata (status/rating/notes/dates).
   */
  async preview(userId: string, csv: string): Promise<GoodreadsImportPreviewDto> {
    const rows = parseGoodreadsCsv(csv);

    const isbnRows = rows.filter(
      (r): r is ParsedGoodreadsRow & { isbn: string } => r.isbn !== null,
    );
    const queryRows = rows.filter((r) => r.isbn === null);

    const uniqueIsbns = Array.from(new Set(isbnRows.map((r) => r.isbn)));
    const { matches, failedIsbns } =
      await this.bookItemService.resolveByIsbns(uniqueIsbns);
    const failedIsbnSet = new Set(failedIsbns);

    const isbnResolved = isbnRows.map((row) => {
      const summary = matches.get(row.isbn) ?? null;
      return {
        row: row as ParsedGoodreadsRow,
        summary,
        apiError: summary === null && failedIsbnSet.has(row.isbn),
      };
    });

    const queryResolved = await mapWithConcurrency(
      queryRows,
      RESOLVE_CONCURRENCY,
      async (row) => ({ row, ...(await this.resolveByQuery(row)) }),
    );

    // Restore the CSV's original row order for the review list.
    const byRow = new Map(
      [...isbnResolved, ...queryResolved].map((r) => [r.row, r]),
    );
    const resolved = rows.map((row) => byRow.get(row)!);

    const summaries = resolved
      .map((r) => r.summary)
      .filter((s): s is BookSummaryDto => s !== null);
    const inLibrary = await this.trackedKeys(userId, summaries);

    const matched: GoodreadsMatchedBookDto[] = [];
    const unmatched: GoodreadsUnmatchedBookDto[] = [];
    const apiErrorCount = resolved.filter((r) => r.apiError).length;

    for (const { row, summary } of resolved) {
      if (!summary) {
        unmatched.push({
          csvTitle: row.title,
          status: row.status,
          rating: row.rating,
          notes: row.notes,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          ownershipStatus: row.ownershipStatus,
          readCount: row.readCount,
        });
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
        ownershipStatus: row.ownershipStatus,
        readCount: row.readCount,
        alreadyInLibrary: inLibrary.has(
          refKey(summary.source, summary.sourceId),
        ),
      });
    }

    return { totalRows: rows.length, matched, unmatched, apiErrorCount };
  }

  /**
   * Persist the chosen books (fetching each work's full details) and upsert a
   * library entry for each with its imported reading metadata.
   */
  async commit(
    userId: string,
    books: GoodreadsImportCommitBookDto[],
  ): Promise<GoodreadsImportResultDto> {
    let imported = 0;

    for (const book of books) {
      const details = await this.bookItemService
        .providerFor()
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
        ownershipStatus: book.ownershipStatus,
      };
      // Only a first-time import backfills replays from "Read Count" — an
      // existing entry may already have its own, and re-running the same
      // import shouldn't keep piling more on.
      const existing = await this.prisma.bookEntry.findUnique({
        where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
        select: { id: true },
      });
      const entry = await this.prisma.bookEntry.upsert({
        where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
        update: data,
        create: { userId, bookItemId: bookItem.id, ...data },
      });

      if (!existing && book.readCount > 1) {
        await this.prisma.bookReplay.createMany({
          data: Array.from({ length: book.readCount - 1 }, () => ({
            bookEntryId: entry.id,
            finishedAt: book.finishedAt
              ? new Date(book.finishedAt)
              : new Date(),
          })),
        });
      }

      imported++;
    }

    return { imported };
  }

  /**
   * Resolve a row that has no ISBN by a title+author search. An API failure
   * (rate limit, outage) is reported as `apiError` instead of a plain "not
   * found", so the preview can tell the two apart.
   */
  private async resolveByQuery(
    row: ParsedGoodreadsRow,
  ): Promise<{ summary: BookSummaryDto | null; apiError: boolean }> {
    const query = [row.title, row.authors[0]].filter(Boolean).join(" ");
    try {
      const summary = await this.bookItemService.resolve(null, query);
      return { summary, apiError: false };
    } catch {
      return { summary: null, apiError: true };
    }
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
