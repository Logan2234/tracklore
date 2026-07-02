import { env } from "$env/dynamic/public";
import type {
  AuthTokensDto,
  EntryEpisodesResponseDto,
  EntryStatus,
  EpisodeWatchDto,
  LibraryEntryDto,
  LoginRequestDto,
  MediaDetailsDto,
  MediaType,
  RegisterRequestDto,
  SearchResponseDto,
  StartTvTimeImportDto,
  TvTimeImportJobDto,
  UpsertLibraryEntryDto,
  UserDto,
} from "@tracklore/shared";
import { auth } from "../auth.svelte";

const API_URL = env.PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set to false for auth endpoints. */
  withAuth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.withAuth !== false && auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Expired access token: try one refresh, then replay the request.
  if (
    response.status === 401 &&
    options.withAuth !== false &&
    !retried &&
    auth.refreshToken
  ) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    auth.clear();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new ApiError(
      response.status,
      message ?? `Request failed (${response.status})`,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const { tokens } = await request<{ tokens: AuthTokensDto }>(
      "/auth/refresh",
      {
        method: "POST",
        body: { refreshToken: auth.refreshToken },
        withAuth: false,
      },
      true,
    );
    auth.setTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

// --- Auth ---

export async function initAuth(): Promise<void> {
  auth.loadTokens();
  if (!auth.accessToken) return;
  try {
    auth.user = await request<UserDto>("/users/me");
  } catch {
    auth.clear();
  }
}

export async function register(body: RegisterRequestDto): Promise<void> {
  const result = await request<{ user: UserDto; tokens: AuthTokensDto }>(
    "/auth/register",
    {
      method: "POST",
      body,
      withAuth: false,
    },
  );
  auth.setTokens(result.tokens);
  auth.user = result.user;
}

export async function login(body: LoginRequestDto): Promise<void> {
  const result = await request<{ user: UserDto; tokens: AuthTokensDto }>(
    "/auth/login",
    {
      method: "POST",
      body,
      withAuth: false,
    },
  );
  auth.setTokens(result.tokens);
  auth.user = result.user;
}

export async function logout(): Promise<void> {
  if (auth.refreshToken) {
    await request("/auth/logout", {
      method: "POST",
      body: { refreshToken: auth.refreshToken },
      withAuth: false,
    }).catch(() => undefined);
  }
  auth.clear();
}

// --- Catalog ---

export function searchCatalog(
  query: string,
  type?: MediaType,
): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  return request(`/catalog/search?${params}`);
}

export function getCatalogDetails(
  source: string,
  sourceId: string,
  type: MediaType,
): Promise<MediaDetailsDto> {
  return request(`/catalog/${source.toLowerCase()}/${sourceId}?type=${type}`);
}

// --- Library ---

export function listLibrary(
  filters: {
    status?: EntryStatus;
    type?: MediaType;
  } = {},
): Promise<LibraryEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/library${suffix}`);
}

export function upsertLibraryEntry(
  body: UpsertLibraryEntryDto,
): Promise<LibraryEntryDto> {
  return request("/library", { method: "PUT", body });
}

export function getLibraryEntry(entryId: string): Promise<LibraryEntryDto> {
  return request(`/library/entries/${entryId}`);
}

export function updateLibraryEntry(
  entryId: string,
  body: Partial<
    Pick<
      LibraryEntryDto,
      "status" | "rating" | "notes" | "favorite" | "archived"
    >
  >,
): Promise<LibraryEntryDto> {
  return request(`/library/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteLibraryEntry(entryId: string): Promise<void> {
  return request(`/library/entries/${entryId}`, { method: "DELETE" });
}

export function getEntryEpisodes(
  entryId: string,
): Promise<EntryEpisodesResponseDto> {
  return request(`/library/entries/${entryId}/episodes`);
}

export function watchEpisode(
  episodeId: string,
  rating?: number,
): Promise<EpisodeWatchDto> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "POST",
    body: rating === undefined ? {} : { rating },
  });
}

// --- TV Time import ---

export function startTvTimeImport(
  body: StartTvTimeImportDto,
): Promise<TvTimeImportJobDto> {
  return request("/import/tvtime", { method: "POST", body });
}

export function getTvTimeImportJob(jobId: string): Promise<TvTimeImportJobDto> {
  return request(`/import/tvtime/${jobId}`);
}
