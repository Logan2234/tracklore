/**
 * Return the `n` highest-valued entries of a counter map, sorted descending.
 * Breakdowns are capped so the UI stays legible.
 */
export function topN(counts: Map<string, number>, n = 6): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
