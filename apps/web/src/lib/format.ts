// Shared formatting helpers for UI display (French locale).

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Formats an ISO date string as e.g. "3 janv. 2026". */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
