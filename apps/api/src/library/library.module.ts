import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { UsersModule } from "../users/users.module";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
import { MediaController } from "./media.controller";

@Module({
  imports: [CatalogModule, UsersModule],
  controllers: [LibraryController, MediaController],
  providers: [LibraryService],
})
export class LibraryModule {}
