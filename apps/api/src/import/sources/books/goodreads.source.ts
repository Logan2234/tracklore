import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AgeGateService } from "../../../users/age-gate.service";
import { BookItemService } from "../../../books/book-item.service";
import { BookCsvSource } from "./book-csv.source";
import { parseGoodreadsCsv, type ParsedGoodreadsRow } from "./goodreads-parse";

/**
 * Goodreads CSV import. Only the CSV parsing is source-specific; the
 * resolve/plan/commit mechanics live in {@link BookCsvSource}.
 */
@Injectable()
export class GoodreadsImportSource extends BookCsvSource<ParsedGoodreadsRow> {
  readonly id = "goodreads";

  constructor(
    prisma: PrismaService,
    bookItemService: BookItemService,
    ageGate: AgeGateService,
  ) {
    super(prisma, bookItemService, ageGate);
  }

  protected parseCsv(csv: string): ParsedGoodreadsRow[] {
    return parseGoodreadsCsv(csv);
  }
}
