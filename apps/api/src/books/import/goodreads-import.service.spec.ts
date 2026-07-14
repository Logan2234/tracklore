import type { BookSummaryDto } from "@tracklore/shared";
import { GoodreadsImportService } from "./goodreads-import.service";
import type { BookItemService } from "../book-item.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AgeGateService } from "../../users/age-gate.service";

const HEADER =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

function summary(over: Partial<BookSummaryDto> = {}): BookSummaryDto {
  return {
    source: "GOOGLE_BOOKS",
    sourceId: "G1W",
    title: "A Book",
    authors: ["Someone"],
    year: 2000,
    coverUrl: null,
    isAdult: false,
    ...over,
  };
}

describe("GoodreadsImportService", () => {
  function setup(
    overrides: {
      /** Mocks `BookItemService.resolve` — only called for ISBN-less rows. */
      resolve?: jest.Mock;
      /** Mocks `BookItemService.resolveByIsbns` — the batched ISBN path. */
      resolveByIsbns?: jest.Mock;
      getDetails?: jest.Mock;
      inLibraryRefs?: {
        source: string;
        externalId: string;
        bookItemId: string;
      }[];
      ownedEntries?: { bookItemId: string }[];
      /** Null (default) simulates a first-time import; non-null simulates a re-run. */
      existingEntry?: { id: string } | null;
      /** Whether the account may see 18+ titles (default: yes). */
      allowAdult?: boolean;
    } = {},
  ) {
    const getDetails = overrides.getDetails ?? jest.fn();
    const bookItemService = {
      resolve: overrides.resolve ?? jest.fn().mockResolvedValue(null),
      resolveByIsbns:
        overrides.resolveByIsbns ??
        jest.fn().mockResolvedValue({ matches: new Map(), failedIsbns: [] }),
      providerFor: jest.fn().mockReturnValue({ getDetails }),
      persistDetails: jest.fn().mockResolvedValue({ id: "item-1" }),
    };
    const upsert = jest.fn().mockResolvedValue({ id: "entry-1" });
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      bookExternalId: {
        findMany: jest.fn().mockResolvedValue(overrides.inLibraryRefs ?? []),
      },
      bookEntry: {
        findMany: jest.fn().mockResolvedValue(overrides.ownedEntries ?? []),
        findUnique: jest
          .fn()
          .mockResolvedValue(overrides.existingEntry ?? null),
        upsert,
      },
      bookReplay: { createMany },
    };

    const ageGate = {
      allowsAdultContent: jest
        .fn()
        .mockResolvedValue(overrides.allowAdult ?? true),
    };

    const service = new GoodreadsImportService(
      prisma as unknown as PrismaService,
      bookItemService as unknown as BookItemService,
      ageGate as unknown as AgeGateService,
    );
    return { service, bookItemService, upsert, createMany };
  }

  it("resolves each row and reports the unmatched ones", async () => {
    // "Résister" carries an ISBN → resolved via the batched ISBN path.
    const resolveByIsbns = jest.fn().mockResolvedValue({
      matches: new Map([
        [
          "9782228937597",
          summary({ source: "GOOGLE_BOOKS", sourceId: "G-1", title: "First" }),
        ],
      ]),
      failedIsbns: [],
    });
    // The other two rows have no ISBN → resolved by title+author search.
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(
        summary({ source: "GOOGLE_BOOKS", sourceId: "G-2", title: "Second" }),
      )
      .mockResolvedValueOnce(null); // Unmatched.
    const { service } = setup({ resolve, resolveByIsbns });

    const csv = [
      HEADER,
      '1,Résister,Salomé Saqué,"Saqué, Salomé",,="",="9782228937597",4,3.90,,Paperback,,,,2025/03/31,2025/01/01,read,,read,,0,,1,1',
      '2,Findable,Author One,"One, Author",,="",="",0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
      '3,Nowhere,Author Two,"Two, Author",,="",="",0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
    ].join("\n");

    const preview = await service.preview("user-1", csv);

    expect(preview.totalRows).toBe(3);
    expect(preview.matched.map((m) => [m.source, m.sourceId])).toEqual([
      ["GOOGLE_BOOKS", "G-1"],
      ["GOOGLE_BOOKS", "G-2"],
    ]);
    expect(preview.unmatched).toEqual([
      expect.objectContaining({ csvTitle: "Nowhere" }),
    ]);
    // The ISBN row keeps its mapped reading metadata, including ownership
    // (Binding "Paperback" → PHYSICAL) and the read count (1).
    expect(preview.matched[0]).toMatchObject({
      csvTitle: "Résister",
      status: "READ",
      rating: 8,
      finishedAt: "2025-03-31T00:00:00.000Z",
      ownershipStatus: "PHYSICAL",
      readCount: 1,
    });
  });

  it("counts API failures separately from genuine non-matches", async () => {
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(
        summary({ source: "GOOGLE_BOOKS", sourceId: "G-1", title: "First" }),
      )
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce(null); // Genuinely not found.
    const { service } = setup({ resolve });

    const csv = [
      HEADER,
      "1,First,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
      "2,Second,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
      "3,Third,X,X,,,,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0",
    ].join("\n");

    const preview = await service.preview("user-1", csv);

    expect(preview.matched).toHaveLength(1);
    expect(preview.unmatched).toHaveLength(2); // Both the API failure and the real miss.
    expect(preview.apiErrorCount).toBe(1);
  });

  it("does not retry a failed ISBN batch lookup by title+author", async () => {
    const resolveByIsbns = jest.fn().mockResolvedValue({
      matches: new Map(),
      failedIsbns: ["9782228937597"],
    });
    const resolve = jest.fn(); // Must not be called for the ISBN row.
    const { service } = setup({ resolve, resolveByIsbns });

    const csv = [
      HEADER,
      '1,Résister,Salomé Saqué,"Saqué, Salomé",,,9782228937597,0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
    ].join("\n");

    const preview = await service.preview("user-1", csv);

    expect(preview.matched).toHaveLength(0);
    expect(preview.unmatched).toEqual([
      expect.objectContaining({ csvTitle: "Résister" }),
    ]);
    expect(preview.apiErrorCount).toBe(1);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("flags books already in the user's library by (source, id)", async () => {
    const { service } = setup({
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([
          [
            "9782228937597",
            summary({ source: "GOOGLE_BOOKS", sourceId: "G-DUP" }),
          ],
        ]),
        failedIsbns: [],
      }),
      inLibraryRefs: [
        { source: "GOOGLE_BOOKS", externalId: "G-DUP", bookItemId: "item-dup" },
      ],
      ownedEntries: [{ bookItemId: "item-dup" }],
    });

    const csv = [
      HEADER,
      '1,Dup,Author,"Author, Some",,="",="9782228937597",4,0,,Paperback,,,,2025/07/23,2025/01/01,read,,read,,0,,0,1',
    ].join("\n");

    const preview = await service.preview("user-1", csv);
    expect(preview.matched[0].alreadyInLibrary).toBe(true);
  });

  it("persists via the book's own source, marking finished ones fully read", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ source: "GOOGLE_BOOKS", sourceId: "G-1" }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "G-1" }],
    });
    const { service, bookItemService, upsert } = setup({ getDetails });

    const result = await service.commit("user-1", [
      {
        source: "GOOGLE_BOOKS",
        sourceId: "G-1",
        status: "READ",
        rating: 8,
        notes: "loved it",
        startedAt: null,
        finishedAt: "2025-03-31T00:00:00.000Z",
        ownershipStatus: "PHYSICAL",
        readCount: 1,
      },
    ]);

    expect(result.imported).toBe(1);
    expect(bookItemService.providerFor).toHaveBeenCalled();
    const data = upsert.mock.calls[0][0].create;
    expect(data).toMatchObject({
      status: "READ",
      rating: 8,
      notes: "loved it",
      currentPage: 320, // Finished + known length → full progress.
      ownershipStatus: "PHYSICAL",
    });
    expect(data.finishedAt).toEqual(new Date("2025-03-31T00:00:00.000Z"));
  });

  it("backfills replays from the read count on a first-time import", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ source: "GOOGLE_BOOKS", sourceId: "G-1" }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "G-1" }],
    });
    const { service, createMany } = setup({ getDetails, existingEntry: null });

    await service.commit("user-1", [
      {
        source: "GOOGLE_BOOKS",
        sourceId: "G-1",
        status: "READ",
        rating: null,
        notes: null,
        startedAt: null,
        finishedAt: "2025-03-31T00:00:00.000Z",
        ownershipStatus: "NONE",
        readCount: 3,
      },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          bookEntryId: "entry-1",
          finishedAt: new Date("2025-03-31T00:00:00.000Z"),
        },
        {
          bookEntryId: "entry-1",
          finishedAt: new Date("2025-03-31T00:00:00.000Z"),
        },
      ],
    });
  });

  it("skips adult titles in the preview when the account is not opted in", async () => {
    const resolveByIsbns = jest.fn().mockResolvedValue({
      matches: new Map([
        [
          "9782228937597",
          summary({ sourceId: "G-ADULT", title: "Adult", isAdult: true }),
        ],
      ]),
      failedIsbns: [],
    });
    const { service } = setup({ resolveByIsbns, allowAdult: false });

    const csv = [
      HEADER,
      '1,Adult,Author,"Author, Some",,="",="9782228937597",4,0,,Paperback,,,,2025/07/23,2025/01/01,read,,read,,0,,0,1',
    ].join("\n");

    const preview = await service.preview("user-1", csv);
    // Neither offered for import nor reported as "unmatched" — just skipped.
    expect(preview.matched).toHaveLength(0);
    expect(preview.unmatched).toHaveLength(0);
  });

  it("skips adult titles on commit even if the client sends their ids", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ sourceId: "G-ADULT", isAdult: true }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "G-ADULT" }],
    });
    const { service, upsert } = setup({ getDetails, allowAdult: false });

    const result = await service.commit("user-1", [
      {
        source: "GOOGLE_BOOKS",
        sourceId: "G-ADULT",
        status: "READ",
        rating: null,
        notes: null,
        startedAt: null,
        finishedAt: null,
        ownershipStatus: "NONE",
        readCount: 1,
      },
    ]);

    expect(result.imported).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not backfill replays when the entry already exists", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ source: "GOOGLE_BOOKS", sourceId: "G-1" }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "G-1" }],
    });
    const { service, createMany } = setup({
      getDetails,
      existingEntry: { id: "entry-1" },
    });

    await service.commit("user-1", [
      {
        source: "GOOGLE_BOOKS",
        sourceId: "G-1",
        status: "READ",
        rating: null,
        notes: null,
        startedAt: null,
        finishedAt: "2025-03-31T00:00:00.000Z",
        ownershipStatus: "NONE",
        readCount: 3,
      },
    ]);

    expect(createMany).not.toHaveBeenCalled();
  });
});
