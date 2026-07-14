import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { BooksController } from "./books.controller";
import { GoodreadsImportController } from "./import/goodreads-import.controller";
import { GoodreadsImportService } from "./import/goodreads-import.service";
import { StoryGraphImportController } from "./import/storygraph-import.controller";
import { StoryGraphImportService } from "./import/storygraph-import.service";
import { GoogleBooksProvider } from "./providers/google-books.provider";

@Module({
  imports: [UsersModule],
  controllers: [
    BooksController,
    StoryGraphImportController,
    GoodreadsImportController,
  ],
  providers: [
    BookItemService,
    BookLibraryService,
    GoogleBooksProvider,
    StoryGraphImportService,
    GoodreadsImportService,
  ],
})
export class BooksModule {}
