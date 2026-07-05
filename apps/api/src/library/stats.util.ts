import type { EntryStatus, MediaType, StatsDto } from "@tracklore/shared";

/**
 * Fallback runtime (minutes) used when a title has no captured `runtimeMin`
 * yet — e.g. cached before the field existed and not re-synced. Rough
 * per-type averages so watch time stays plausible until the real value lands.
 */
const DEFAULT_RUNTIME_MIN: Record<MediaType, number> = {
  MOVIE: 110,
  SERIES: 42,
  ANIME: 24,
};

function runtimeFor(type: MediaType, runtimeMin: number | null): number {
  return runtimeMin && runtimeMin > 0 ? runtimeMin : DEFAULT_RUNTIME_MIN[type];
}

/** One episode viewing (rewatches are separate rows), with its media context. */
export interface WatchStatInput {
  seasonNumber: number;
  type: MediaType;
  genres: string[];
  runtimeMin: number | null;
}

/** A library entry, with its media context, for movie/series counts. */
export interface EntryStatInput {
  type: MediaType;
  status: EntryStatus;
  genres: string[];
  runtimeMin: number | null;
}

/**
 * Aggregate a user's viewing statistics. Pure so it can be unit-tested without
 * a database. Series/anime watch time comes from episode viewings (specials,
 * i.e. season 0, excluded to match progress); movie watch time comes from
 * COMPLETED movie entries (movies have no episodes). Genres are weighted by
 * viewings, so time actually spent drives the "favourites".
 */
export function aggregateStats(
  watches: WatchStatInput[],
  entries: EntryStatInput[],
): StatsDto {
  const minutesByType: Record<MediaType, number> = {
    MOVIE: 0,
    SERIES: 0,
    ANIME: 0,
  };
  const genreCount = new Map<string, number>();
  const addGenres = (genres: string[]) => {
    for (const g of genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  };

  let episodesWatched = 0;
  for (const w of watches) {
    if (w.seasonNumber === 0) continue; // specials excluded
    episodesWatched++;
    minutesByType[w.type] += runtimeFor(w.type, w.runtimeMin);
    addGenres(w.genres);
  }

  let moviesWatched = 0;
  let seriesCompleted = 0;
  for (const e of entries) {
    if (e.status !== "COMPLETED") continue;
    if (e.type === "MOVIE") {
      moviesWatched++;
      minutesByType.MOVIE += runtimeFor("MOVIE", e.runtimeMin);
      addGenres(e.genres);
    } else {
      seriesCompleted++;
    }
  }

  const totalMinutes =
    minutesByType.MOVIE + minutesByType.SERIES + minutesByType.ANIME;

  const timeByType = (Object.keys(minutesByType) as MediaType[])
    .map((type) => ({ type, hours: Math.round(minutesByType[type] / 60) }))
    .filter((t) => t.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const topGenres = [...genreCount.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    hoursWatched: Math.round(totalMinutes / 60),
    episodesWatched,
    seriesCompleted,
    moviesWatched,
    timeByType,
    topGenres,
  };
}
