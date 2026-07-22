import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import type { ReportPageDto, ReportStatus } from "@tracklore/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { ResolveReportBody } from "../reports/dto/resolve-report.dto";
import { ReportService } from "../reports/report.service";
import { AdminOnly } from "./admin-only.decorator";

const STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

/** The comment/review/user moderation queue fed by the "signaler" button. */
@AdminOnly()
@Controller("admin/reports")
export class AdminReportsController {
  constructor(
    private readonly reports: ReportService,
    private readonly comments: CommentService,
  ) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("reporterId") reporterId?: string,
  ): Promise<ReportPageDto> {
    return this.reports.list(
      STATUSES.includes(status as ReportStatus)
        ? (status as "PENDING" | "RESOLVED" | "DISMISSED")
        : undefined,
      cursor,
      reporterId,
    );
  }

  @Get("pending-count")
  async pendingCount(): Promise<{ count: number }> {
    return { count: await this.reports.pendingCount() };
  }

  @Post(":id/resolve")
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ResolveReportBody,
  ): Promise<void> {
    return this.reports.resolve(user.sub, id, body.status);
  }

  /** Removes the reported content itself (comment tombstone today), then resolves the report. */
  @Post(":id/take-down")
  async takeDown(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    const report = await this.reports.findOne(id);
    if (!report) throw new NotFoundException();

    if (report.targetType === "COMMENT") {
      await this.comments.adminRemove(report.targetId);
    }

    await this.reports.resolve(user.sub, id, "RESOLVED");
  }
}
