// Field parsers shared by the CSV book importers (Goodreads, StoryGraph, …).
// Only source-agnostic fields belong here — ownership stays per-source because
// each export encodes it differently.

/** A source's "Read Count" — total completions; 0 (unread) on bad input. */
export function parseReadCount(value: string | undefined): number {
  const count = Number((value ?? "").trim());
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

/**
 * Both Goodreads and StoryGraph rate on a 0–5 star scale (0 = unrated); we
 * store 0–10, so a rating is doubled. Null when unrated or unparseable.
 */
export function parseStarRatingToTen(value: string | undefined): number | null {
  const stars = Number((value ?? "").trim());
  return Number.isFinite(stars) && stars > 0 ? stars * 2 : null;
}
