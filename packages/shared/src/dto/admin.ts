/** Which app area a dependency powers, for grouping in the admin status page. */
export type ServiceArea = "Écrans" | "Jeux" | "Livres" | "Système";

/** Health of one external dependency, as surfaced by the admin services page. */
export interface ServiceStatusDto {
  /** Stable identifier, e.g. "tmdb". */
  key: string;
  /** Human label, e.g. "TMDB". */
  label: string;
  area: ServiceArea;
  /**
   * Whether the app hard-fails for its area without this service. `false` for
   * optional enrichers (OMDb ratings) and keyless fallbacks (AniList).
   */
  required: boolean;
  /** Its API key/credentials are present in the environment. */
  configured: boolean;
  /**
   * Live probe result: `true`/`false` when probed, `null` when not probed
   * (unconfigured, or nothing cheap to ping).
   */
  reachable: boolean | null;
  /** Short human note (missing key, HTTP status, error reason…). */
  detail?: string;
}

export interface ServiceStatusResponseDto {
  services: ServiceStatusDto[];
  /** When the probes ran (ISO 8601). */
  checkedAt: string;
}

/** One entry in the admin email-template gallery. */
export interface MailTemplateInfoDto {
  key: string;
  label: string;
}

export interface MailTemplateListResponseDto {
  templates: MailTemplateInfoDto[];
  /** Whether SMTP is configured — test-send is disabled otherwise. */
  smtpConfigured: boolean;
}

/** Rendered preview of one template (with fixed sample data), never sent. */
export interface MailTemplatePreviewDto {
  subject: string;
  html: string;
}

export interface SendTestEmailRequestDto {
  to: string;
}

/** Which registered account to target when sending an admin test push. */
export interface SendAdminTestPushRequestDto {
  email: string;
}
