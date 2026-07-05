import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import type {
  CatalogSource,
  EntryStatus,
  ImportCommitOverride,
  ImportCommitRequest,
  ImportMatch,
  ImportPlan,
  ImportPlanMovie,
  ImportPlanShow,
  MediaSummaryDto,
  MediaType,
  StartTvTimeImportDto,
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
import type {
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../import-source";
import { TvTimeImportSource } from "./tvtime.source";

/** Completed jobs are dropped from memory after this delay. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

interface JobRecord extends TvTimeImportJobDto {
  userId: string;
  finishedAt: number | null;
  /** Canonical parse, kept between an analysis and its later commit. */
  parsed: ParsedImport | null;
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
    private readonly tvtimeSource: TvTimeImportSource,
  ) {}

  /**
   * Analyse an export: parse + resolve every title against the catalogue and
   * build a reconciliation {@link ImportPlan} — writing nothing. The plan (and
   * the canonical parse it came from) is kept on the job so a later `commit`
   * can act on the user's decisions.
   */
  startAnalyze(userId: string, dto: StartTvTimeImportDto): TvTimeImportJobDto {
    this.pruneOldJobs();

    const importMovies = dto.importMovies ?? true;
    const parsed = this.tvtimeSource.parse(
      Buffer.from(dto.zipBase64, "base64"),
    );
    const movies = importMovies ? parsed.movies : [];

    const job: JobRecord = {
      id: randomUUID(),
      userId,
      dryRun: true, // analysis never writes
      status: "running",
      progress: {
        shows: 0,
        totalShows: parsed.shows.length,
        movies: 0,
        totalMovies: movies.length,
      },
      plan: null,
      report: null,
      error: null,
      finishedAt: null,
      parsed: { ...parsed, movies },
    };
    this.jobs.set(job.id, job);

    void this.buildPlan(job);
    return toDto(job);
  }

  private async buildPlan(job: JobRecord): Promise<void> {
    try {
      const parsed = job.parsed;
      if (!parsed) throw new Error("Analysis job has no parsed export");

      const seriesTracked: ImportPlanShow[] = [];
      const seriesWatchlist: ImportPlanShow[] = [];
      let unresolved = 0;

      for (const show of parsed.shows) {
        const match = await this.resolveShowMatch(show);
        if (!match) unresolved++;
        const item: ImportPlanShow = {
          key: showKey(show),
          title: show.title,
          episodesWatched: show.episodes.length,
          match,
          include: match !== null,
        };
        (show.episodes.length === 0 ? seriesWatchlist : seriesTracked).push(
          item,
        );
        job.progress.shows++;
      }

      const moviesWatched: ImportPlanMovie[] = [];
      const moviesWatchlist: ImportPlanMovie[] = [];
      for (const movie of parsed.movies) {
        const match = await this.resolveMovieMatch(movie);
        if (!match) unresolved++;
        const item: ImportPlanMovie = {
          key: movieKey(movie),
          title: movie.title,
          year: movie.year,
          watched: movie.watched,
          match,
          include: match !== null,
        };
        (movie.watched ? moviesWatched : moviesWatchlist).push(item);
        job.progress.movies++;
      }

      job.plan = {
        seriesTracked,
        seriesWatchlist,
        moviesWatched,
        moviesWatchlist,
        counts: {
          shows: parsed.shows.length,
          movies: parsed.movies.length,
          unresolved,
        },
      };
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = Date.now();
    }
  }

  /** Resolve a show to a catalogue match (via its external ids); null if none. */
  private async resolveShowMatch(show: ImportShow): Promise<ImportMatch | null> {
    const tvdbId = show.externalIds.tvdb;
    if (!tvdbId) return null;
    try {
      const summary = await this.tmdb.findSeriesSummaryByTvdbId(tvdbId);
      return summary ? toMatch(summary) : null;
    } catch {
      return null;
    }
  }

  /** Resolve a movie to a confident catalogue match; null if none. */
  private async resolveMovieMatch(
    movie: ImportMovie,
  ): Promise<ImportMatch | null> {
    try {
      const summaries = await this.tmdb.search(movie.title, "MOVIE");
      const match = pickMovie(summaries, movie.title, movie.year);
      return match ? toMatch(match) : null;
    } catch {
      return null;
    }
  }

  /**
   * Commit a previously analysed import: write only the items the user kept
   * (`include`), applying any manual matches (`overrides`) for items the
   * analysis could not resolve. Runs in the background like the other flows.
   */
  commit(
    userId: string,
    jobId: string,
    dto: ImportCommitRequest,
  ): TvTimeImportJobDto {
    this.pruneOldJobs();

    const analyzed = this.jobs.get(jobId);
    if (!analyzed) throw new NotFoundException("Import job not found");
    if (analyzed.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }
    if (!analyzed.parsed || !analyzed.plan) {
      throw new BadRequestException("This job has no analysis to commit");
    }

    const include = new Set(dto.include);
    const overrides = dto.overrides ?? {};
    const matchByKey = indexPlanMatches(analyzed.plan);
    const parsed = analyzed.parsed;
    const overwrite = dto.overwrite ?? false;

    const includedShows = parsed.shows.filter((s) => include.has(showKey(s)));
    const includedMovies = parsed.movies.filter((m) => include.has(movieKey(m)));

    const job: JobRecord = {
      id: randomUUID(),
      userId,
      dryRun: false,
      status: "running",
      progress: {
        shows: 0,
        totalShows: includedShows.length,
        movies: 0,
        totalMovies: includedMovies.length,
      },
      plan: null,
      report: null,
      error: null,
      finishedAt: null,
      parsed: null,
    };
    this.jobs.set(job.id, job);

    void this.runCommit(
      job,
      userId,
      includedShows,
      includedMovies,
      overrides,
      matchByKey,
      overwrite,
    );
    return toDto(job);
  }

  private async runCommit(
    job: JobRecord,
    userId: string,
    shows: ImportShow[],
    movies: ImportMovie[],
    overrides: Record<string, ImportCommitOverride>,
    matchByKey: Map<string, ImportMatch>,
    overwrite: boolean,
  ): Promise<void> {
    const report = emptyReport(false, overwrite);
    try {
      if (overwrite) {
        await this.prisma.$transaction([
          this.prisma.episodeWatch.deleteMany({ where: { userId } }),
          this.prisma.libraryEntry.deleteMany({ where: { userId } }),
        ]);
      }

      for (const show of shows) {
        const match = overrides[showKey(show)] ?? matchByKey.get(showKey(show));
        if (match) await this.writeShow(userId, show, match, report);
        job.progress.shows++;
      }
      for (const movie of movies) {
        const match =
          overrides[movieKey(movie)] ?? matchByKey.get(movieKey(movie));
        if (match) await this.writeMovie(userId, movie, match, report);
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

  /** Write one show against an already-resolved catalogue match. */
  private async writeShow(
    userId: string,
    show: ImportShow,
    match: ImportCommitOverride,
    report: TvTimeImportReport,
  ): Promise<void> {
    report.shows.total++;

    if (show.episodes.length === 0) {
      await this.mediaItemService.upsertFromSource(
        match.source,
        match.sourceId,
        match.type,
      );
      await this.upsertSeriesEntry(
        userId,
        match.source,
        match.sourceId,
        "PLANNED",
        show,
      );
      report.shows.watchlist++;
      return;
    }

    const index = await this.persistSeriesIndex(
      match.source,
      match.sourceId,
      match.type,
    );

    let watchedRegular = 0;
    for (const ep of show.episodes) {
      const episodeId = index.byKey.get(`${ep.season}|${ep.episode}`);
      if (episodeId === undefined) {
        pushCapped(report.episodes.unmatched, {
          show: show.title,
          season: ep.season,
          episode: ep.episode,
        });
        continue;
      }
      report.episodes.watched++;
      if (ep.season > 0) watchedRegular++;
      if (episodeId) {
        report.episodes.watchesCreated += await this.recordWatches(
          userId,
          episodeId,
          ep.totalWatches,
          ep.watchedAt,
        );
      }
    }

    const status = entryStatusFromProgress(watchedRegular, index.totalRegular);
    await this.upsertSeriesEntry(
      userId,
      match.source,
      match.sourceId,
      status,
      show,
    );
    if (status === "PLANNED") report.shows.watchlist++;
    else report.shows.imported++;
  }

  /** Write one movie against an already-resolved catalogue match. */
  private async writeMovie(
    userId: string,
    movie: ImportMovie,
    match: ImportCommitOverride,
    report: TvTimeImportReport,
  ): Promise<void> {
    report.movies.total++;
    const status: EntryStatus = movie.watched ? "COMPLETED" : "PLANNED";
    const media = await this.mediaItemService.upsertFromSource(
      match.source,
      match.sourceId,
      match.type,
    );
    await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      update: { status },
      create: { userId, mediaItemId: media.id, status },
    });
    if (status === "PLANNED") report.movies.watchlist++;
    else report.movies.imported++;
  }

  getJob(userId: string, jobId: string): TvTimeImportJobDto {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Import job not found");
    if (job.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }
    return toDto(job);
  }

  /** Persist the series (on-demand cache) and index its stored episodes. */
  private async persistSeriesIndex(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<EpisodeIndex> {
    const media = await this.mediaItemService.upsertFromSource(
      source,
      sourceId,
      type,
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
    source: CatalogSource,
    sourceId: string,
    status: EntryStatus,
    show: ImportShow,
  ): Promise<void> {
    const ref = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId: {
          source: source as DbExternalSource,
          externalId: sourceId,
        },
      },
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
    plan: job.plan,
    report: job.report,
    error: job.error,
  };
}

/** Stable per-item id carried through analyze → review → commit. */
function showKey(show: ImportShow): string {
  const { tvdb, tmdb, imdb, anilist } = show.externalIds;
  if (tvdb) return `tvdb:${tvdb}`;
  if (tmdb) return `tmdb:${tmdb}`;
  if (imdb) return `imdb:${imdb}`;
  if (anilist) return `anilist:${anilist}`;
  return `show:${show.title.toLowerCase()}`;
}

function movieKey(movie: ImportMovie): string {
  return `movie:${movie.title.toLowerCase()}:${movie.year ?? ""}`;
}

/** Flatten a plan's auto-resolved matches into a key → match lookup. */
function indexPlanMatches(plan: ImportPlan): Map<string, ImportMatch> {
  const byKey = new Map<string, ImportMatch>();
  const items = [
    ...plan.seriesTracked,
    ...plan.seriesWatchlist,
    ...plan.moviesWatched,
    ...plan.moviesWatchlist,
  ];
  for (const item of items) {
    if (item.match) byKey.set(item.key, item.match);
  }
  return byKey;
}

function toMatch(summary: MediaSummaryDto): ImportMatch {
  return {
    source: summary.source,
    sourceId: summary.sourceId,
    type: summary.type,
    title: summary.title,
    year: summary.year,
    posterUrl: summary.posterUrl,
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

/** Earliest and latest watch dates; finishedAt only makes sense when complete. */
function watchWindow(
  show: ImportShow,
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
