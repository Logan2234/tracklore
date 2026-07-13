import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
} from "@nestjs/common";
import {
  BookDetailDto,
  BookEntryDto,
  BookSearchResponseDto,
  BookSource,
  BookStatsDto,
  BookStatus,
  Domain,
} from "@tracklore/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { DomainGateService } from "../users/domain-gate.service";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";

@Controller("books")
export class BooksController {
  constructor(
    private readonly bookItemService: BookItemService,
    private readonly bookLibraryService: BookLibraryService,
    private readonly domainGate: DomainGateService,
  ) {}

  /** Live catalogue search (Google Books, falling back to Open Library). */
  @Get("search")
  async search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
  ): Promise<BookSearchResponseDto> {
    const query = q?.trim();

    if (!query) {
      throw new BadRequestException("Query 'q' is required");
    }

    await this.domainGate.assertEnabled(user.sub, Domain.BOOKS);

    const results = await this.bookItemService.search(query);
    return { results };
  }

  @Get("stats")
  async getStats(@CurrentUser() user: JwtPayload): Promise<BookStatsDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.BOOKS);
    return this.bookLibraryService.getStats(user.sub);
  }

  @Get()
  listEntries(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: BookStatus,
  ): Promise<BookEntryDto[]> {
    return this.bookLibraryService.listEntries(user.sub, { status });
  }

  @Put()
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertBookEntryDto,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateBookEntryDto,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.updateEntry(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.bookLibraryService.deleteEntry(user.sub, entryId);
  }

  /** Book detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  getBookDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<BookDetailDto> {
    return this.bookLibraryService.getBookDetail(
      user.sub,
      parseBookSource(sourceParam),
      sourceId,
    );
  }
}

function parseBookSource(value: string): BookSource {
  const upper = value.toUpperCase();

  if (upper !== BookSource.OPENLIBRARY && upper !== BookSource.GOOGLE_BOOKS) {
    throw new BadRequestException(`Unknown book source '${value}'`);
  }

  return upper;
}
