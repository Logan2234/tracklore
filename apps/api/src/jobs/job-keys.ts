/** Stable identifiers for the app's scheduled jobs, shared by their owning service and the admin registry. */
export const JOB_KEYS = {
  NOTIFICATIONS_SCAN: "notifications.scan",
  MEDIA_REFRESH_STALE: "media.refreshStale",
} as const;

export type JobKey = (typeof JOB_KEYS)[keyof typeof JOB_KEYS];

/** Display metadata for the admin "Jobs & tâches" page. */
export const JOB_REGISTRY: Record<JobKey, { label: string; schedule: string }> =
  {
    [JOB_KEYS.NOTIFICATIONS_SCAN]: {
      label: "Scan des notifications",
      schedule: "Toutes les heures",
    },
    [JOB_KEYS.MEDIA_REFRESH_STALE]: {
      label: "Rafraîchissement du cache média",
      schedule: "Toutes les 6 heures",
    },
  };
