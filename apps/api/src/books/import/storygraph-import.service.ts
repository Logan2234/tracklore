import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AgeGateService } from "../../users/age-gate.service";
import { BookItemService } from "../book-item.service";
import { BookCsvImportService } from "./book-csv-import.service";
import { parseStoryGraphCsv } from "./storygraph-parse";
import type { ParsedStoryGraphRow } from "./storygraph-parse";

/**
 * StoryGraph CSV import. Only the CSV parsing is source-specific; the
 * preview/commit mechanics live in {@link BookCsvImportService}.
 */
@Injectable()
export class StoryGraphImportService extends BookCsvImportService<ParsedStoryGraphRow> {
  constructor(
    prisma: PrismaService,
    bookItemService: BookItemService,
    ageGate: AgeGateService,
  ) {
    super(prisma, bookItemService, ageGate);
  }

  protected parseCsv(csv: string): ParsedStoryGraphRow[] {
    return parseStoryGraphCsv(csv);
  }
}
