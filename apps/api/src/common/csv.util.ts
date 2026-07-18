/** RFC 4180 CSV serialization: quotes any field containing a comma, quote or
 * newline, doubling embedded quotes. Rows are joined with CRLF per the spec. */
export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

function csvField(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
