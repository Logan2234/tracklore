import { BadRequestException, Injectable } from "@nestjs/common";
import type { TvTimeImportFilesDto } from "@tracklore/shared";
import type {
  ImportMovie,
  ImportShow,
  ImportSource,
  ParsedImport,
} from "../import-source";
import {
  parseTvTimeExport,
  type ParsedMovie,
  type ParsedShow,
} from "./parse-export";
import { readZipEntries } from "./zip";

/** Each import field → its file name in the TV Time GDPR export. */
const FILE_NAMES: Record<keyof TvTimeImportFilesDto, string> = {
  episodesCsv: "tracking-prod-records-v2.csv",
  showsCsv: "user_tv_show_data.csv",
  recordsCsv: "tracking-prod-records.csv",
  rewatchedCsv: "rewatched_episode.csv",
};

/** The TV Time GDPR export (a `.zip` of CSVs), reconciled through TVDB ids. */
@Injectable()
export class TvTimeImportSource implements ImportSource {
  readonly key = "tvtime";

  parse(input: Buffer): ParsedImport {
    const files = extractFiles(input);
    const { shows, movies } = parseTvTimeExport(files);
    return {
      source: this.key,
      shows: shows.map(toImportShow),
      movies: movies.map(toImportMovie),
    };
  }
}

function toImportShow(show: ParsedShow): ImportShow {
  return {
    title: show.name,
    externalIds: { tvdb: show.tvdbId },
    episodes: show.episodes.map((e) => ({
      season: e.season,
      episode: e.episode,
      sourceEpisodeId: e.tvdbEpisodeId,
      watchedAt: e.watchedAt,
      totalWatches: e.totalWatches,
    })),
  };
}

function toImportMovie(movie: ParsedMovie): ImportMovie {
  return {
    title: movie.title,
    year: movie.year,
    watched: movie.watched,
    externalIds: {},
  };
}

/**
 * Decode + validate the archive and extract the CSVs we need. Throws
 * {@link BadRequestException} on a bad or incomplete archive so the caller
 * gets an immediate 400. Movies are optional: their file may be absent (then
 * there are simply no movies to import).
 */
function extractFiles(input: Buffer): TvTimeImportFilesDto {
  if (input.length === 0) {
    throw new BadRequestException("The uploaded archive is empty");
  }

  let entries: Map<string, string>;
  try {
    entries = readZipEntries(input, new Set(Object.values(FILE_NAMES)));
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "Could not read the archive",
    );
  }

  const files: TvTimeImportFilesDto = {
    episodesCsv: entries.get(FILE_NAMES.episodesCsv),
    showsCsv: entries.get(FILE_NAMES.showsCsv),
    recordsCsv: entries.get(FILE_NAMES.recordsCsv),
    rewatchedCsv: entries.get(FILE_NAMES.rewatchedCsv),
  };

  const missing: string[] = [];
  if (!files.episodesCsv) missing.push(FILE_NAMES.episodesCsv);
  if (!files.showsCsv) missing.push(FILE_NAMES.showsCsv);
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required file(s) in the archive: ${missing.join(", ")}`,
    );
  }
  return files;
}
