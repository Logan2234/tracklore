import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { BooksController } from "./books.controller";
import { GoogleBooksProvider } from "./providers/google-books.provider";

// Import flows live in the generic ImportModule (its book sources reuse
// BookItemService, hence the export).
@Module({
  imports: [UsersModule],
  controllers: [BooksController],
  providers: [BookItemService, BookLibraryService, GoogleBooksProvider],
  exports: [BookItemService],
})
export class BooksModule {}
