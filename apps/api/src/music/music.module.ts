import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { MusicController } from "./music.controller";
import { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";
import { MusicBrainzProvider } from "./providers/musicbrainz.provider";

@Module({
  imports: [UsersModule],
  controllers: [MusicController],
  providers: [MusicItemService, MusicLibraryService, MusicBrainzProvider],
  exports: [MusicItemService],
})
export class MusicModule {}
