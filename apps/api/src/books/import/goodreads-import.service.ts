import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AgeGateService } from "../../users/age-gate.service";
import { BookItemService } from "../book-item.service";
import { BookCsvImportService } from "./book-csv-import.service";
import { parseGoodreadsCsv } from "./goodreads-parse";
import type { ParsedGoodreadsRow } from "./goodreads-parse";

/**
 * Goodreads CSV import. Only the CSV parsing is source-specific; the
 * preview/commit mechanics live in {@link BookCsvImportService}.
 */
@Injectable()
export class GoodreadsImportService extends BookCsvImportService<ParsedGoodreadsRow> {
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
