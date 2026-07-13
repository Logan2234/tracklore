import { Body, Controller, Post } from "@nestjs/common";
import type {
  StoryGraphImportPreviewDto,
  StoryGraphImportResultDto,
} from "@tracklore/shared";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import {
  StoryGraphCommitDto,
  StoryGraphPreviewDto,
} from "./dto/storygraph-import.dto";
import { StoryGraphImportService } from "./storygraph-import.service";

@Controller("books/import/storygraph")
export class StoryGraphImportController {
  constructor(
    private readonly storyGraphImport: StoryGraphImportService,
  ) {}

  /** Parse + resolve a StoryGraph CSV against Open Library. Writes nothing. */
  @Post("preview")
  preview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StoryGraphPreviewDto,
  ): Promise<StoryGraphImportPreviewDto> {
    return this.storyGraphImport.preview(user.sub, dto.csv);
  }

  /** Persist the chosen books as library entries with their reading metadata. */
  @Post("commit")
  commit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StoryGraphCommitDto,
  ): Promise<StoryGraphImportResultDto> {
    return this.storyGraphImport.commit(user.sub, dto.books);
  }
}
