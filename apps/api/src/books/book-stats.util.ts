import type { BookStatsDto, BookStatus } from "@tracklore/shared";

import { topN } from "../common/top-n.util";

/** One library book reduced to the fields the stats aggregation needs. */
export interface BookStatInput {
  status: BookStatus;
  favorite: boolean;
  genres: string[];
  authors: string[];
}

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

  return {
    totalBooks: books.length,
    toRead,
    reading,
    read,
    dropped,
    favorites,
    topAuthors: topN(authorCounts).map(([author, count]) => ({
      author,
      count,
    })),
    topGenres: topN(genreCounts).map(([genre, count]) => ({ genre, count })),
  };
}
