import { aggregateMusicStats, MusicStatInput } from "./music-stats.util";

function album(over: Partial<MusicStatInput> = {}): MusicStatInput {
  return {
    status: "TO_LISTEN",
    favorite: false,
    genres: [],
    artists: [],
    ...over,
  };
}

describe("aggregateMusicStats", () => {
  it("returns zeros for an empty library", () => {
    expect(aggregateMusicStats([])).toEqual({
      totalAlbums: 0,
      toListen: 0,
      listened: 0,
      favorites: 0,
      topArtists: [],
      topGenres: [],
    });
  });

  it("counts albums per status and favorites", () => {
    const stats = aggregateMusicStats([
      album({ status: "TO_LISTEN" }),
      album({ status: "LISTENED", favorite: true }),
      album({ status: "LISTENED" }),
    ]);

    expect(stats.totalAlbums).toBe(3);
    expect(stats.toListen).toBe(1);
    expect(stats.listened).toBe(2);
    expect(stats.favorites).toBe(1);
  });

  it("ranks genres and artists by frequency, descending", () => {
    const stats = aggregateMusicStats([
      album({ genres: ["House", "Electronic"], artists: ["Daft Punk"] }),
      album({ genres: ["House"], artists: ["Daft Punk"] }),
      album({ genres: ["House", "Electronic"], artists: ["Justice"] }),
    ]);

    expect(stats.topGenres).toEqual([
      { genre: "House", count: 3 },
      { genre: "Electronic", count: 2 },
    ]);
    expect(stats.topArtists).toEqual([
      { artist: "Daft Punk", count: 2 },
      { artist: "Justice", count: 1 },
    ]);
  });
});
