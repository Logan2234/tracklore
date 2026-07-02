import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { TvTimeImportJobDto } from "@tracklore/shared";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { StartImportDto } from "./dto/start-import.dto";
import { ImportService } from "./import.service";

@Controller("import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /** Start a (possibly dry-run) import; returns immediately with a pending job. */
  @Post("/tvtime")
  start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartImportDto,
  ): TvTimeImportJobDto {
    return this.importService.startImport(user.sub, dto);
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
