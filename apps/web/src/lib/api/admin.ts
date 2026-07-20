import type {
  AdminBackupDto,
  AdminBackupRestoreRequestDto,
  AdminCacheDeleteOrphansResultDto,
  AdminCacheItemDetailDto,
  AdminCacheListResponseDto,
  AdminCacheResyncStaleResultDto,
  AdminCacheSort,
  AdminImportRunListResponseDto,
  AdminPushBroadcastResponseDto,
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminStatsDto,
  AdminTrendsDto,
  AdminUserDto,
  AdminUserRoleDto,
  AdminVersionDto,
  Domain,
  JobListResponseDto,
  JobStatus,
  ReportPageDto,
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  Role,
  SchemaGraphResponseDto,
  SecurityEventListResponseDto,
  SecurityEventType,
  SendAdminBroadcastPushRequestDto,
  SendAdminTestPushRequestDto,
  SendTestEmailRequestDto,
  ServiceStatusResponseDto,
  SessionDto,
  TrendPeriod,
  UserDataExportDto,
} from "@tracklore/shared";
import { request } from "./core";

/** Health and quota usage of every external dependency (config presence, live probe, call counters). */
export function getAdminServices(): Promise<ServiceStatusResponseDto> {
  return request("/admin/services");
}

export function getAdminEmailTemplates(): Promise<MailTemplateListResponseDto> {
  return request("/admin/emails");
}

export function getAdminEmailPreview(
  key: string,
  values: Record<string, string> = {},
): Promise<MailTemplatePreviewDto> {
  const params = new URLSearchParams(values);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/emails/${key}/preview${suffix}`);
}

export function sendAdminTestEmail(
  key: string,
  body: SendTestEmailRequestDto,
): Promise<void> {
  return request(`/admin/emails/${key}/test`, { method: "POST", body });
}

export function sendAdminTestPush(
  body: SendAdminTestPushRequestDto,
): Promise<AdminPushSendResponseDto> {
  return request("/admin/push/test", { method: "POST", body });
}

export function getAdminPushDevices(
  email: string,
): Promise<AdminPushDeviceDto[]> {
  const params = new URLSearchParams({ email });
  return request(`/admin/push/devices?${params}`);
}

/** Sends one push to every subscribed device on the instance, across every account. */
export function sendAdminBroadcastPush(
  body: SendAdminBroadcastPushRequestDto,
): Promise<AdminPushBroadcastResponseDto> {
  return request("/admin/push/broadcast", { method: "POST", body });
}

/** Locally-generated architecture diagrams (DB ERD, module graph). */
export function getAdminSchema(): Promise<SchemaGraphResponseDto> {
  return request("/admin/schema");
}

/** Instance-wide dashboard: cross-account aggregates, distinct from the per-user /stats page. */
export function getAdminStats(): Promise<AdminStatsDto> {
  return request("/admin/stats");
}

/** Trend series at a chosen granularity, to re-query the évolution charts. */
export function getAdminTrends(period: TrendPeriod): Promise<AdminTrendsDto> {
  return request(`/admin/stats/trends?period=${period}`);
}

/** Every known scheduled job, with its recent run history. */
export function getAdminJobs(): Promise<JobListResponseDto> {
  return request("/admin/jobs");
}

/** Triggers a job immediately (both are idempotent). */
export function runAdminJob(key: string): Promise<void> {
  return request(`/admin/jobs/${key}/run`, { method: "POST" });
}

export function getAdminUsers(): Promise<AdminUserDto[]> {
  return request("/admin/users");
}

export function getAdminUserSessions(userId: string): Promise<SessionDto[]> {
  return request(`/admin/users/${userId}/sessions`);
}

export function revokeAdminUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  return request(`/admin/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

/** Revokes every device for an account in one go. */
export function revokeAllAdminUserSessions(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/sessions`, { method: "DELETE" });
}

/** Sets an account's role (e.g. toggling admin access). */
export function updateAdminUserRole(
  userId: string,
  role: Role,
): Promise<AdminUserRoleDto> {
  return request(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

/** Full portable dump of one account's data (GDPR "download my data"), admin-triggered. */
export function getAdminUserExport(userId: string): Promise<UserDataExportDto> {
  return request(`/admin/users/${userId}/export`);
}

/** Re-sends the account's email-verification link. */
export function resendAdminUserVerification(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/resend-verification`, {
    method: "POST",
  });
}

