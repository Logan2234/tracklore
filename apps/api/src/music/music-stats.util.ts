import type { MusicStatsDto, MusicStatus } from "@tracklore/shared";

import { topN } from "../common/top-n.util";

/** One library album reduced to the fields the stats aggregation needs. */
export interface MusicStatInput {
  status: MusicStatus;
  favorite: boolean;
  genres: string[];
  artists: string[];
}

/** Pure aggregation of a user's albums into library counts + breakdowns. */
export function aggregateMusicStats(albums: MusicStatInput[]): MusicStatsDto {
  const genreCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  let toListen = 0;
  let listened = 0;
  let favorites = 0;

  for (const album of albums) {
    switch (album.status) {
      case "TO_LISTEN":
        toListen++;
        break;
      case "LISTENED":
        listened++;
        break;
    }

    if (album.favorite) favorites++;

    for (const genre of album.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }

    for (const artist of album.artists) {
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
  }

  return {
    totalAlbums: albums.length,
    toListen,
    listened,
    favorites,
    topArtists: topN(artistCounts).map(([artist, count]) => ({
      artist,
      count,
    })),
    topGenres: topN(genreCounts).map(([genre, count]) => ({ genre, count })),
  };
}
