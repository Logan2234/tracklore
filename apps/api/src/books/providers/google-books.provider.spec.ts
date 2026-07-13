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

function providerWith(key: string | undefined): GoogleBooksProvider {
  const config = {
    get: jest.fn().mockReturnValue(key),
    getOrThrow: jest.fn().mockImplementation(() => {
      if (!key) throw new Error("GOOGLE_BOOKS_API_KEY missing");
      return key;
    }),
  };
  return new GoogleBooksProvider(config as unknown as ConfigService);
}

describe("GoogleBooksProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports configuration from the presence of an API key", () => {
    expect(providerWith("a-key").isConfigured()).toBe(true);
    expect(providerWith(undefined).isConfigured()).toBe(false);
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
    await expect(providerWith("k").searchByIsbn("9780141196107")).resolves.toMatchObject(
      { sourceId: "vol1", title: "By ISBN" },
    );

    mockFetch({ totalItems: 0 });
    await expect(providerWith("k").searchByIsbn("0000000000")).resolves.toBeNull();
  });

  it("maps details, stripping HTML and keeping only full dates", async () => {
    mockFetch({
      id: "vol1",
      volumeInfo: {
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        publishedDate: "1937-09-21",
        description: "<p>A <b>hobbit</b> goes on an adventure.</p>",
        pageCount: 310,
        categories: ["Fiction", "Fantasy"],
        imageLinks: { thumbnail: "http://books.google.com/cover1" },
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
      genres: ["Fiction", "Fantasy"],
      pageCount: 310,
      releaseDate: "1937-09-21T00:00:00.000Z",
      authorWikidataId: null,
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: "vol1" }],
    });
  });

  it("throws when Google Books returns an error status for an id", async () => {
    mockFetch({ error: {} }, false);
    await expect(providerWith("k").getDetails("404")).rejects.toThrow(
      "Book not found on Google Books",
    );
  });
});
