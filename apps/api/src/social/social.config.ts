import { ConfigService } from "@nestjs/config";

/**
 * Whether the P4 social features are enabled on this deployment. Driven by the
 * runtime `SOCIAL_ENABLED` env var so a single Docker image serves both modes:
 * self-host = off (no social surface), the hosted build sets it to "true".
 * Off by default (anything other than the literal "true").
 *
 * Single source of truth: the web reads it via `GET /api/config`, and the
 * social endpoints (from the social module, P4 increment 1+) gate on it too.
 */
export function isSocialEnabled(config: ConfigService): boolean {
  return config.get<string>("SOCIAL_ENABLED") === "true";
}