/** Sends the account a password-reset link. */
export function sendAdminUserPasswordReset(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/reset-password-link`, {
    method: "POST",
  });
}

/** Permanently deletes an account and all its data. Irreversible. */
export function deleteAdminUser(userId: string): Promise<void> {
  return request(`/admin/users/${userId}`, { method: "DELETE" });
}

/** The running app's version, shown in the admin/settings footer. */
export function getAdminVersion(): Promise<AdminVersionDto> {
  return request("/admin/version");
}

/** Full plain-SQL dump of the instance database (pg_dump). */
export function getAdminBackup(): Promise<AdminBackupDto> {
  return request("/admin/backup");
}

/** Replaces the entire instance database with a previously downloaded dump. Irreversible. */
export function restoreAdminBackup(
  body: AdminBackupRestoreRequestDto,
): Promise<void> {
  return request("/admin/backup/restore", { method: "POST", body });
}

/** Cached items for one domain, ordered by `sort`, filterable by title/orphans and paginated. */
export function getAdminCache(filters: {
  domain: Domain;
  search?: string;
  sort?: AdminCacheSort;
  orphans?: boolean;
  page?: number;
}): Promise<AdminCacheListResponseDto> {
  const params = new URLSearchParams({ domain: filters.domain });
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.orphans) params.set("orphans", "true");
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  return request(`/admin/cache?${params}`);
}

/** Full detail of one cached item (external ids, metadata, media seasons). */
export function getAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<AdminCacheItemDetailDto> {
  return request(`/admin/cache/${domain}/${id}`);
}

/** Forces a re-sync of one cached item from its canonical source, bypassing the TTL. */
export function resyncAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<void> {
  return request(`/admin/cache/${domain}/${id}/resync`, { method: "POST" });
}

/** Re-syncs every stale (>24h) item in a domain in one pass. */
export function resyncAdminCacheStale(
  domain: Domain,
): Promise<AdminCacheResyncStaleResultDto> {
  return request(`/admin/cache/${domain}/resync-stale`, { method: "POST" });
}

/** Deletes an orphaned cached item (no account references it). 409 if referenced. */
export function deleteAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<void> {
  return request(`/admin/cache/${domain}/${id}`, { method: "DELETE" });
}

/** Purges every orphaned (unreferenced) item in a domain in one pass. */
export function deleteAdminCacheOrphans(
  domain: Domain,
): Promise<AdminCacheDeleteOrphansResultDto> {
  return request(`/admin/cache/${domain}/orphans`, { method: "DELETE" });
}

/** Past import commits across every account, filterable by source/status/account, paginated. */
export function getAdminImportRuns(
  filters: {
    source?: string;
    status?: JobStatus;
    userId?: string;
    page?: number;
  } = {},
): Promise<AdminImportRunListResponseDto> {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/imports${suffix}`);
}

/** Sensitive account actions, filterable by type and identifier, paginated. */
export function getAdminSecurityEvents(
  filters: {
    type?: SecurityEventType;
    identifier?: string;
    page?: number;
  } = {},
): Promise<SecurityEventListResponseDto> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.identifier) params.set("identifier", filters.identifier);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/security${suffix}`);
}

/** The comment/review/user moderation queue, filterable by status, cursor-paginated. */
export function getAdminReports(
  filters: { status?: string; cursor?: string } = {},
): Promise<ReportPageDto> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.cursor) params.set("cursor", filters.cursor);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/reports${suffix}`);
}

export function getAdminReportsPendingCount(): Promise<{ count: number }> {
  return request("/admin/reports/pending-count");
}

export function resolveAdminReport(
  id: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<void> {
  return request(`/admin/reports/${id}/resolve`, {
    method: "POST",
    body: { status },
  });
}
