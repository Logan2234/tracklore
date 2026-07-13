import type { GameStatsDto, GameStatus } from "@tracklore/shared";

/** One library game reduced to the fields the stats aggregation needs. */
export interface GameStatInput {
  status: GameStatus;
  favorite: boolean;
  genres: string[];
  platforms: string[];
}

// Breakdowns are capped so the UI stays legible.
const TOP_N = 6;

/** Pure aggregation of a user's games into library counts + breakdowns. */
export function aggregateGameStats(games: GameStatInput[]): GameStatsDto {
  const genreCounts = new Map<string, number>();
  const platformCounts = new Map<string, number>();
  let backlog = 0;
  let playing = 0;
  let completed = 0;
  let dropped = 0;
  let favorites = 0;

  for (const game of games) {
    switch (game.status) {
      case "BACKLOG":
        backlog++;
        break;
      case "PLAYING":
        playing++;
        break;
      case "COMPLETED":
        completed++;
        break;
      case "DROPPED":
        dropped++;
        break;
    }

    if (game.favorite) favorites++;

    for (const genre of game.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    for (const platform of game.platforms) {
      platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    }
  }

  const top = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N);

  return {
    totalGames: games.length,
    backlog,
    playing,
    completed,
    dropped,
    favorites,
    topPlatforms: top(platformCounts).map(([platform, count]) => ({
      platform,
      count,
    })),
    topGenres: top(genreCounts).map(([genre, count]) => ({ genre, count })),
  };
}
