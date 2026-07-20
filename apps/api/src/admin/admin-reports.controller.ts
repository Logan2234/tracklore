import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import type { ReportPageDto, ReportStatus } from "@tracklore/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { ResolveReportBody } from "../reports/dto/resolve-report.dto";
import { ReportService } from "../reports/report.service";
import { AdminOnly } from "./admin-only.decorator";

const STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

/** The comment/review/user moderation queue fed by the "signaler" button. */
@AdminOnly()
@Controller("admin/reports")
export class AdminReportsController {
  constructor(private readonly reports: ReportService) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
  ): Promise<ReportPageDto> {
    return this.reports.list(
      STATUSES.includes(status as ReportStatus)
        ? (status as "PENDING" | "RESOLVED" | "DISMISSED")
        : undefined,
      cursor,
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
}
