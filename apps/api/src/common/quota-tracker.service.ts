import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Records one call against a provider's daily counter, for the /admin/services
 * page. Fire-and-forget: counting must never slow down or break the real
 * upstream call, so failures are swallowed rather than surfaced.
 */
@Injectable()
export class QuotaTrackerService {
  constructor(private readonly prisma: PrismaService) {}

  record(provider: string): void {
    const day = startOfUtcDay(new Date());
    this.prisma.apiCallCounter
      .upsert({
        where: { provider_day: { provider, day } },
        update: { count: { increment: 1 } },
        create: { provider, day, count: 1 },
      })
      .catch(() => {});
  }
}
