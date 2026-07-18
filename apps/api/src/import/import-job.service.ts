import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ImportAnalyzeRequest,
  ImportCommitRequest,
  ImportJobDto,
  ImportPlan,
  ImportReport,
} from "@tracklore/shared";
import { randomUUID } from "node:crypto";
import {
  IMPORT_SOURCES,
  type CommitDecisions,
  type ImportSource,
  type ProgressReporter,
} from "./import-source";

/** Completed jobs are dropped from memory after this delay. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

interface JobRecord {
  id: string;
  userId: string;
  sourceId: string;
  status: "running" | "completed" | "failed";
  progress: { done: number; total: number };
  plan: ImportPlan | null;
  report: ImportReport | null;
  error: string | null;
  finishedAt: number | null;
  /** The source's parse model, kept between an analysis and its later commit. */
  parsed: unknown;
}

/**
 * The one async job engine behind every import. It owns the in-memory job
 * store, the analyze → poll → commit → poll lifecycle, progress and ownership
 * guards; each {@link ImportSource} plugs in its own parse/resolve/write. Jobs
 * live in memory (single-instance self-host) and are pruned an hour after they
 * finish.
 */
@Injectable()
export class ImportJobService {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly sources: Map<string, ImportSource>;

  constructor(@Inject(IMPORT_SOURCES) sources: ImportSource[]) {
    this.sources = new Map(sources.map((s) => [s.id, s]));
  }

  /**
   * Parse the export and, in the background, resolve it into a review
   * {@link ImportPlan} — writing nothing. Returns a pending job to poll.
   */
  startAnalyze(
    userId: string,
    sourceId: string,
    dto: ImportAnalyzeRequest,
  ): ImportJobDto {
    this.pruneOldJobs();
    const source = this.sourceOrThrow(sourceId);

    let parsed: unknown;

    try {
      parsed = source.parseInput(dto.input, dto.options ?? {});
    } catch (error) {
      // A malformed export is a client error, not a failed job.
      throw new BadRequestException(
        error instanceof Error ? error.message : "Could not read the export",
      );
    }

    const job = this.newJob(userId, sourceId, parsed);
    this.jobs.set(job.id, job);

    const progress = this.progressFor(job);
    void this.run(job, async () => {
      job.plan = await source.buildPlan(userId, parsed, progress);
    });

    return toDto(job);
  }

  /** Commit a previously analysed import with the user's decisions. */
  commit(
    userId: string,
    sourceId: string,
    jobId: string,
    dto: ImportCommitRequest,
  ): ImportJobDto {
    this.pruneOldJobs();
    const source = this.sourceOrThrow(sourceId);

    const analyzed = this.jobs.get(jobId);
    if (!analyzed) throw new NotFoundException("Import job not found");

    if (analyzed.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }

    if (analyzed.sourceId !== sourceId) {
      throw new BadRequestException("Import job source mismatch");
    }

    if (
      analyzed.parsed === null ||
      analyzed.parsed === undefined ||
      !analyzed.plan
    ) {
      throw new BadRequestException("This job has no analysis to commit");
    }

    const decisions: CommitDecisions = {
      include: new Set(dto.include),
      statuses: new Map(Object.entries(dto.statuses ?? {})),
      overrides: new Map(Object.entries(dto.overrides ?? {})),
      overwrite: (dto.overwrite ?? false) && source.supportsOverwrite,
    };

    const { parsed, plan } = analyzed;
    const job = this.newJob(userId, sourceId, null);
    job.progress.total = decisions.include.size;
    this.jobs.set(job.id, job);

    const progress = this.progressFor(job);
    void this.run(job, async () => {
      job.report = await source.commit(
        userId,
        parsed,
        plan,
        decisions,
        progress,
      );
    });

    return toDto(job);
  }

  getJob(userId: string, jobId: string): ImportJobDto {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Import job not found");

    if (job.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }

    return toDto(job);
  }

  private sourceOrThrow(sourceId: string): ImportSource {
    const source = this.sources.get(sourceId);
    if (!source)
      throw new NotFoundException(`Unknown import source: ${sourceId}`);
    return source;
  }

  private newJob(userId: string, sourceId: string, parsed: unknown): JobRecord {
    return {
      id: randomUUID(),
      userId,
      sourceId,
      status: "running",
      progress: { done: 0, total: 0 },
      plan: null,
      report: null,
      error: null,
      finishedAt: null,
      parsed,
    };
  }

  private progressFor(job: JobRecord): ProgressReporter {
    return {
      setTotal: (total) => {
        job.progress.total = total;
      },
      tick: () => {
        job.progress.done++;
      },
    };
  }

  /** Run the background work, flipping the job to completed/failed when done. */
  private async run(job: JobRecord, work: () => Promise<void>): Promise<void> {
    try {
      await work();
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = Date.now();
    }
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

function toDto(job: JobRecord): ImportJobDto {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    plan: job.plan,
    report: job.report,
    error: job.error,
  };
}
