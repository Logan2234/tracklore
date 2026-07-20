import { getAdminReportsPendingCount } from "$lib/api/client";

/** Pending-report count for the admin "Signalements" nav badge (rune store). */
class AdminReports {
  pending = $state(0);

  async refresh(): Promise<void> {
    try {
      const { count } = await getAdminReportsPendingCount();
      this.pending = count;
    } catch {
      // Best-effort; leave current state on error.
    }
  }
}

export const adminReports = new AdminReports();
