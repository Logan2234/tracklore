import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  EntryStatus,
  MediaDetailsDto,
  MediaSummaryDto,
  StartTvTimeImportDto,
  TvTimeImportFilesDto,
  TvTimeImportJobDto,
  TvTimeImportReport,
} from "@tracklore/shared";
import {
  IMPORT_REPORT_SAMPLE_CAP,
  entryStatusFromProgress,
} from "@tracklore/shared";
import { randomUUID } from "node:crypto";
import { MediaItemService } from "../../catalog/media-item.service";
import { TmdbProvider } from "../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../prisma/prisma.service";
import {
  parseTvTimeExport,
  type ParsedMovie,
  type ParsedShow,
} from "./parse-export";
import { readZipEntries } from "./zip";

/** Completed jobs are dropped from memory after this delay. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

/** Each import field → its file name in the TV Time GDPR export. */
const FILE_NAMES: Record<keyof TvTimeImportFilesDto, string> = {
  episodesCsv: "tracking-prod-records-v2.csv",
  showsCsv: "user_tv_show_data.csv",
  recordsCsv: "tracking-prod-records.csv",
  rewatchedCsv: "rewatched_episode.csv",
};

interface JobRecord extends TvTimeImportJobDto {
  userId: string;
  finishedAt: number | null;
}

/** Season/episode listing reduced to what episode matching needs. */
interface EpisodeIndex {
  /** "season|episode" → persisted episode id (null in dry runs). */
  byKey: Map<string, string | null>;
  /** Total episodes outside season 0 — the denominator for completion. */
  totalRegular: number;
}

