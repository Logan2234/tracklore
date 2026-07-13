import type { BookSummaryDto } from "@tracklore/shared";
import { StoryGraphImportService } from "./storygraph-import.service";
import type { BookItemService } from "../book-item.service";
import type { PrismaService } from "../../prisma/prisma.service";

const HEADER =
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?";

function summary(over: Partial<BookSummaryDto> = {}): BookSummaryDto {
  return {
    source: "OPENLIBRARY",
    sourceId: "OL1W",
    title: "A Book",
    authors: ["Someone"],
    year: 2000,
    coverUrl: null,
    ...over,
  };
}

describe("StoryGraphImportService", () => {
  function setup(overrides: {
    resolve?: jest.Mock;
    getDetails?: jest.Mock;
    inLibraryRefs?: { source: string; externalId: string; bookItemId: string }[];
    ownedEntries?: { bookItemId: string }[];
  } = {}) {
    const getDetails = overrides.getDetails ?? jest.fn();
    const bookItemService = {
      resolve: overrides.resolve ?? jest.fn().mockResolvedValue(null),
      providerFor: jest.fn().mockReturnValue({ getDetails }),
      persistDetails: jest.fn().mockResolvedValue({ id: "item-1" }),
    };
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      bookExternalId: {
        findMany: jest.fn().mockResolvedValue(overrides.inLibraryRefs ?? []),
      },
      bookEntry: {
        findMany: jest.fn().mockResolvedValue(overrides.ownedEntries ?? []),
        upsert,
      },
    };

    const service = new StoryGraphImportService(
      prisma as unknown as PrismaService,
      bookItemService as unknown as BookItemService,
    );
    return { service, bookItemService, upsert };
  }

  it("resolves each row and reports the unmatched ones", async () => {
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(
        summary({ source: "GOOGLE_BOOKS", sourceId: "G-1", title: "By Google" }),
      )
      .mockResolvedValueOnce(
        summary({ source: "OPENLIBRARY", sourceId: "OL-2", title: "By OL" }),
      )
      .mockResolvedValueOnce(null); // Unmatched.
    const { service } = setup({ resolve });

    const csv = [
      HEADER,
      'Résister,Salomé Saqué,"",9782228937597,paperback,read,2025/07/23,2025/03/31,2025/02/01-2025/03/31,1,"",fast,,,,,,4.0,"","","","",Yes',
      'Findable,Author One,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
      'Nowhere,Author Two,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");

    const preview = await service.preview("user-1", csv);

    expect(preview.totalRows).toBe(3);
    expect(preview.matched.map((m) => [m.source, m.sourceId])).toEqual([
      ["GOOGLE_BOOKS", "G-1"],
      ["OPENLIBRARY", "OL-2"],
    ]);
    expect(preview.unmatched).toEqual(["Nowhere"]);
    // The ISBN row keeps its mapped reading metadata.
    expect(preview.matched[0]).toMatchObject({
      csvTitle: "Résister",
      status: "READ",
      rating: 8,
      finishedAt: "2025-03-31T00:00:00.000Z",
    });
  });

  it("flags books already in the user's library by (source, id)", async () => {
    const { service } = setup({
      resolve: jest
        .fn()
        .mockResolvedValue(summary({ source: "GOOGLE_BOOKS", sourceId: "G-DUP" })),
      inLibraryRefs: [
        { source: "GOOGLE_BOOKS", externalId: "G-DUP", bookItemId: "item-dup" },
      ],
      ownedEntries: [{ bookItemId: "item-dup" }],
    });

    const csv = [
      HEADER,
      'Dup,Author,"",9782228937597,paperback,read,2025/07/23,"","",0,"",,,,,,,,"","","","",Yes',
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
        startedAt: "2025-02-01T00:00:00.000Z",
        finishedAt: "2025-03-31T00:00:00.000Z",
      },
    ]);

    expect(result.imported).toBe(1);
    expect(bookItemService.providerFor).toHaveBeenCalledWith("GOOGLE_BOOKS");
    const data = upsert.mock.calls[0][0].create;
    expect(data).toMatchObject({
      status: "READ",
      rating: 8,
      notes: "loved it",
      currentPage: 320, // Finished + known length → full progress.
    });
    expect(data.finishedAt).toEqual(new Date("2025-03-31T00:00:00.000Z"));
  });
});
