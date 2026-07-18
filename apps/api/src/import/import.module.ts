import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { IMPORT_SOURCES } from "./import-source";
import { ImportController } from "./import.controller";
import { ImportJobService } from "./import-job.service";
import { TvTimeImportSource } from "./sources/tvtime/tvtime.source";

/**
 * The generic import framework: one controller + one async job engine, with a
 * pluggable {@link ImportSource} per source collected under {@link IMPORT_SOURCES}.
 *
 * Reuses MediaItemService (on-demand cache) and TmdbProvider (TVDB
 * reconciliation) from CatalogModule; PrismaService comes from the global
 * PrismaModule. Book/game sources and their modules are added as they migrate.
 */
@Module({
  imports: [CatalogModule],
  controllers: [ImportController],
  providers: [
    ImportJobService,
    TvTimeImportSource,
    {
      provide: IMPORT_SOURCES,
      useFactory: (tvtime: TvTimeImportSource) => [tvtime],
      inject: [TvTimeImportSource],
    },
  ],
})
export class ImportModule {}
