import { aggregateGameStats, GameStatInput } from "./game-stats.util";

function game(over: Partial<GameStatInput> = {}): GameStatInput {
  return {
    status: "BACKLOG",
    favorite: false,
    genres: [],
    platforms: [],
    ...over,
  };
}

describe("aggregateGameStats", () => {
  it("returns zeros for an empty library", () => {
    expect(aggregateGameStats([])).toEqual({
      totalGames: 0,
      backlog: 0,
      playing: 0,
      completed: 0,
      dropped: 0,
      favorites: 0,
      topPlatforms: [],
      topGenres: [],
    });
  });

  it("counts games per status and favorites", () => {
    const stats = aggregateGameStats([
      game({ status: "BACKLOG" }),
      game({ status: "PLAYING", favorite: true }),
      game({ status: "COMPLETED", favorite: true }),
      game({ status: "COMPLETED" }),
      game({ status: "DROPPED" }),
    ]);

    expect(stats.totalGames).toBe(5);
    expect(stats.backlog).toBe(1);
    expect(stats.playing).toBe(1);
    expect(stats.completed).toBe(2);
    expect(stats.dropped).toBe(1);
    expect(stats.favorites).toBe(2);
  });

  it("ranks genres and platforms by frequency, descending", () => {
    const stats = aggregateGameStats([
      game({ genres: ["RPG", "Action"], platforms: ["PC", "PS5"] }),
      game({ genres: ["RPG"], platforms: ["PC"] }),
      game({ genres: ["RPG", "Action"], platforms: ["PC", "Switch"] }),
    ]);

    expect(stats.topGenres).toEqual([
      { genre: "RPG", count: 3 },
      { genre: "Action", count: 2 },
    ]);
    expect(stats.topPlatforms).toEqual([
      { platform: "PC", count: 3 },
      { platform: "PS5", count: 1 },
      { platform: "Switch", count: 1 },
    ]);
  });
});
