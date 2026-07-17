import { Injectable } from "@nestjs/common";
import type { SecurityEventDto, SecurityEventType } from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Events per page on the admin "Sécurité" list. */
const PAGE_SIZE = 50;

export interface RecordSecurityEventParams {
  type: SecurityEventType;
  /** Null when the account is unknown (e.g. a LOGIN_FAILED against an unregistered identifier). */
  userId?: string | null;
  identifier: string;
  detail?: string;
  userAgent?: string;
}

export interface ListSecurityEventsParams {
  type?: SecurityEventType;
  /** Case-insensitive partial match against `identifier` — deliberately not limited to current accounts, so it still finds trails left by deleted ones. */
  identifier?: string;
  page?: number;
}

@Injectable()
export class SecurityEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordSecurityEventParams): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type: params.type,
        userId: params.userId ?? null,
        identifier: params.identifier,
        detail: params.detail,
        userAgent: params.userAgent,
      },
    });
  }

  async list(
    params: ListSecurityEventsParams,
  ): Promise<{ events: SecurityEventDto[]; page: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;

    const events = await this.prisma.securityEvent.findMany({
      where: {
        type: params.type,
        identifier: params.identifier
          ? { contains: params.identifier, mode: "insensitive" }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return {
      page,
      events: events.map((e) => ({
        id: e.id,
        type: e.type as SecurityEventType,
        userId: e.userId,
        identifier: e.identifier,
        detail: e.detail,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
