import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  type CommentDto,
  type CommentPageDto,
  CommentTargetType,
  type CommentTargetType as CommentTargetTypeT,
} from "@tracklore/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { ReportService } from "../reports/report.service";
import { CreateReportBody } from "../reports/dto/create-report.dto";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { CommentService } from "./comment.service";
import { CreateCommentBody } from "./dto/create-comment.dto";
import { ReactCommentBody } from "./dto/react-comment.dto";
import { UpdateCommentBody } from "./dto/update-comment.dto";

function parseTarget(type: string): CommentTargetTypeT {
  if (!(Object.values(CommentTargetType) as string[]).includes(type)) {
    throw new BadRequestException("Unknown comment target type");
  }

  return type as CommentTargetTypeT;
}

// Comments only make sense between people, so — unlike reviews — there is no
// self-host-safe "keep it local" fallback: the whole controller gates behind
// SOCIAL_ENABLED (404 when off).
@UseGuards(SocialFeatureGuard)
@Controller("comments")
export class CommentController {
  constructor(
    private readonly comments: CommentService,
    private readonly reports: ReportService,
  ) {}

  @Get(":type/:id")
  list(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
    @Query("cursor") cursor?: string,
  ): Promise<CommentPageDto> {
    return this.comments.list(user.sub, parseTarget(type), id, cursor);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCommentBody,
  ): Promise<CommentDto> {
    return this.comments.create(user.sub, body);
  }

  @Put(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: UpdateCommentBody,
  ): Promise<CommentDto> {
    return this.comments.update(user.sub, id, body);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.comments.remove(user.sub, id);
  }

  @Post(":id/react")
  react(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ReactCommentBody,
  ): Promise<void> {
    return this.comments.react(user.sub, id, body.emote);
  }

  @Delete(":id/react")
  unreact(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.comments.unreact(user.sub, id);
  }

  @Post(":id/report")
  report(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: CreateReportBody,
  ): Promise<void> {
    return this.reports.create(user.sub, "COMMENT", id, body.reason);
  }
}
