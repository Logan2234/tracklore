/**
 * Normalizes a query param that arrives as a single string (one occurrence)
 * or a string array (repeated key, e.g. `?status=A&status=B`) into an array.
 */
export function toQueryArray(value?: string | string[]): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
