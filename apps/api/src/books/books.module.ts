import { Module } from "@nestjs/common";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { BooksController } from "./books.controller";
import { StoryGraphImportController } from "./import/storygraph-import.controller";
import { StoryGraphImportService } from "./import/storygraph-import.service";
import { GoogleBooksProvider } from "./providers/google-books.provider";
import { OpenLibraryProvider } from "./providers/openlibrary.provider";

@Module({
  controllers: [BooksController, StoryGraphImportController],
  providers: [
    BookItemService,
    BookLibraryService,
    GoogleBooksProvider,
    OpenLibraryProvider,
    StoryGraphImportService,
  ],
})
export class BooksModule {}