@Injectable()
export class ImportService {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly tmdb: TmdbProvider,
  ) {}

  /** Unzip + validate the export, start the import in the background, return the pending job. */
  startImport(userId: string, dto: StartTvTimeImportDto): TvTimeImportJobDto {
    this.pruneOldJobs();

    const importMovies = dto.importMovies ?? true;
    const dryRun = dto.dryRun ?? false;
    const overwrite = dto.overwrite ?? false;

    const files = this.extractFiles(dto.zipBase64, importMovies);
    const parsed = parseTvTimeExport(files);

    const job: JobRecord = {
      id: randomUUID(),
      userId,
      dryRun,
      status: "running",
      progress: {
        shows: 0,
        totalShows: parsed.shows.length,
        movies: 0,
        totalMovies: importMovies ? parsed.movies.length : 0,
      },
      report: null,
      error: null,
      finishedAt: null,
    };
    this.jobs.set(job.id, job);

    // Fire and forget: the client polls getJob for progress and the report.
    void this.run(
      job,
      userId,
      parsed.shows,
      importMovies ? parsed.movies : [],
      overwrite,
    );

    return toDto(job);
  }

  /**
   * Decode the base64 archive, extract the CSVs we need and check the required
   * ones are present. Throws {@link BadRequestException} on a bad or incomplete
   * archive so the caller gets an immediate 400 (before any job is created).
   */
  private extractFiles(
    zipBase64: string,
    importMovies: boolean,
  ): TvTimeImportFilesDto {
    const buf = Buffer.from(zipBase64, "base64");
    if (buf.length === 0) {
      throw new BadRequestException("The uploaded archive is empty");
    }

    let entries: Map<string, string>;
    try {
      entries = readZipEntries(buf, new Set(Object.values(FILE_NAMES)));
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
    if (importMovies && !files.recordsCsv) missing.push(FILE_NAMES.recordsCsv);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required file(s) in the archive: ${missing.join(", ")}`,
      );
    }
    return files;
  }

  getJob(userId: string, jobId: string): TvTimeImportJobDto {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Import job not found");
    if (job.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }
    return toDto(job);
  }

  private async run(
    job: JobRecord,
    userId: string,
    shows: ParsedShow[],
    movies: ParsedMovie[],
    overwrite: boolean,
  ): Promise<void> {
    const report = emptyReport(job.dryRun, overwrite);
    try {
      if (overwrite && !job.dryRun) {
        // Destructive replace: drop the user's history and library entries
        // first. The shared MediaItem/Season/Episode cache is left untouched —
        // it is not user data. Watches go first (they reference episodes only,
        // but ordering keeps the intent explicit).
        await this.prisma.$transaction([
          this.prisma.episodeWatch.deleteMany({ where: { userId } }),
          this.prisma.libraryEntry.deleteMany({ where: { userId } }),
        ]);
      }
      for (const show of shows) {
        await this.importShow(userId, show, job.dryRun, report);
        job.progress.shows++;
      }
      for (const movie of movies) {
        await this.importMovie(userId, movie, job.dryRun, report);
        job.progress.movies++;
      }
      job.report = report;
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = Date.now();
    }
  }

  private async importShow(
    userId: string,
    show: ParsedShow,
    dryRun: boolean,
    report: TvTimeImportReport,
  ): Promise<void> {
    report.shows.total++;

    const tmdbId = await this.resolveSeries(show.tvdbId);
    if (!tmdbId) {
      pushCapped(report.shows.unresolved, {
        title: show.name,
        tvdbId: show.tvdbId,
        // Keep the watch data so the report can tell a watchlist show apart
        // from a started one and list what would be imported after reconciling.
        episodes: show.episodes.map((e) => ({
          season: e.season,
          episode: e.episode,
        })),
      });
      return;
    }

    // Watchlist show (never started): no progress to reconcile, so skip the
    // (heavy) episode fetch. Still persist the media on a real run.
    if (show.episodes.length === 0) {
      report.shows.watchlist++;
      if (!dryRun) {
        await this.mediaItemService.upsertFromSource("TMDB", tmdbId, "SERIES");
        await this.upsertSeriesEntry(userId, tmdbId, "PLANNED", show);
      }
      return;
    }

    const index = dryRun
      ? indexFromDetails(
          await this.mediaItemService.getLiveDetails("TMDB", tmdbId, "SERIES"),
        )
      : await this.persistSeriesIndex(tmdbId);

    let watchedRegular = 0;
    for (const ep of show.episodes) {
      const key = `${ep.season}|${ep.episode}`;
      if (!index.byKey.has(key)) {
        pushCapped(report.episodes.unmatched, {
          show: show.name,
          season: ep.season,
          episode: ep.episode,
        });
        continue;
      }
      report.episodes.watched++;
      if (ep.season > 0) watchedRegular++;

      const episodeId = index.byKey.get(key);
      if (!dryRun && episodeId) {
        report.episodes.watchesCreated += await this.recordWatches(
          userId,
          episodeId,
          ep.totalWatches,
          ep.watchedAt,
        );
      }
    }

    const status = entryStatusFromProgress(watchedRegular, index.totalRegular);
    if (!dryRun) {
      await this.upsertSeriesEntry(userId, tmdbId, status, show);
    }
    if (status === "PLANNED") report.shows.watchlist++;
    else report.shows.imported++;
  }

  private async importMovie(
    userId: string,
    movie: ParsedMovie,
    dryRun: boolean,
    report: TvTimeImportReport,
  ): Promise<void> {
    report.movies.total++;

    const summaries = await this.tmdb.search(movie.title, "MOVIE");
    const match = pickMovie(summaries, movie.title, movie.year);
    if (!match) {
      pushCapped(report.movies.unresolved, {
        title: movie.title,
        year: movie.year,
        watched: movie.watched,
      });
      return;
    }

    const status = movie.watched ? "COMPLETED" : "PLANNED";
    if (!dryRun) {
      const media = await this.mediaItemService.upsertFromSource(
        "TMDB",
        match.sourceId,
        "MOVIE",
      );
      await this.prisma.libraryEntry.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
        update: { status },
        create: { userId, mediaItemId: media.id, status },
      });
    }
    if (status === "PLANNED") report.movies.watchlist++;
    else report.movies.imported++;
  }

  private async resolveSeries(tvdbId: string): Promise<string | null> {
    try {
      return await this.tmdb.findSeriesByTvdbId(tvdbId);
    } catch {
      // Network/404 hiccups are reported as unresolved rather than aborting.
      return null;
    }
  }

  /** Persist the series (on-demand cache) and index its stored episodes. */
  private async persistSeriesIndex(tmdbId: string): Promise<EpisodeIndex> {
    const media = await this.mediaItemService.upsertFromSource(
      "TMDB",
      tmdbId,
      "SERIES",
    );
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      include: { episodes: { select: { id: true, number: true } } },
    });

    const byKey = new Map<string, string | null>();
    let totalRegular = 0;
    for (const season of seasons) {
      for (const episode of season.episodes) {
        byKey.set(`${season.number}|${episode.number}`, episode.id);
        if (season.number > 0) totalRegular++;
      }
    }
    return { byKey, totalRegular };
  }

  /** Create the missing watch rows for an episode; skip if already imported. */
  private async recordWatches(
    userId: string,
    episodeId: string,
    totalWatches: number,
    watchedAt: Date | null,
  ): Promise<number> {
    const existing = await this.prisma.episodeWatch.count({
      where: { userId, episodeId },
    });
    if (existing > 0) return 0; // Idempotent re-run.

    await this.prisma.episodeWatch.createMany({
      data: Array.from({ length: totalWatches }, () => ({
        userId,
        episodeId,
        watchedAt: watchedAt ?? undefined,
      })),
    });
    return totalWatches;
  }

  private async upsertSeriesEntry(
    userId: string,
    tmdbId: string,
    status: EntryStatus,
    show: ParsedShow,
  ): Promise<void> {
    const ref = await this.prisma.mediaExternalId.findUnique({
      where: { source_externalId: { source: "TMDB", externalId: tmdbId } },
    });
    if (!ref) return; // upsertFromSource ran just before, so this always exists.

    const { startedAt, finishedAt } = watchWindow(show, status === "COMPLETED");
    await this.prisma.libraryEntry.upsert({
      where: {
        userId_mediaItemId: { userId, mediaItemId: ref.mediaItemId },
      },
      update: { status, startedAt, finishedAt },
      create: {
        userId,
        mediaItemId: ref.mediaItemId,
        status,
        startedAt,
        finishedAt,
      },
    });
  }

  private pruneOldJobs(): void {
    const cutoff = Date.now() - JOB_RETENTION_MS;
    for (const [id, job] of this.jobs) {
      if (job.finishedAt !== null && job.finishedAt < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}

function toDto(job: JobRecord): TvTimeImportJobDto {
  return {
    id: job.id,
    status: job.status,
    dryRun: job.dryRun,
    progress: job.progress,
    report: job.report,
    error: job.error,
  };
}

function emptyReport(dryRun: boolean, overwrite: boolean): TvTimeImportReport {
  return {
    dryRun,
    overwrite,
    shows: { total: 0, imported: 0, watchlist: 0, unresolved: [] },
    episodes: { watched: 0, watchesCreated: 0, unmatched: [] },
    movies: { total: 0, imported: 0, watchlist: 0, unresolved: [] },
  };
}

function indexFromDetails(details: MediaDetailsDto): EpisodeIndex {
  const byKey = new Map<string, string | null>();
  let totalRegular = 0;
  for (const season of details.seasons) {
    for (const episode of season.episodes) {
      byKey.set(`${season.number}|${episode.number}`, null);
      if (season.number > 0) totalRegular++;
    }
  }
  return { byKey, totalRegular };
}

/** Earliest and latest watch dates; finishedAt only makes sense when complete. */
function watchWindow(
  show: ParsedShow,
  completed: boolean,
): { startedAt: Date | null; finishedAt: Date | null } {
  const dates = show.episodes
    .map((e) => e.watchedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return { startedAt: null, finishedAt: null };
  return {
    startedAt: dates[0],
    finishedAt: completed ? dates[dates.length - 1] : null,
  };
}

/**
 * Confident movie match only: exact (case-insensitive) title, preferring a
 * matching year. The export carries original-language titles while TMDB's
 * `title` is localized (en-US), so we also accept a hit on `originalTitle`.
 * Anything fuzzier is left for manual validation.
 */
function pickMovie(
  summaries: MediaSummaryDto[],
  title: string,
  year: number | null,
): MediaSummaryDto | null {
  const norm = (s: string) => s.toLowerCase().trim();
  const query = norm(title);
  const exact = summaries.filter(
    (s) =>
      norm(s.title) === query ||
      (s.originalTitle != null && norm(s.originalTitle) === query),
  );
  if (exact.length === 0) return null;

  if (year !== null) {
    const sameYear = exact.find(
      (s) => s.year !== null && Math.abs(s.year - year) <= 1,
    );
    if (sameYear) return sameYear;
  }
  return exact[0];
}

function pushCapped<T>(arr: T[], item: T): void {
  if (arr.length < IMPORT_REPORT_SAMPLE_CAP) arr.push(item);
}
