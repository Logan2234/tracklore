import { OpenLibraryProvider } from "./openlibrary.provider";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: {
  match: string;
  payload: unknown;
  ok?: boolean;
}[]): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes.find((r) => url.includes(r.match));

    if (!route) {
      throw new Error(`Unexpected fetch call in test: ${url}`);
    }

    return Promise.resolve(
      new Response(JSON.stringify(route.payload), {
        status: route.ok === false ? 404 : 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("OpenLibraryProvider", () => {
  let provider: OpenLibraryProvider;

  beforeEach(() => {
    provider = new OpenLibraryProvider();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps search results to canonical summaries", async () => {
    mockFetchByUrl([
      {
        match: "search.json",
        payload: {
          docs: [
            {
              key: "/works/OL27482W",
              title: "The Hobbit",
              author_name: ["J.R.R. Tolkien"],
              first_publish_year: 1937,
              cover_i: 14627509,
              number_of_pages_median: 310,
            },
            // No cover / no authors / no year → nulls.
            { key: "/works/OL999W", title: "Untitled" },
          ],
        },
      },
    ]);

    const results = await provider.search("hobbit");

    expect(results).toEqual([
      {
        source: "OPENLIBRARY",
        sourceId: "OL27482W",
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        year: 1937,
        coverUrl: "https://covers.openlibrary.org/b/id/14627509-L.jpg",
      },
      {
        source: "OPENLIBRARY",
        sourceId: "OL999W",
        title: "Untitled",
        authors: [],
        year: null,
        coverUrl: null,
      },
    ]);
  });

  it("maps details, resolving the description from the work document", async () => {
    mockFetchByUrl([
      {
        match: "search.json",
        payload: {
          docs: [
            {
              key: "/works/OL27482W",
              title: "The Hobbit",
              author_name: ["J.R.R. Tolkien"],
              first_publish_year: 1937,
              cover_i: 14627509,
              number_of_pages_median: 310,
              subject: ["Fantasy", "Fiction", "Classics"],
            },
          ],
        },
      },
      {
        match: "/works/OL27482W.json",
        payload: { description: { value: "A hobbit goes on an adventure." } },
      },
    ]);

    const details = await provider.getDetails("OL27482W");

    expect(details).toEqual({
      summary: {
        source: "OPENLIBRARY",
        sourceId: "OL27482W",
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        year: 1937,
        coverUrl: "https://covers.openlibrary.org/b/id/14627509-L.jpg",
      },
      overview: "A hobbit goes on an adventure.",
      genres: ["Fantasy", "Fiction", "Classics"],
      pageCount: 310,
      releaseDate: null,
      externalIds: [{ source: "OPENLIBRARY", externalId: "OL27482W" }],
    });
  });

  it("still returns details when the work document has no description", async () => {
    mockFetchByUrl([
      {
        match: "search.json",
        payload: { docs: [{ key: "/works/OL27482W", title: "The Hobbit" }] },
      },
      { match: "/works/OL27482W.json", payload: {} },
    ]);

    const details = await provider.getDetails("OL27482W");
    expect(details.overview).toBeNull();
  });

  it("throws when Open Library has no work for an id", async () => {
    mockFetchByUrl([
      { match: "search.json", payload: { docs: [] } },
      { match: "/works/404.json", payload: {}, ok: false },
    ]);

    await expect(provider.getDetails("404")).rejects.toThrow(
      "Book not found on Open Library",
    );
  });
});
