import { parseGoodreadsCsv } from "./goodreads-parse";

const HEADER =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseGoodreadsCsv", () => {
  it("maps a finished, rated, owned book", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,Résister,Salomé Saqué,"Saqué, Salomé",,="",="9782228937597",4,3.90,Editions,Paperback,224,2023,2023,2025/03/31,2025/01/01,read,read (#1),read,"Great read",0,,1,1',
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      title: "Résister",
      authors: ["Salomé Saqué"],
      isbn: "9782228937597",
      status: "READ",
      rating: 8, // 4 stars doubled.
      notes: "Great read",
      startedAt: null,
      finishedAt: "2025-03-31T00:00:00.000Z",
      ownershipStatus: "PHYSICAL",
      readCount: 1,
    });
  });

  it("derives ownership from Owned Copies + Binding, and reads the read count", () => {
    const rows = parseGoodreadsCsv(
      csv(
        // Owned paperback → PHYSICAL.
        '1,A,X,X,,="",="",0,0,,Paperback,,,,,2025/01/01,to-read,,to-read,,0,,0,1',
        // Owned Kindle Edition → DIGITAL.
        '2,B,X,X,,="",="",0,0,,Kindle Edition,,,,,2025/01/01,to-read,,to-read,,0,,0,2',
        // Owned audiobook → AUDIO.
        '3,C,X,X,,="",="",0,0,,Audiobook,,,,,2025/01/01,to-read,,to-read,,0,,0,1',
        // Not marked owned (0 copies) → NONE, regardless of binding.
        '4,D,X,X,,="",="",0,0,,Hardcover,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
        // Reread three times.
        '5,E,X,X,,="",="",0,0,,Paperback,,,,,2025/01/01,read,,read,,0,,3,1',
      ),
    );

    expect(rows.map((r) => r.ownershipStatus)).toEqual([
      "PHYSICAL",
      "DIGITAL",
      "AUDIO",
      "NONE",
      "PHYSICAL",
    ]);
    expect(rows.map((r) => r.readCount)).toEqual([0, 0, 0, 0, 3]);
  });

  it("maps every Goodreads shelf and doubles the star rating", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,A,X,X,,="",="",0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
        '2,B,X,X,,="",="",0,0,,,,,,,2025/01/01,currently-reading,,currently-reading,,0,,0,0',
        // Unknown/custom shelf falls back to TO_READ.
        '3,C,X,X,,="",="",5,0,,,,,,,2025/01/01,did-not-finish,,did-not-finish,,0,,0,0',
      ),
    );

    expect(rows.map((r) => r.status)).toEqual([
      "TO_READ",
      "READING",
      "TO_READ",
    ]);
    expect(rows[2].rating).toBe(10); // 5 stars doubled.
    expect(rows[0].rating).toBeNull();
  });

  it("combines primary + additional authors and rejects non-ISBN identifiers", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,Manifesto,Karl Marx,"Marx, Karl","Friedrich Engels",="not-an-isbn",="",0,0,,,,,,,2025/01/01,currently-reading,,currently-reading,,0,,0,0',
      ),
    );

    expect(rows[0].authors).toEqual(["Karl Marx", "Friedrich Engels"]);
    expect(rows[0].isbn).toBeNull();
  });

  it("prefers ISBN13 over ISBN when both are present", () => {
    const rows = parseGoodreadsCsv(
      csv(
        '1,A,X,X,,="0261102214",="9780261102217",0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0',
      ),
    );

    expect(rows[0].isbn).toBe("9780261102217");
  });

  it("skips rows without a title", () => {
    const rows = parseGoodreadsCsv(
      csv('1,,X,,,="",="",0,0,,,,,,,2025/01/01,to-read,,to-read,,0,,0,0'),
    );
    expect(rows).toHaveLength(0);
  });
});
