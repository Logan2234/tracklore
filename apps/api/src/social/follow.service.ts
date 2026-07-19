import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type FollowRequestDto,
  ProfileAccess,
  type RelationshipDto,
  type UserSummaryDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VisibilityService } from "./visibility.service";

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
} as const;

@Injectable()
export class FollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * Resolves a target by username for a viewer, or throws 404. A GHOST target,
   * or one that blocked the viewer, is reported as not-found (it must stay
   * invisible). Self is allowed (the caller decides what to do with it).
   */
  private async resolveTarget(viewerId: string, username: string) {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target) throw new NotFoundException();

    if (target.id !== viewerId) {
      if (target.profileAccess === ProfileAccess.GHOST) {
        throw new NotFoundException();
      }

      const blocked = await this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: target.id, blockedId: viewerId },
        },
      });
      if (blocked) throw new NotFoundException();
    }

    return target;
  }

  /** Follows a user: immediate on a PUBLIC profile, a request on a PRIVATE one. */
  async follow(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.resolveTarget(viewerId, username);

    if (target.id === viewerId) {
      throw new BadRequestException("Cannot follow yourself");
    }

    // If the viewer blocked the target, they must unblock first.
    const blocking = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: viewerId, blockedId: target.id },
      },
    });
    if (blocking) throw new BadRequestException("Unblock this user first");

    const status =
      target.profileAccess === ProfileAccess.PUBLIC ? "ACCEPTED" : "PENDING";

    await this.prisma.follow.upsert({
      where: {
        followerId_followeeId: { followerId: viewerId, followeeId: target.id },
      },
      // Never silently downgrade an accepted follow back to pending.
      update: {},
      create: { followerId: viewerId, followeeId: target.id, status },
    });

    return this.relationship(viewerId, username);
  }

  /** Unfollows (or cancels a pending request). Idempotent. */
  async unfollow(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.resolveTarget(viewerId, username);
    await this.prisma.follow.deleteMany({
      where: { followerId: viewerId, followeeId: target.id },
    });
    return this.relationship(viewerId, username);
  }

  /** Approves a pending incoming request (identified by the Follow row id). */
  async acceptRequest(userId: string, followId: string): Promise<void> {
    const follow = await this.prisma.follow.findUnique({
      where: { id: followId },
    });

    if (
      !follow ||
      follow.followeeId !== userId ||
      follow.status !== "PENDING"
    ) {
      throw new NotFoundException();
    }

    await this.prisma.follow.update({
      where: { id: followId },
      data: { status: "ACCEPTED" },
    });
  }

  /** Rejects a pending incoming request. */
  async rejectRequest(userId: string, followId: string): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { id: followId, followeeId: userId, status: "PENDING" },
    });
    if (count === 0) throw new NotFoundException();
  }

  /** Blocks a user: removes any follow edges both ways, then records the block. */
  async block(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();

    if (target.id === viewerId) {
      throw new BadRequestException("Cannot block yourself");
    }

    await this.prisma.$transaction([
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: viewerId, followeeId: target.id },
            { followerId: target.id, followeeId: viewerId },
          ],
        },
      }),
      this.prisma.block.upsert({
        where: {
          blockerId_blockedId: { blockerId: viewerId, blockedId: target.id },
        },
        update: {},
        create: { blockerId: viewerId, blockedId: target.id },
      }),
    ]);
    return this.relationship(viewerId, username);
  }

  /** Lifts a block. */
  async unblock(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();
    await this.prisma.block.deleteMany({
      where: { blockerId: viewerId, blockedId: target.id },
    });
    return this.relationship(viewerId, username);
  }

  /** The viewer's relationship to a username. */
  async relationship(
    viewerId: string,
    username: string,
  ): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target) throw new NotFoundException();
    const relation = await this.visibility.getRelation(viewerId, target);
    return this.visibility.toRelationshipDto(relation);
  }

  /** Pending incoming follow requests awaiting the user's approval. */
  async listRequests(userId: string): Promise<FollowRequestDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        follower: { select: USER_SUMMARY_SELECT },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: r.follower as UserSummaryDto,
    }));
  }

  /** Accepted followers of a user. */
  async listFollowers(userId: string): Promise<UserSummaryDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { follower: { select: USER_SUMMARY_SELECT } },
    });
    return rows.map((r) => r.follower as UserSummaryDto);
  }

  /** Users a user follows (accepted). */
  async listFollowing(userId: string): Promise<UserSummaryDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { followee: { select: USER_SUMMARY_SELECT } },
    });
    return rows.map((r) => r.followee as UserSummaryDto);
  }
}
