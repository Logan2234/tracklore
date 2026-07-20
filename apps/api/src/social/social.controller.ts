import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  FollowRequestDto,
  RelationshipDto,
  SocialProfileDto,
  UserSearchResultDto,
  UserSummaryDto,
} from "@tracklore/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { FollowService } from "./follow.service";
import { ProfileService } from "./profile.service";
import { SocialFeatureGuard } from "./social-feature.guard";

// The whole controller is gated behind SOCIAL_ENABLED (404 when off).
@UseGuards(SocialFeatureGuard)
@Controller("social")
export class SocialController {
  constructor(
    private readonly follow: FollowService,
    private readonly profiles: ProfileService,
  ) {}

  @Get("search")
  search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q = "",
  ): Promise<UserSearchResultDto[]> {
    return this.profiles.search(user.sub, q);
  }

  @Get("requests")
  requests(@CurrentUser() user: JwtPayload): Promise<FollowRequestDto[]> {
    return this.follow.listRequests(user.sub);
  }

  @Post("requests/:id/accept")
  accept(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.follow.acceptRequest(user.sub, id);
  }

  @Post("requests/:id/reject")
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.follow.rejectRequest(user.sub, id);
  }

  @Get("me/followers")
  myFollowers(@CurrentUser() user: JwtPayload): Promise<UserSummaryDto[]> {
    return this.follow.listFollowers(user.sub);
  }

  @Get("me/following")
  myFollowing(@CurrentUser() user: JwtPayload): Promise<UserSummaryDto[]> {
    return this.follow.listFollowing(user.sub);
  }

  @Get("users/:username")
  profile(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<SocialProfileDto> {
    return this.profiles.getProfile(user.sub, username);
  }

  @Post("users/:username/follow")
  followUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.follow(user.sub, username);
  }

  @Delete("users/:username/follow")
  unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unfollow(user.sub, username);
  }

  @Post("users/:username/block")
  blockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.block(user.sub, username);
  }

  @Delete("users/:username/block")
  unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unblock(user.sub, username);
  }
}
