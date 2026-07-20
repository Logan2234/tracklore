import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  type ReviewDto,
  type ReviewRevisionDto,
  ReviewTargetType,
} from "@tracklore/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { UpsertReviewBody } from "./dto/upsert-review.dto";
import { ReviewService } from "./review.service";

function parseTarget(type: string): ReviewTargetType {
  if (!(Object.values(ReviewTargetType) as string[]).includes(type)) {
    throw new BadRequestException("Unknown review target type");
  }

  return type as ReviewTargetType;
}

@Controller("reviews")
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  // --- Own reviews: NOT social-gated (rating your own items always works). ---

  @Get("me")
  listMine(@CurrentUser() user: JwtPayload): Promise<ReviewDto[]> {
    return this.reviews.listMine(user.sub);
  }

  @Get("me/:type/:id")
  getMine(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewDto | null> {
    return this.reviews.getMine(user.sub, parseTarget(type), id);
  }

  @Put("me/:type/:id")
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: UpsertReviewBody,
  ): Promise<ReviewDto> {
    return this.reviews.upsert(user.sub, parseTarget(type), id, body);
  }

  @Delete("me/:type/:id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.reviews.remove(user.sub, parseTarget(type), id);
  }

  @Get("me/:type/:id/revisions")
  revisions(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewRevisionDto[]> {
    return this.reviews.revisions(user.sub, parseTarget(type), id);
  }

  // --- Others' reviews for a target: social-gated + visibility-filtered. ---

  @Get(":type/:id")
  @UseGuards(SocialFeatureGuard)
  listForTarget(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewDto[]> {
    return this.reviews.listForTarget(user.sub, parseTarget(type), id);
  }
}
