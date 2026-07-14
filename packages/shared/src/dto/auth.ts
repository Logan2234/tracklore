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
  /** In-app notifications (new episode alerts). */
  notifyInApp: boolean;
  /** Email delivery for new episode alerts. */
  notifyEmail: boolean;
  /** Web Push delivery for new episode alerts. */
  notifyPush: boolean;
  /** Whether the account's email has been confirmed via the verification link (informational only). */
  emailVerified: boolean;
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

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequestDto {
  token: string;
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
