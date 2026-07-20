/**
 * Global runtime config (Svelte 5 runes), loaded once at startup from
 * `GET /api/config` (see initConfig in api/config.ts). Drives which optional
 * surfaces the app renders. Defaults to social OFF so nothing social shows
 * until the deployment confirms it's enabled.
 */
class AppConfig {
  socialEnabled = $state(false);
}

export const appConfig = new AppConfig();
