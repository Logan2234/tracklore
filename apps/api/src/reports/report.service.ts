import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type ReportDto,
  type ReportPageDto,
  type ReportTargetSummaryDto,
  type ReportTargetType,
  type UserSummaryDto,
} from "@tracklore/shared";
import { resolveWorkHref } from "../common/work-href.util";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

const REPORTER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
} as const;

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Files a report against a polymorphic target. Fire-and-forget from the caller's POV. */
  async create(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason: reason ?? null },
    });
  }

  async pendingCount(): Promise<number> {
    return this.prisma.report.count({ where: { status: "PENDING" } });
  }

  async findOne(
    id: string,
  ): Promise<{ targetType: ReportTargetType; targetId: string } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { targetType: true, targetId: true },
    });
    return report
      ? {
          targetType: report.targetType as ReportTargetType,
          targetId: report.targetId,
        }
      : null;
  }

  async list(
    status: "PENDING" | "RESOLVED" | "DISMISSED" | undefined,
    cursor?: string,
  ): Promise<ReportPageDto> {
    const rows = await this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { reporter: { select: REPORTER_SELECT } },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);

    const reports = await Promise.all(
      page.map(async (r): Promise<ReportDto> => ({
        id: r.id,
        targetType: r.targetType as ReportTargetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status as ReportDto["status"],
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        reporter: r.reporter as UserSummaryDto,
        target: await this.resolveTarget(
          r.targetType as ReportTargetType,
          r.targetId,
        ),
      })),
    );

    return {
      reports,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async resolve(
    adminId: string,
    id: string,
    status: "RESOLVED" | "DISMISSED",
  ): Promise<void> {
    const { count } = await this.prisma.report.updateMany({
      where: { id, status: "PENDING" },
      data: { status, resolvedAt: new Date(), resolvedById: adminId },
    });
    if (count === 0) throw new NotFoundException();
  }

  private async resolveTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ReportTargetSummaryDto | null> {
    if (targetType === "COMMENT") {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          text: true,
          deletedAt: true,
          targetType: true,
          targetId: true,
          author: { select: { username: true } },
        },
      });
      if (!comment) return null;
      const excerpt = comment.deletedAt
        ? "(commentaire supprimé)"
        : (comment.text ?? "").slice(0, EXCERPT_LENGTH);
      return {
        label: `@${comment.author.username} — ${excerpt}`,
        href: await resolveWorkHref(
          this.prisma,
          comment.targetType,
          comment.targetId,
        ),
      };
    }

    if (targetType === "USER") {
      const user = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { username: true },
      });
      if (!user) return null;
      return { label: `@${user.username}`, href: `/u/${user.username}` };
    }

    // REVIEW: no reporting UI wired to reviews yet (P4 backlog) — resolve
    // generically so the queue still renders if one is ever filed.
    return { label: `review:${targetId}`, href: null };
  }
}
