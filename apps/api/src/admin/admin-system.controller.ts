import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AdminBackupDto,
  AdminStatsDto,
  AdminTrendsDto,
  AdminVersionDto,
  SchemaGraphResponseDto,
  ServiceStatusResponseDto,
  TrendPeriod,
} from "@tracklore/shared";
import { AdminOnly } from "./admin-only.decorator";
import { AdminService } from "./admin.service";
import { AdminStatsService } from "./admin-stats.service";
import { BackupService } from "./backup.service";
import { RestoreBackupDto } from "./dto/restore-backup.dto";

// process.cwd() is apps/api in both dev (pnpm --filter) and the Docker image
// (WORKDIR) — same trick as admin.service.ts's DOCS_DIR.
const ROOT_PACKAGE_JSON = join(process.cwd(), "..", "..", "package.json");

/** Instance-wide system info: version, backup, dependency health, schema, stats. */
@AdminOnly()
@Controller("admin")
export class AdminSystemController {
  constructor(
    private readonly admin: AdminService,
    private readonly adminStats: AdminStatsService,
    private readonly backup: BackupService,
  ) {}

  /** The running app's version (monorepo root package.json), for the admin/settings footer. */
  @Get("version")
  async getVersion(): Promise<AdminVersionDto> {
    const raw = await readFile(ROOT_PACKAGE_JSON, "utf-8");
    const { version } = JSON.parse(raw) as { version: string };
    return { version };
  }

  /** Full plain-SQL dump of the instance database (pg_dump), for download. */
  @Get("backup")
  getBackup(): Promise<AdminBackupDto> {
    return this.backup.dump();
  }

  /**
   * Replaces the entire instance database with a previously downloaded dump.
   * Irreversible — the frontend requires a typed confirmation before calling this.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("backup/restore")
  async restoreBackup(@Body() dto: RestoreBackupDto): Promise<void> {
    await this.backup.restore(dto.sql);
  }

  /** Health of every external dependency (config presence + live probe). */
  @Get("services")
  getServices(): Promise<ServiceStatusResponseDto> {
    return this.admin.getServicesStatus();
  }

  /** Locally-generated architecture diagrams (DB ERD, module graph). */
  @Get("schema")
  getSchema(): Promise<SchemaGraphResponseDto> {
    return this.admin.getSchemaGraphs();
  }

  /** Instance-wide dashboard: cross-account aggregates, distinct from the per-user /stats page. */
  @Get("stats")
  getStats(): Promise<AdminStatsDto> {
    return this.adminStats.getStats();
  }

  /** Trend series at a chosen granularity (day/week/month/year). Unknown periods fall back to week. */
  @Get("stats/trends")
  getTrends(@Query("period") period?: string): Promise<AdminTrendsDto> {
    const valid: TrendPeriod[] = ["day", "week", "month", "year"];
    const resolved = valid.includes(period as TrendPeriod)
      ? (period as TrendPeriod)
      : "week";
    return this.adminStats.getTrends(resolved);
  }
}
