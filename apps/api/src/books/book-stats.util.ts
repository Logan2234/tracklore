import type { BookStatsDto, BookStatus } from "@tracklore/shared";

/** One library book reduced to the fields the stats aggregation needs. */
export interface BookStatInput {
  status: BookStatus;
  favorite: boolean;
  genres: string[];
  authors: string[];
}

// Breakdowns are capped so the UI stays legible.
const TOP_N = 6;

/** Pure aggregation of a user's books into library counts + breakdowns. */
export function aggregateBookStats(books: BookStatInput[]): BookStatsDto {
  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  let toRead = 0;
  let reading = 0;
  let read = 0;
  let dropped = 0;
  let favorites = 0;

  for (const book of books) {
    switch (book.status) {
      case "TO_READ":
        toRead++;
        break;
      case "READING":
        reading++;
        break;
      case "READ":
        read++;
        break;
      case "DROPPED":
        dropped++;
        break;
    }

    if (book.favorite) favorites++;

    for (const genre of book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    for (const author of book.authors) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
  }

  const top = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N);

  return {
    totalBooks: books.length,
    toRead,
    reading,
    read,
    dropped,
    favorites,
    topAuthors: top(authorCounts).map(([author, count]) => ({
      author,
      count,
    })),
    topGenres: top(genreCounts).map(([genre, count]) => ({ genre, count })),
  };
}
