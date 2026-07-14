import { Body, Controller, Post } from "@nestjs/common";
import type {
  GoodreadsImportPreviewDto,
  GoodreadsImportResultDto,
} from "@tracklore/shared";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import {
  GoodreadsCommitDto,
  GoodreadsPreviewDto,
} from "./dto/goodreads-import.dto";
import { GoodreadsImportService } from "./goodreads-import.service";

@Controller("books/import/goodreads")
export class GoodreadsImportController {
  constructor(private readonly goodreadsImport: GoodreadsImportService) {}

  /** Parse + resolve a Goodreads CSV against Google Books. Writes nothing. */
  @Post("preview")
  preview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GoodreadsPreviewDto,
  ): Promise<GoodreadsImportPreviewDto> {
    return this.goodreadsImport.preview(user.sub, dto.csv);
  }

  /** Persist the chosen books as library entries with their reading metadata. */
  @Post("commit")
  commit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GoodreadsCommitDto,
  ): Promise<GoodreadsImportResultDto> {
    return this.goodreadsImport.commit(user.sub, dto.books);
  }
}
