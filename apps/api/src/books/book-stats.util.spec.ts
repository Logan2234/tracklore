import { aggregateBookStats, BookStatInput } from "./book-stats.util";

function book(over: Partial<BookStatInput> = {}): BookStatInput {
  return {
    status: "TO_READ",
    favorite: false,
    genres: [],
    authors: [],
    ...over,
  };
}

describe("aggregateBookStats", () => {
  it("returns zeros for an empty library", () => {
    expect(aggregateBookStats([])).toEqual({
      totalBooks: 0,
      toRead: 0,
      reading: 0,
      read: 0,
      dropped: 0,
      favorites: 0,
      topAuthors: [],
      topGenres: [],
    });
  });

  it("counts books per status and favorites", () => {
    const stats = aggregateBookStats([
      book({ status: "TO_READ" }),
      book({ status: "READING", favorite: true }),
      book({ status: "READ", favorite: true }),
      book({ status: "READ" }),
      book({ status: "DROPPED" }),
    ]);

    expect(stats.totalBooks).toBe(5);
    expect(stats.toRead).toBe(1);
    expect(stats.reading).toBe(1);
    expect(stats.read).toBe(2);
    expect(stats.dropped).toBe(1);
    expect(stats.favorites).toBe(2);
  });

  it("ranks genres and authors by frequency, descending", () => {
    const stats = aggregateBookStats([
      book({ genres: ["Fantasy", "Adventure"], authors: ["Tolkien"] }),
      book({ genres: ["Fantasy"], authors: ["Tolkien"] }),
      book({ genres: ["Fantasy", "Adventure"], authors: ["Le Guin"] }),
    ]);

    expect(stats.topGenres).toEqual([
      { genre: "Fantasy", count: 3 },
      { genre: "Adventure", count: 2 },
    ]);
    expect(stats.topAuthors).toEqual([
      { author: "Tolkien", count: 2 },
      { author: "Le Guin", count: 1 },
    ]);
  });
});
