import { Injectable } from "@nestjs/common";
import {
  ProfileAccess,
  type UpdateVisibilitySettingsDto,
  type VisibilitySettingItemDto,
  type VisibilitySettingsDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SOCIAL_DOMAINS, SOCIAL_FACETS } from "./social.constants";
import { VisibilityService } from "./visibility.service";

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /** The full privacy config: profile access + every domain × facet audience. */
  async getSettings(userId: string): Promise<VisibilitySettingsDto> {
    const [user, map] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileAccess: true },
      }),
      this.visibility.getSettingsMap(userId),
    ]);

    const settings: VisibilitySettingItemDto[] = [];

    for (const domain of SOCIAL_DOMAINS) {
      for (const facet of SOCIAL_FACETS) {
        settings.push({
          domain,
          facet,
          audience: this.visibility.audienceFor(map, domain, facet),
        });
      }
    }

    return { profileAccess: user.profileAccess as ProfileAccess, settings };
  }

  /** Applies a partial update (profile access and/or individual matrix cells). */
  async updateSettings(
    userId: string,
    dto: UpdateVisibilitySettingsDto,
  ): Promise<VisibilitySettingsDto> {
    const ops: Promise<unknown>[] = [];

    if (dto.profileAccess) {
      ops.push(
        this.prisma.user.update({
          where: { id: userId },
          data: { profileAccess: dto.profileAccess },
        }),
      );
    }

    for (const cell of dto.settings ?? []) {
      ops.push(
        this.prisma.visibilitySetting.upsert({
          where: {
            userId_domain_facet: {
              userId,
              domain: cell.domain,
              facet: cell.facet,
            },
          },
          update: { audience: cell.audience },
          create: {
            userId,
            domain: cell.domain,
            facet: cell.facet,
            audience: cell.audience,
          },
        }),
      );
    }

    await Promise.all(ops);
    return this.getSettings(userId);
  }
}
