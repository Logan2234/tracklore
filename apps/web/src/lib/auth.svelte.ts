import { browser } from "$app/environment";
import type { AuthTokensDto, UserDto } from "@tracklore/shared";

const STORAGE_KEY = "tracklore.tokens";

/** Global auth state (Svelte 5 runes). Tokens persist in localStorage. */
class AuthState {
  user = $state<UserDto | null>(null);
  accessToken = $state<string | null>(null);
  refreshToken = $state<string | null>(null);

  get isLoggedIn(): boolean {
    return this.user !== null;
  }

  loadTokens(): void {
    if (!browser) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const tokens = JSON.parse(raw) as AuthTokensDto;
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  setTokens(tokens: AuthTokensDto): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  }

  clear(): void {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const auth = new AuthState();
