import { ConfigService } from "@nestjs/config";
import { IgdbProvider } from "./igdb.provider";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([pathPart]) =>
      url.includes(pathPart),
    );

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

const TOKEN_RESPONSE = { access_token: "app-token", expires_in: 3600 };

describe("IgdbProvider", () => {
  let provider: IgdbProvider;

  beforeEach(() => {
    const config = { getOrThrow: jest.fn().mockReturnValue("test-credential") };
    provider = new IgdbProvider(config as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps search results to canonical summaries", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          // 2013-09-17 UTC.
          first_release_date: 1379376000,
          cover: { image_id: "co1r7f" },
        },
        // No cover / no date → nulls. Theme 42 (Erotic) → isAdult.
        { id: 7331, name: "Untitled", themes: [1, 42] },
      ],
    });

    const results = await provider.search("gta");

    expect(results).toEqual([
      {
        source: "IGDB",
        sourceId: "1020",
        title: "Grand Theft Auto V",
        year: 2013,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
        isAdult: false,
      },
      {
        source: "IGDB",
        sourceId: "7331",
        title: "Untitled",
        year: null,
        coverUrl: null,
        isAdult: true,
      },
    ]);
  });

  it("maps details, deriving artwork url, genres and platforms", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          summary: "An open-world crime epic.",
          first_release_date: 1379376000,
          cover: { image_id: "co1r7f" },
          artworks: [{ image_id: "ar1" }],
          genres: [{ name: "Shooter" }, { name: "Adventure" }],
          platforms: [{ name: "PC (Microsoft Windows)" }, { name: "PS4" }],
          websites: [
            { url: "https://twitter.com/rockstargames", category: 5 },
            { url: "https://www.rockstargames.com/V/", category: 1 },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details).toEqual({
      summary: {
        source: "IGDB",
        sourceId: "1020",
        title: "Grand Theft Auto V",
        year: 2013,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
        isAdult: false,
      },
      overview: "An open-world crime epic.",
      backdropUrl: "https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg",
      genres: ["Shooter", "Adventure"],
      platforms: ["PC (Microsoft Windows)", "PS4"],
      releaseDate: "2013-09-17T00:00:00.000Z",
      website: "https://www.rockstargames.com/V/",
      externalIds: [{ source: "IGDB", externalId: "1020" }],
    });
  });

  it("throws when IGDB returns no game for an id", async () => {
    mockFetchByUrl({ "id.twitch.tv": TOKEN_RESPONSE, "/games": [] });
    await expect(provider.getDetails("404")).rejects.toThrow(
      "Game not found on IGDB",
    );
  });

  it("reuses the cached access token across calls", async () => {
    const fn = mockFetchByUrl({ "id.twitch.tv": TOKEN_RESPONSE, "/games": [] });

    await provider.search("a");
    await provider.search("b");

    const tokenCalls = fn.mock.calls.filter(([url]) =>
      String(url).includes("id.twitch.tv"),
    );
    expect(tokenCalls).toHaveLength(1);
  });
});
