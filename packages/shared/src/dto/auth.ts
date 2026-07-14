import type { Domain } from "../enums";

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequestDto {
  /** Email or username. */
  identifier: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  /** Unique login handle (alongside email). */
  username: string;
  /** Free-form label shown around the app; not unique. */
  displayName: string;
  /** ISO date (YYYY-MM-DD), null if the user hasn't provided one. */
  birthDate: string | null;
  /** Opt-in to seeing 18+ titles; only effective when birthDate proves the account is 18+. */
  allowAdultContent: boolean;
  /** In-app notifications (new episode alerts) — the only channel actually delivered today. */
  notifyInApp: boolean;
  /** Captured for when email delivery exists; not sent yet. */
  notifyEmail: boolean;
  /** Captured for when push delivery exists (P2 roadmap); not sent yet. */
  notifyPush: boolean;
  /** Open-core seam: feature flags granted to this user (empty in self-host MVP). */
  entitlements: string[];
  /**
   * Content domains the user keeps visible (defaults to all). Drives the nav
   * today; edited from the settings "Domaines" section. See `Domain`.
   */
  enabledDomains: Domain[];
  /** ISO datetime the account was created — shown as "member since". */
  createdAt: string;
}

export interface UpdateUserRequestDto {
  displayName?: string;
  /** ISO date (YYYY-MM-DD); pass null to clear it. */
  birthDate?: string | null;
  allowAdultContent?: boolean;
  notifyInApp?: boolean;
  notifyEmail?: boolean;
  notifyPush?: boolean;
  /** Content domains to keep visible; must list at least one. See `Domain`. */
  enabledDomains?: Domain[];
}

export interface UpdateUsernameRequestDto {
  /** Must be unique account-wide. */
  username: string;
}

export interface UsernameAvailabilityDto {
  available: boolean;
}

export interface ChangeEmailRequestDto {
  newEmail: string;
  currentPassword: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequestDto {
  /** Re-confirmed before wiping the account and all its data. */
  currentPassword: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ForgotPasswordResponseDto {
  /**
   * The raw reset token, handed back directly since there is no email
   * delivery (self-hosted, single-user). Null when no account matches the
   * email, without otherwise distinguishing the response.
   */
  token: string | null;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

/** One active refresh-token session, i.e. one signed-in device. */
export interface SessionDto {
  id: string;
  /**
   * Refresh-JWT id. Not a secret (a random UUID); the client compares it to its
   * own token's `jti` to flag which session is the current device.
   */
  jti: string;
  /** Raw User-Agent captured at sign-in (device label); null if unknown. */
  userAgent: string | null;
  /** ISO datetime the session started (survives token rotation). */
  createdAt: string;
  /** ISO datetime of the last refresh — the session's last activity. */
  lastUsedAt: string;
}
