import { ForbiddenException, Injectable } from "@nestjs/common";
import { Domain } from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Enforces `User.enabledDomains` server-side: a domain the user turned off is
 * not just hidden from the nav, it is unreachable. Called by the per-domain
 * search endpoints so a disabled domain returns 403 instead of results.
 */
@Injectable()
export class DomainGateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws 403 unless the user keeps `domain` enabled. */
  async assertEnabled(userId: string, domain: Domain): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { enabledDomains: true },
    });

    if (!user?.enabledDomains.includes(domain)) {
      throw new ForbiddenException(`Domain '${domain}' is disabled`);
    }
  }
}
