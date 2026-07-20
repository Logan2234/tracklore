import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { IMPORT_SOURCES, type ImportSource } from "./import-source";
import { ImportController } from "./import.controller";
import { ImportJobService } from "./import-job.service";
import { GoodreadsImportSource } from "./sources/books/goodreads.source";
import { StoryGraphImportSource } from "./sources/books/storygraph.source";
import { SteamImportSource } from "./sources/steam/steam.source";
import { TvTimeImportSource } from "./sources/tvtime/tvtime.source";

/**
 * The generic import framework: one controller + one async job engine, with a
 * pluggable {@link ImportSource} per source collected under {@link IMPORT_SOURCES}.
 *
 * Reuses services from the domain modules: CatalogModule (media),
 * BooksModule (BookItemService), GamesModule (GameItemService + IgdbProvider)
 * and UsersModule (AgeGateService). PrismaService/ConfigService are global.
 */
@Module({
  imports: [
    CatalogModule,
    BooksModule,
    GamesModule,
    UsersModule,
    ReviewsModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportJobService,
    TvTimeImportSource,
    StoryGraphImportSource,
    GoodreadsImportSource,
    SteamImportSource,
    {
      provide: IMPORT_SOURCES,
      useFactory: (...sources: ImportSource[]) => sources,
      inject: [
        TvTimeImportSource,
        StoryGraphImportSource,
        GoodreadsImportSource,
        SteamImportSource,
      ],
    },
  ],
})
export class ImportModule {}
