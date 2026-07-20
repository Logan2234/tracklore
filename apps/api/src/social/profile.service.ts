import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Domain,
  type ProfileDomainStatDto,
  ProfileAccess,
  type SocialProfileDto,
  type UserSearchResultDto,
  VisibilityFacet,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SOCIAL_DOMAINS } from "./social.constants";
import { resolveFacet, resolveProfileVisibility } from "./visibility.util";
import { VisibilityService } from "./visibility.service";

const SEARCH_LIMIT = 20;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /** Builds a user's profile as seen by `viewerId`, or 404 if not reachable. */
  async getProfile(
    viewerId: string,
    username: string,
  ): Promise<SocialProfileDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileAccess: true,
        createdAt: true,
      },
    });
    if (!target) throw new NotFoundException();

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);

    if (visibility === "hidden") {
      // GHOST or a block in either direction: the profile must not exist.
      throw new NotFoundException();
    }

    if (visibility === "locked") {
      // PRIVATE stranger: expose identity + the follow-request affordance only.
      // No content (bio, counts, library) ever leaves the server here.
      return {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        bio: null,
        profileAccess: target.profileAccess as ProfileAccess,
        createdAt: target.createdAt.toISOString(),
        followerCount: 0,
        followingCount: 0,
        relationship: this.visibility.toRelationshipDto(relation),
        domains: [],
        locked: true,
      };
    }

    const [followerCount, followingCount, settings] = await Promise.all([
      this.prisma.follow.count({
        where: { followeeId: target.id, status: "ACCEPTED" },
      }),
      this.prisma.follow.count({
        where: { followerId: target.id, status: "ACCEPTED" },
      }),
      this.visibility.getSettingsMap(target.id),
    ]);

    const domains: ProfileDomainStatDto[] = [];

    for (const domain of SOCIAL_DOMAINS) {
      const audience = this.visibility.audienceFor(
        settings,
        domain,
        VisibilityFacet.LIBRARY,
      );
      const visible = resolveFacet(target.profileAccess, audience, relation);
      domains.push({
        domain,
        visible,
        count: visible ? await this.countLibrary(target.id, domain) : 0,
      });
    }

    return {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      bio: target.bio,
      profileAccess: target.profileAccess as ProfileAccess,
      createdAt: target.createdAt.toISOString(),
      followerCount,
      followingCount,
      relationship: this.visibility.toRelationshipDto(relation),
      domains,
      locked: false,
    };
  }

  /** Directory search. Excludes self, GHOSTs and anyone who blocked the viewer. */
  async search(
    viewerId: string,
    query: string,
  ): Promise<UserSearchResultDto[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: viewerId },
        profileAccess: { not: ProfileAccess.GHOST },
        // Not blocked by the target (they must not surface to the viewer).
        blocking: { none: { blockedId: viewerId } },
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: SEARCH_LIMIT,
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileAccess: true,
      },
    });

    return Promise.all(
      users.map(async (u) => {
        const relation = await this.visibility.getRelation(viewerId, u);
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          bio: u.bio,
          profileAccess: u.profileAccess as ProfileAccess,
          relationship: this.visibility.toRelationshipDto(relation),
        };
      }),
    );
  }

  private countLibrary(userId: string, domain: Domain): Promise<number> {
    switch (domain) {
      case Domain.MEDIA:
        return this.prisma.libraryEntry.count({ where: { userId } });
      case Domain.GAMES:
        return this.prisma.gameEntry.count({ where: { userId } });
      case Domain.BOOKS:
        return this.prisma.bookEntry.count({ where: { userId } });
      case Domain.MUSIC:
        return this.prisma.musicEntry.count({ where: { userId } });
      default:
        return Promise.resolve(0);
    }
  }
}
