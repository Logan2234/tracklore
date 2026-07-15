import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminStatsDto,
  AdminTrendsDto,
  AdminUserDto,
  JobListResponseDto,
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  SchemaGraphResponseDto,
  ServiceStatusResponseDto,
  SessionDto,
  TrendPeriod,
} from "@tracklore/shared";
import { AuthService } from "../auth/auth.service";
import { MediaItemService } from "../catalog/media-item.service";
import { JOB_KEYS, type JobKey } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { NotificationService } from "../notifications/notification.service";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminService } from "./admin.service";
import { AdminStatsService } from "./admin-stats.service";
import { SendAdminTestPushDto } from "./dto/send-admin-test-push.dto";
import { SendTestEmailDto } from "./dto/send-test-email.dto";

@AdminOnly()
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly jobRuns: JobRunService,
    private readonly notifications: NotificationService,
    private readonly mediaItems: MediaItemService,
    private readonly adminStats: AdminStatsService,
  ) {}

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

  /** Every known scheduled job, with its recent run history. */
  @Get("jobs")
  async listJobs(): Promise<JobListResponseDto> {
    return { jobs: await this.jobRuns.listJobs() };
  }

  /** Triggers a job immediately (both are idempotent — safe outside its cron tick). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("jobs/:key/run")
  async runJob(@Param("key") key: string): Promise<void> {
    switch (key as JobKey) {
      case JOB_KEYS.NOTIFICATIONS_SCAN:
        await this.notifications.scanAll();
        return;
      case JOB_KEYS.MEDIA_REFRESH_STALE:
        await this.mediaItems.refreshStale();
        return;
      default:
        throw new NotFoundException("Unknown job");
    }
  }

  /** Every registered account, most recently created first. */
  @Get("users")
  async listUsers(): Promise<AdminUserDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      emailVerified: u.emailVerified,
      entitlements: Array.isArray(u.entitlements)
        ? (u.entitlements as string[])
        : [],
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /** Signed-in devices for one account, most recently active first. */
  @Get("users/:userId/sessions")
  listUserSessions(@Param("userId") userId: string): Promise<SessionDto[]> {
    return this.authService.listSessions(userId);
  }

  /** Revokes one device for an account (forced logout). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("users/:userId/sessions/:sessionId")
  async revokeUserSession(
    @Param("userId") userId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSession(userId, sessionId);
  }

  /** Every template available in the email gallery. */
  @Get("emails")
  listEmailTemplates(): MailTemplateListResponseDto {
    return {
      templates: this.mail.listTemplates(),
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  /**
   * Renders one template with its sample data — nothing is sent. Query
   * params matching a field key (see `listEmailTemplates`) override that
   * field's default, e.g. `?displayName=A+very+long+name…`.
   */
  @Get("emails/:key/preview")
  previewEmailTemplate(
    @Param("key") key: string,
    @Query() overrides: Record<string, string>,
  ): MailTemplatePreviewDto {
    const preview = this.mail.renderTemplatePreview(key, overrides);
    if (!preview) throw new NotFoundException("Unknown template");
    return preview;
  }

  /** Sends one template, rendered with the same (possibly overridden) sample data as the preview, to a chosen address. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("emails/:key/test")
  async sendTestEmail(
    @Param("key") key: string,
    @Body() dto: SendTestEmailDto,
  ): Promise<void> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException("SMTP is not configured");
    }

    const sent = await this.mail.sendTemplateTest(key, dto.to, dto.values);
    if (!sent) throw new NotFoundException("Unknown template");
  }

  /** Devices the account matching `email` has an active push subscription on. */
  @Get("push/devices")
  async listPushDevices(
    @Query("email") email: string,
  ): Promise<AdminPushDeviceDto[]> {
    const user = await this.findUserByEmail(email);
    const devices = await this.push.listSubscriptions(user.id);
    return devices.map((d) => ({
      id: d.id,
      userAgent: d.userAgent,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  /** Sends a sample push to every device of the account matching `email`. */
  @Post("push/test")
  async sendAdminTestPush(
    @Body() dto: SendAdminTestPushDto,
  ): Promise<AdminPushSendResponseDto> {
    const user = await this.findUserByEmail(dto.email);
    const devices = await this.push.listSubscriptions(user.id);

    const results = await this.push.sendToUserDetailed(user.id, {
      title: dto.title?.trim() || "Tracklore (admin)",
      body:
        dto.body?.trim() ||
        "Ceci est une notification de test envoyée depuis le panel admin.",
      url: "/notifications",
    });

    return { subscriptionCount: devices.length, results };
  }

  private async findUserByEmail(email: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("No account with this email");
    return user;
  }
}
