import { Module } from "@nestjs/common";
import { CatalogModule } from "../../catalog/catalog.module";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { TvTimeImportSource } from "./tvtime.source";

// Reuses MediaItemService (on-demand cache) and TmdbProvider (TVDB reconciliation)
// from CatalogModule; PrismaService comes from the global PrismaModule.
@Module({
  imports: [CatalogModule],
  controllers: [ImportController],
  providers: [ImportService, TvTimeImportSource],
})
export class ImportModule {}
