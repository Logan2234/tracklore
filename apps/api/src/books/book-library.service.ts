import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BookEntry,
  BookExternalId,
  BookItem,
  BookReplay,
  Prisma,
} from "@prisma/client";
import type {
  BookDetailDto,
  BookEntryDto,
  BookItemDto,
  BookReplayDto,
  BookSource,
  BookStatsDto,
  BookStatus,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { BookItemService } from "./book-item.service";
import { aggregateBookStats } from "./book-stats.util";
import { AddBookReplayDto } from "./dto/add-book-replay.dto";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";

// Entries always need the book + its external IDs (canonical sourceId), plus
// its replay history, most recent first.
const ENTRY_INCLUDE = {
  bookItem: { include: { externalIds: true } },
  replays: { orderBy: { finishedAt: "desc" } },
} satisfies Prisma.BookEntryInclude;

type EntryWithBook = Prisma.BookEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

@Injectable()
export class BookLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookItemService: BookItemService,
  ) {}

  /** First touch of a book persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertBookEntryDto,
  ): Promise<BookEntryDto> {
    const bookItem = await this.bookItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
    );

    const changes = {
      status: dto.status,
      rating: dto.rating,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      update: changes,
      create: { userId, bookItemId: bookItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    return toEntryDto(entry);
  }

  async listEntries(
    userId: string,
    filters: { status?: BookStatus },
  ): Promise<BookEntryDto[]> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId, status: filters.status },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    return entries.map(toEntryDto);
  }

  async getEntry(userId: string, entryId: string): Promise<BookEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.bookEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return toEntryDto(entry);
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateBookEntryDto,
  ): Promise<BookEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const entry = await this.prisma.bookEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        rating: dto.rating,
        notes: dto.notes,
        favorite: dto.favorite,
        currentPage: dto.currentPage,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: dto.ownershipSource,
      },
      include: ENTRY_INCLUDE,
    });

    return toEntryDto(entry);
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.bookEntry.delete({ where: { id: entryId } });
  }

  /** Log a completed reread (a completion beyond the entry's first one). */
  async addReplay(
    userId: string,
    entryId: string,
    dto: AddBookReplayDto,
  ): Promise<BookEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    await this.prisma.bookReplay.create({
      data: {
        bookEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });

    const entry = await this.prisma.bookEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return toEntryDto(entry);
  }

  async deleteReplay(userId: string, replayId: string): Promise<void> {
    const replay = await this.prisma.bookReplay.findUnique({
      where: { id: replayId },
      include: { bookEntry: true },
    });

    if (!replay) {
      throw new NotFoundException("Replay not found");
    }

    if (replay.bookEntry.userId !== userId) {
      throw new ForbiddenException("This replay belongs to another user");
    }

    await this.prisma.bookReplay.delete({ where: { id: replayId } });
  }

  /** Aggregated stats for the user's book library. */
  async getStats(userId: string): Promise<BookStatsDto> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        bookItem: { select: { genres: true, authors: true } },
      },
    });

    return aggregateBookStats(
      entries.map((e) => ({
        status: e.status,
        favorite: e.favorite,
        genres: e.bookItem.genres,
        authors: e.bookItem.authors,
      })),
    );
  }

  /**
   * Book detail page: catalogue metadata + the user's library state in one
   * call. Served from the cache when the book is already persisted, otherwise
   * fetched live (persisting nothing — a previewed book must not enter the
   * on-demand cache).
   */
  async getBookDetail(
    userId: string,
    source: BookSource,
    sourceId: string,
  ): Promise<BookDetailDto> {
    const details = await this.bookItemService.getLiveDetails(source, sourceId);

    const ref = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
    });
    const entryRow = ref
      ? await this.prisma.bookEntry.findUnique({
          where: {
            userId_bookItemId: { userId, bookItemId: ref.bookItemId },
          },
          include: ENTRY_INCLUDE,
        })
      : null;

    return { ...details, entry: entryRow ? toEntryDto(entryRow) : null };
  }

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<BookEntry> {
    const entry = await this.prisma.bookEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException("Book library entry not found");
    }

    if (entry.userId !== userId) {
      throw new ForbiddenException("This entry belongs to another user");
    }

    return entry;
  }
}

function toBookItemDto(
  book: BookItem & { externalIds: BookExternalId[] },
): BookItemDto {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    pageCount: book.pageCount,
    canonicalSource: book.canonicalSource,
    sourceId:
      book.externalIds.find((ext) => ext.source === book.canonicalSource)
        ?.externalId ?? "",
  };
}

function toEntryDto(entry: EntryWithBook): BookEntryDto {
  return {
    id: entry.id,
    book: toBookItemDto(entry.bookItem),
    status: entry.status,
    rating: entry.rating,
    notes: entry.notes,
    favorite: entry.favorite,
    currentPage: entry.currentPage,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    replays: entry.replays.map(toReplayDto),
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}

function toReplayDto(replay: BookReplay): BookReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
