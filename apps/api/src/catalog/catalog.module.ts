import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { MediaItemService } from "./media-item.service";
import { AnilistProvider } from "./providers/anilist.provider";
import { TmdbProvider } from "./providers/tmdb.provider";

@Module({
  controllers: [CatalogController],
  providers: [MediaItemService, TmdbProvider, AnilistProvider],
  // TmdbProvider is exported for the TV Time import (TVDB → TMDB reconciliation).
  exports: [MediaItemService, TmdbProvider],
})
export class CatalogModule {}
