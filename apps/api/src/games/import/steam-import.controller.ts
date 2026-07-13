import { Body, Controller, Post } from "@nestjs/common";
import type {
  SteamImportPreviewDto,
  SteamImportResultDto,
} from "@tracklore/shared";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { SteamCommitDto, SteamPreviewDto } from "./dto/steam-import.dto";
import { SteamImportService } from "./steam-import.service";

@Controller("games/import/steam")
export class SteamImportController {
  constructor(private readonly steamImport: SteamImportService) {}

  /** Resolve + match a Steam library against IGDB. Writes nothing. */
  @Post("preview")
  preview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SteamPreviewDto,
  ): Promise<SteamImportPreviewDto> {
    return this.steamImport.preview(user.sub, dto.steamId);
  }

  /** Persist the chosen games as library entries with status + playtime. */
  @Post("commit")
  commit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SteamCommitDto,
  ): Promise<SteamImportResultDto> {
    return this.steamImport.commit(user.sub, dto.games);
  }
}
