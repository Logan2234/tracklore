import type {
  AdminBackupDto,
  AdminBackupRestoreRequestDto,
  AdminPushBroadcastResponseDto,
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminStatsDto,
  AdminTrendsDto,
  AdminUserDto,
  AdminUserRoleDto,
  AdminVersionDto,
  JobListResponseDto,
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

/** Health of every external dependency (config presence + live probe). */
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

/** The running app's version, shown in the admin/account footer. */
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
