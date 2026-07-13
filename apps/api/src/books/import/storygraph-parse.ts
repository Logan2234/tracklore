import type { BookStatus } from "@tracklore/shared";
import { parseCsv } from "../../import/tvtime/csv";

/** One StoryGraph CSV row reduced to the fields the import needs. */
export interface ParsedStoryGraphRow {
  title: string;
  authors: string[];
  /** ISBN-10/13 when the row carries one (hyphens stripped); null otherwise. */
  isbn: string | null;
  status: BookStatus;
  /** 0–10 (StoryGraph's 0–5 stars doubled); null when unrated. */
  rating: number | null;
  /** The CSV review, kept as the entry's notes; null when empty. */
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// StoryGraph "Read Status" → our library status.
const STATUS_BY_READ_STATUS: Record<string, BookStatus> = {
  read: "READ",
  "to-read": "TO_READ",
  "currently-reading": "READING",
  "did-not-finish": "DROPPED",
};

/**
 * Parse a StoryGraph export CSV into normalised rows. Rows without a title are
 * skipped; an unknown "Read Status" falls back to TO_READ so nothing is lost.
 */
export function parseStoryGraphCsv(text: string): ParsedStoryGraphRow[] {
  return parseCsv(text)
    .filter((record) => (record["Title"] ?? "").trim() !== "")
    .map((record) => {
      const [startedAt, finishedAt] = parseDates(
        record["Dates Read"],
        record["Last Date Read"],
      );
      return {
        title: record["Title"].trim(),
        authors: splitAuthors(record["Authors"]),
        isbn: normaliseIsbn(record["ISBN/UID"]),
        status:
          STATUS_BY_READ_STATUS[(record["Read Status"] ?? "").trim()] ??
          "TO_READ",
        rating: parseRating(record["Star Rating"]),
        notes: emptyToNull(record["Review"]),
        startedAt,
        finishedAt,
      };
    });
}

/** StoryGraph joins multiple authors with ", " inside one quoted field. */
function splitAuthors(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** Keep only a well-formed ISBN-10/13 (hyphens/spaces stripped); else null. */
function normaliseIsbn(value: string | undefined): string | null {
  const cleaned = (value ?? "").replace(/[\s-]/g, "");
  return /^(\d{9}[\dX]|\d{13})$/.test(cleaned) ? cleaned : null;
}

/** StoryGraph rates 0–5 in quarter steps; we store 0–10 in half steps. */
function parseRating(value: string | undefined): number | null {
  const stars = Number((value ?? "").trim());
  return Number.isFinite(stars) && stars > 0 ? stars * 2 : null;
}

/**
 * Derive start/finish dates. "Dates Read" is a "YYYY/MM/DD-YYYY/MM/DD" range
 * (either side may be absent); "Last Date Read" is the fallback finish date.
 */
function parseDates(
  datesRead: string | undefined,
  lastDateRead: string | undefined,
): [string | null, string | null] {
  const range = (datesRead ?? "").trim();
  if (range) {
    const [start, end] = range.split("-");
    return [toIso(start), toIso(end ?? start)];
  }
  return [null, toIso(lastDateRead)];
}

/** "YYYY/MM/DD" → an ISO timestamp at UTC midnight; invalid input → null. */
function toIso(value: string | undefined): string | null {
  const match = (value ?? "").trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}
