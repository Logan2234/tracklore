import { Controller, Get, Query } from "@nestjs/common";
import type {
  AdminImportRunListResponseDto,
  JobStatus,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";

const PAGE_SIZE = 50;
const STATUSES: JobStatus[] = ["SUCCESS", "FAILURE"];

/** Audit log of committed imports (TV Time, StoryGraph, Goodreads, Steam), across every account. */
@AdminOnly()
@Controller("admin")
export class AdminImportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Most recent commits first, filterable by source/status/account and paginated. */
  @Get("imports")
  async listImportRuns(
    @Query("source") source?: string,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
    @Query("page") page?: string,
  ): Promise<AdminImportRunListResponseDto> {
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const where = {
      sourceId: source?.trim() || undefined,
      status: STATUSES.includes(status as JobStatus)
        ? (status as JobStatus)
        : undefined,
      userId: userId?.trim() || undefined,
    };

    const runs = await this.prisma.importRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return {
      page: pageNum,
      runs: runs.map((r) => ({
        id: r.id,
        userId: r.userId,
        identifier: r.identifier,
        sourceId: r.sourceId,
        status: r.status as JobStatus,
        itemCount: r.itemCount,
        overwrite: r.overwrite,
        summary: r.summary,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt.toISOString(),
      })),
    };
  }
}
