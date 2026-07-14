import { ConfigService } from "@nestjs/config";
import { GoogleBooksProvider } from "./google-books.provider";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetch(payload: unknown, ok = true): jest.Mock {
  const fn = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: ok ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Route responses by a substring of the request URL (query string included). */
function mockFetchByUrl(routes: [string, unknown][]): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([part]) => url.includes(part));

    if (!match) {
      throw new Error(`Unexpected fetch call in test: ${url}`);
    }

    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function providerWith(key: string): GoogleBooksProvider {
  const config = {
    getOrThrow: jest.fn().mockReturnValue(key),
  };
  return new GoogleBooksProvider(config as unknown as ConfigService);
}

describe("GoogleBooksProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the API key and maps search results", async () => {
    const fn = mockFetch({
      totalItems: 1,
      items: [
        {
          id: "vol1",
          volumeInfo: {
            title: "The Hobbit",
            authors: ["J.R.R. Tolkien"],
            publishedDate: "1937-09-21",
            imageLinks: { thumbnail: "http://books.google.com/cover1" },
          },
        },
      ],
    });

    const results = await providerWith("a-key").search("hobbit");

    expect(String(fn.mock.calls[0][0])).toContain("key=a-key");
    expect(results).toEqual([
      {
        source: "GOOGLE_BOOKS",
        sourceId: "vol1",
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        year: 1937,
        coverUrl: "https://books.google.com/cover1",
      },
    ]);
  });

  it("resolves a single volume by ISBN, or null when none", async () => {
    mockFetch({
      totalItems: 1,
      items: [{ id: "vol1", volumeInfo: { title: "By ISBN" } }],
    });
    await expect(
      providerWith("k").searchByIsbn("9780141196107"),
    ).resolves.toMatchObject({ sourceId: "vol1", title: "By ISBN" });

    mockFetch({ totalItems: 0 });
    await expect(
      providerWith("k").searchByIsbn("0000000000"),
    ).resolves.toBeNull();
  });

  it("maps details, stripping HTML and keeping only full dates", async () => {
    mockFetch({
      id: "vol1",
      volumeInfo: {
        title: "The Hobbit",
        subtitle: "There and Back Again",
        authors: ["J.R.R. Tolkien"],
        publisher: "George Allen & Unwin",
        publishedDate: "1937-09-21",
        description: "<p>A <b>hobbit</b> goes on an adventure.</p>",
        pageCount: 310,
        categories: ["Fiction", "Fantasy"],
        imageLinks: { thumbnail: "http://books.google.com/cover1" },
        canonicalVolumeLink: "https://books.google.com/books?id=vol1",
      },
    });

    const details = await providerWith("k").getDetails("vol1");

    expect(details).toEqual({
      summary: {
        source: "GOOGLE_BOOKS",
        sourceId: "vol1",
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        year: 1937,
        coverUrl: "https://books.google.com/cover1",
      },
      overview: "A hobbit goes on an adventure.",
      subtitle: "There and Back Again",
      publisher: "George Allen & Unwin",
      genres: ["Fiction", "Fantasy"],
      pageCount: 310,
      releaseDate: "1937-09-21T00:00:00.000Z",
      website: "https://books.google.com/books?id=vol1",
      sameAuthorBooks: [],
      ratings: [],
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "vol1" }],
    });
  });

  it("maps averageRating/ratingsCount to a Google Books score", async () => {
    mockFetch({
      id: "vol1",
      volumeInfo: {
        title: "The Hobbit",
        averageRating: 4.5,
        ratingsCount: 128,
      },
    });

    const details = await providerWith("k").getDetails("vol1");

    expect(details.ratings).toEqual([
      { source: "Google Books", score: "4.5/5 (128)" },
    ]);
  });

  it("omits the rating when Google Books reports none", async () => {
    mockFetch({ id: "vol1", volumeInfo: { title: "The Hobbit" } });

    const details = await providerWith("k").getDetails("vol1");

    expect(details.ratings).toEqual([]);
  });

  it("maps same-author books, excluding this volume, capped at 10", async () => {
    const otherBooks = Array.from({ length: 12 }, (_, i) => ({
      id: `other-${i}`,
      volumeInfo: { title: `Book ${i}`, authors: ["J.R.R. Tolkien"] },
    }));
    mockFetchByUrl([
      [
        "/vol1",
        {
          id: "vol1",
          volumeInfo: { title: "The Hobbit", authors: ["J.R.R. Tolkien"] },
        },
      ],
      [
        "/volumes?",
        {
          totalItems: 13,
          // Same-author search also returns the volume itself — must be excluded.
          items: [
            { id: "vol1", volumeInfo: { title: "The Hobbit" } },
            ...otherBooks,
          ],
        },
      ],
    ]);

    const details = await providerWith("k").getDetails("vol1");

    expect(details.sameAuthorBooks).toHaveLength(10);
    expect(details.sameAuthorBooks.map((b) => b.sourceId)).not.toContain(
      "vol1",
    );
    expect(details.sameAuthorBooks[0]).toMatchObject({ sourceId: "other-0" });
  });

  it("throws when Google Books returns an error status for an id", async () => {
    mockFetch({ error: {} }, false);
    await expect(providerWith("k").getDetails("404")).rejects.toThrow(
      "Book not found on Google Books",
    );
  });
});
