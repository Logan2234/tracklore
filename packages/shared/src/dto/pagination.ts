/** A page of results, plus enough metadata to drive infinite scroll. */
export interface PagedResult<T> {
  items: T[];
  /** Total items matching the current filters, across all pages. */
  total: number;
  /** Whether a further page exists beyond this one. */
  hasMore: boolean;
}
