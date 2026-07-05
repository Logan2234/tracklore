import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { TvTimeImportJobDto } from "@tracklore/shared";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { CommitImportDto } from "./dto/commit-import.dto";
import { StartImportDto } from "./dto/start-import.dto";
import { ImportService } from "./import.service";

@Controller("import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Analyse an export and build a reconciliation plan (writes nothing).
   * Returns a pending job; poll `/tvtime/:jobId` for the plan.
   */
  @Post("/tvtime/analyze")
  analyze(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartImportDto,
  ): TvTimeImportJobDto {
    return this.importService.startAnalyze(user.sub, dto);
  }

  /** Commit an analysed import with the user's reconciliation decisions. */
  @Post("/tvtime/:jobId/commit")
  commit(
    @CurrentUser() user: JwtPayload,
    @Param("jobId") jobId: string,
    @Body() dto: CommitImportDto,
  ): TvTimeImportJobDto {
    return this.importService.commit(user.sub, jobId, dto);
  }

  /** Poll progress and, once finished, the report. */
  @Get("/tvtime/:jobId")
  status(
    @CurrentUser() user: JwtPayload,
    @Param("jobId") jobId: string,
  ): TvTimeImportJobDto {
    return this.importService.getJob(user.sub, jobId);
  }
}
