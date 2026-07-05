import { ConfigService } from "@nestjs/config";
import { MediaSource, MediaType } from "@tracklore/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TmdbProvider } from "./tmdb.provider";

const FIXTURES = join(__dirname, "..", "..", "..", "test", "fixtures");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): void {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
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
  }) as typeof fetch;
}

describe("TmdbProvider", () => {
  let provider: TmdbProvider;

  beforeEach(() => {
    const config = { getOrThrow: jest.fn().mockReturnValue("test-token") };
    provider = new TmdbProvider(config as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps movie search results to canonical summaries", async () => {
    mockFetchByUrl({
      "/search/movie": fixture("tmdb-search-movie.json"),
      "/search/tv": { results: [] },
    });

    const results = await provider.search("Inception", MediaType.MOVIE);

    expect(results).toEqual([
      {
        source: "TMDB",
        sourceId: "27205",
        type: MediaType.MOVIE,
        title: "Inception",
        originalTitle: "Inception",
        year: 2010,
        posterUrl:
          "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
      },
    ]);
  });

  it("searches both movies and series when no type is given", async () => {
    mockFetchByUrl({
      "/search/movie": fixture("tmdb-search-movie.json"),
      "/search/tv": fixture("tmdb-search-tv.json"),
    });

    const results = await provider.search("anything");

    expect(results.map((r) => r.type)).toEqual([
      MediaType.MOVIE,
      MediaType.SERIES,
    ]);
    expect(results[1].title).toBe("Breaking Bad");
  });

  it("maps movie details with external IDs and no seasons", async () => {
    mockFetchByUrl({ "/movie/27205": fixture("tmdb-movie-details.json") });

    const details = await provider.getDetails("27205", MediaType.MOVIE);

    expect(details.summary.title).toBe("Inception");
    expect(details.genres).toEqual(["Action", "Science Fiction", "Adventure"]);
    expect(details.releaseDate).toBe("2010-07-15");
    expect(details.seasons).toEqual([]);
    expect(details.externalIds).toContainEqual({
      source: MediaSource.TMDB,
      externalId: "27205",
    });
    expect(details.externalIds).toContainEqual({
      source: MediaSource.IMDB,
      externalId: "tt1375666",
    });
  });

  it("resolves a TVDB series id to a TMDB summary via /find", async () => {
    mockFetchByUrl({
      "/find/81189": {
        tv_results: [
          {
            id: 1396,
            name: "Breaking Bad",
            first_air_date: "2008-01-20",
            poster_path: "/bb.jpg",
          },
        ],
        movie_results: [],
      },
    });

    const summary = await provider.findSeriesSummaryByTvdbId("81189");
    expect(summary).toMatchObject({
      source: "TMDB",
      sourceId: "1396",
      type: MediaType.SERIES,
      title: "Breaking Bad",
      year: 2008,
    });
  });

  it("returns null when /find has no TV result for the TVDB id", async () => {
    mockFetchByUrl({ "/find/999999": { tv_results: [], movie_results: [] } });

    await expect(
      provider.findSeriesSummaryByTvdbId("999999"),
    ).resolves.toBeNull();
  });

  it("maps series details with TVDB ID and per-season episodes (specials included)", async () => {
    mockFetchByUrl({
      "/tv/1396/season/0": fixture("tmdb-season-0.json"),
      "/tv/1396/season/1": fixture("tmdb-season-1.json"),
      "/tv/1396": fixture("tmdb-tv-details.json"),
    });

    const details = await provider.getDetails("1396", MediaType.SERIES);

    expect(details.summary).toMatchObject({
      type: MediaType.SERIES,
      title: "Breaking Bad",
    });
    // The TVDB ID is what makes a future TV Time import reconcilable.
    expect(details.externalIds).toContainEqual({
      source: MediaSource.TVDB,
      externalId: "81189",
    });
    expect(details.externalIds).toContainEqual({
      source: MediaSource.IMDB,
      externalId: "tt0903747",
    });

    expect(details.seasons.map((s) => s.number)).toEqual([0, 1]);
    const seasonOne = details.seasons.find((s) => s.number === 1);
    expect(seasonOne?.episodes).toEqual([
      { number: 1, title: "Pilot", airDate: "2008-01-20" },
      { number: 2, title: "Cat's in the Bag...", airDate: "2008-01-27" },
    ]);
  });
});
