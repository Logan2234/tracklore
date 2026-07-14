import type { BookOwnershipStatus, BookStatus } from "@tracklore/shared";
import { parseCsv } from "../../import/tvtime/csv";

/** One Goodreads CSV row reduced to the fields the import needs. */
export interface ParsedGoodreadsRow {
  title: string;
  authors: string[];
  /** ISBN-10/13 when the row carries one; null otherwise. */
  isbn: string | null;
  status: BookStatus;
  /** 0–10 (Goodreads' 0–5 stars doubled); null when unrated (0). */
  rating: number | null;
  /** The CSV "My Review", kept as the entry's notes; null when empty. */
  notes: string | null;
  /** Goodreads' export has no "date started" column. */
  startedAt: null;
  finishedAt: string | null;
  /** Derived from "Owned Copies" + "Binding"; NONE when not owned. */
  ownershipStatus: BookOwnershipStatus;
  /** Goodreads "Read Count" — total completions, including the first. */
  readCount: number;
}

// Goodreads' default shelves; a custom shelf falls back to TO_READ.
const STATUS_BY_SHELF: Record<string, BookStatus> = {
  read: "READ",
  "to-read": "TO_READ",
  "currently-reading": "READING",
};

/**
 * Parse a Goodreads library export CSV into normalised rows. Rows without a
 * title are skipped; an unknown "Exclusive Shelf" falls back to TO_READ so
 * nothing is lost.
 */
export function parseGoodreadsCsv(text: string): ParsedGoodreadsRow[] {
  return parseCsv(text)
    .filter((record) => (record["Title"] ?? "").trim() !== "")
    .map((record) => ({
      title: record["Title"].trim(),
      authors: splitAuthors(record["Author"], record["Additional Authors"]),
      isbn: normaliseIsbn(record["ISBN13"]) ?? normaliseIsbn(record["ISBN"]),
      status:
        STATUS_BY_SHELF[(record["Exclusive Shelf"] ?? "").trim()] ??
        "TO_READ",
      rating: parseRating(record["My Rating"]),
      notes: emptyToNull(record["My Review"]),
      startedAt: null,
      finishedAt: toIso(record["Date Read"]),
      ownershipStatus: parseOwnership(
        record["Owned Copies"],
        record["Binding"],
      ),
      readCount: parseReadCount(record["Read Count"]),
    }));
}

/**
 * "Owned Copies" is the only reliable owned/not-owned signal Goodreads
 * exports (most users never touch it, so 0 does NOT imply "borrowed" the way
 * StoryGraph's explicit "Owned?" field does — it just means "unknown").
 * "Binding" (paperback/hardcover/Kindle Edition/Audiobook…) picks the shape
 * once we know a copy is owned.
 */
function parseOwnership(
  ownedCopies: string | undefined,
  binding: string | undefined,
): BookOwnershipStatus {
  const owned = Number((ownedCopies ?? "").trim());
  if (!Number.isFinite(owned) || owned <= 0) return "NONE";

  const value = (binding ?? "").trim().toLowerCase();
  if (value.includes("audio")) return "AUDIO";
  if (value.includes("kindle") || value.includes("ebook")) return "DIGITAL";
  if (value.includes("paperback") || value.includes("hardcover")) {
    return "PHYSICAL";
  }

  return "NONE";
}

/** Defaults to 0 (unread) on anything unparseable. */
function parseReadCount(value: string | undefined): number {
  const count = Number((value ?? "").trim());
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

/** Goodreads splits "Author" (primary) from "Additional Authors" (", "-joined). */
function splitAuthors(
  primary: string | undefined,
  additional: string | undefined,
): string[] {
  const names = [
    ...(primary ? [primary] : []),
    ...(additional ? additional.split(",") : []),
  ]
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return Array.from(new Set(names));
}

/**
 * Goodreads wraps ISBN/ISBN13 as `="9780261102217"` (an Excel text-formula
 * escape, to stop Excel from stripping leading zeros / going numeric). Strip
 * the leading `=` and quotes, then keep only a well-formed ISBN-10/13.
 */
function normaliseIsbn(value: string | undefined): string | null {
  const cleaned = (value ?? "").replace(/^=/, "").replace(/["\s-]/g, "");
  return /^(\d{9}[\dX]|\d{13})$/.test(cleaned) ? cleaned : null;
}

/** Goodreads rates 0–5 in whole steps (0 = unrated); we store 0–10. */
function parseRating(value: string | undefined): number | null {
  const stars = Number((value ?? "").trim());
  return Number.isFinite(stars) && stars > 0 ? stars * 2 : null;
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
