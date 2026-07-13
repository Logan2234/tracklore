import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";
import { GamesController } from "./games.controller";
import { SteamImportController } from "./import/steam-import.controller";
import { SteamImportService } from "./import/steam-import.service";
import { IgdbProvider } from "./providers/igdb.provider";

@Module({
  imports: [UsersModule],
  controllers: [GamesController, SteamImportController],
  providers: [
    GameItemService,
    GameLibraryService,
    IgdbProvider,
    SteamImportService,
  ],
})
export class GamesModule {}
