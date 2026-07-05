import { aggregateStats } from "./stats.util";
import type { EntryStatInput, WatchStatInput } from "./stats.util";

describe("aggregateStats", () => {
  it("returns zeroed stats for no activity", () => {
    const stats = aggregateStats([], []);
    expect(stats).toEqual({
      hoursWatched: 0,
      episodesWatched: 0,
      seriesCompleted: 0,
      moviesWatched: 0,
      timeByType: [],
      topGenres: [],
    });
  });

  it("aggregates watch time, counts and genres across sources", () => {
    const watches: WatchStatInput[] = [
      // 3 regular series episodes @ 60 min, genre Drama (one is a rewatch).
      { seasonNumber: 1, type: "SERIES", genres: ["Drama"], runtimeMin: 60 },
      { seasonNumber: 1, type: "SERIES", genres: ["Drama"], runtimeMin: 60 },
      { seasonNumber: 2, type: "SERIES", genres: ["Drama"], runtimeMin: 60 },
      // A special (season 0) is excluded from time and episode counts.
      { seasonNumber: 0, type: "SERIES", genres: ["Drama"], runtimeMin: 60 },
      // 5 anime episodes with no captured runtime → 24 min fallback each.
      { seasonNumber: 1, type: "ANIME", genres: ["Action"], runtimeMin: null },
      { seasonNumber: 1, type: "ANIME", genres: ["Action"], runtimeMin: null },
      { seasonNumber: 1, type: "ANIME", genres: ["Action"], runtimeMin: null },
      { seasonNumber: 1, type: "ANIME", genres: ["Action"], runtimeMin: null },
      { seasonNumber: 1, type: "ANIME", genres: ["Action"], runtimeMin: null },
    ];
    const entries: EntryStatInput[] = [
      {
        type: "MOVIE",
        status: "COMPLETED",
        genres: ["Action", "Sci-Fi"],
        runtimeMin: 120,
      },
      // Not seen yet → ignored everywhere.
      { type: "MOVIE", status: "PLANNED", genres: ["Comedy"], runtimeMin: 90 },
      { type: "SERIES", status: "COMPLETED", genres: [], runtimeMin: 60 },
      { type: "ANIME", status: "COMPLETED", genres: [], runtimeMin: null },
    ];

    const stats = aggregateStats(watches, entries);

    // 3 series + 5 anime viewings; the special is not counted.
    expect(stats.episodesWatched).toBe(8);
    expect(stats.moviesWatched).toBe(1);
    expect(stats.seriesCompleted).toBe(2);
    // 180 (series) + 120 (anime) + 120 (movie) = 420 min = 7 h.
    expect(stats.hoursWatched).toBe(7);

    const hoursFor = (type: string) =>
      stats.timeByType.find((t) => t.type === type)?.hours;
    expect(hoursFor("SERIES")).toBe(3);
    expect(hoursFor("ANIME")).toBe(2);
    expect(hoursFor("MOVIE")).toBe(2);
    // Sorted by hours descending.
    expect(stats.timeByType[0].type).toBe("SERIES");

    // Genres weighted by viewings: Action = 5 (anime) + 1 (movie) = 6.
    expect(stats.topGenres).toEqual([
      { genre: "Action", count: 6 },
      { genre: "Drama", count: 3 },
      { genre: "Sci-Fi", count: 1 },
    ]);
  });
});
