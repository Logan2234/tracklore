import { env } from "$env/dynamic/public";
import type {
  AuthTokensDto,
  BookDetailDto,
  BookEntryDto,
  BookSearchResponseDto,
  BookStatsDto,
  BookStatus,
  GoodreadsImportCommitRequestDto,
  GoodreadsImportPreviewDto,
  GoodreadsImportPreviewRequestDto,
  GoodreadsImportResultDto,
  StoryGraphImportCommitRequestDto,
  StoryGraphImportPreviewDto,
  StoryGraphImportPreviewRequestDto,
  StoryGraphImportResultDto,
  UpdateBookEntryDto,
  UpsertBookEntryDto,
  CalendarEntryDto,
  CastDetailDto,
  ChangeEmailRequestDto,
  ChangePasswordRequestDto,
  ConfirmEmailChangeRequestDto,
  DeleteAccountRequestDto,
  EntryStatus,
  EpisodeWatchDto,
  GameDetailDto,
  GameEntryDto,
  GameSearchResponseDto,
  GameStatsDto,
  GameStatus,
  SteamImportCommitRequestDto,
  SteamImportPreviewDto,
  SteamImportPreviewRequestDto,
  SteamImportResultDto,
  ImportCommitRequest,
  LibraryEntryDto,
  LoginRequestDto,
  MediaDetailDto,
  MediaDetailsDto,
  MediaExtrasDto,
  MediaType,
  NotificationFeedDto,
  PushPublicKeyDto,
  PushSubscriptionRequestDto,
  RegisterRequestDto,
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminUserDto,
  AdminStatsDto,
  AdminTrendsDto,
  TrendPeriod,
  JobListResponseDto,
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  SchemaGraphResponseDto,
  SearchResponseDto,
  SendAdminTestPushRequestDto,
  SendTestEmailRequestDto,
  ServiceStatusResponseDto,
  SessionDto,
  StartTvTimeImportDto,
  StatsDto,
  TvTimeImportJobDto,
  UpdateGameEntryDto,
  UpdateUsernameRequestDto,
  UpdateUserRequestDto,
  UpsertGameEntryDto,
  UpsertLibraryEntryDto,
  UserDataExportDto,
  UserDto,
  UsernameAvailabilityDto,
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

  // When served through an ngrok free tunnel, requests without this header get
  // ngrok's HTML warning page instead of the JSON response. Same-origin, so no
  // CORS preflight; the header is ignored by any non-ngrok backend.
  if (env.PUBLIC_NGROK === "true") {
    headers["ngrok-skip-browser-warning"] = "true";
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

// Refresh tokens rotate: the presented one is consumed server-side on success.
// Concurrent 401s (e.g. a page firing several requests at once) must therefore
// share a single refresh — otherwise the first consumes the token and the rest
// replay the now-dead one, fail, and log the user out. This mutex holds the
// in-flight refresh so late callers await it instead of starting their own.
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
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

/** Sends a reset link by email, if the address matches an account. */
export function forgotPassword(email: string): Promise<void> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email },
    withAuth: false,
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  return request("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    withAuth: false,
  });
}

export function verifyEmail(token: string): Promise<void> {
  return request("/auth/verify-email", {
    method: "POST",
    body: { token },
    withAuth: false,
  });
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

export async function updateMe(body: UpdateUserRequestDto): Promise<UserDto> {
  const user = await request<UserDto>("/users/me", { method: "PATCH", body });
  auth.user = user;
  return user;
}

export function changeEmail(body: ChangeEmailRequestDto): Promise<void> {
  return request("/users/me/email", { method: "PATCH", body });
}

export async function confirmEmailChange(
  body: ConfirmEmailChangeRequestDto,
): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/email/confirm", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export function changePassword(body: ChangePasswordRequestDto): Promise<void> {
  return request("/users/me/password", { method: "PATCH", body });
}

export function checkUsernameAvailable(
  value: string,
): Promise<UsernameAvailabilityDto> {
  const params = new URLSearchParams({ value });
  return request(`/users/me/username-availability?${params}`);
}

export async function updateUsername(
  body: UpdateUsernameRequestDto,
): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/username", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

/** Full portable dump of the account's data (GDPR "download my data"). */
export function exportMyData(): Promise<UserDataExportDto> {
  return request("/users/me/export");
}

/** Permanently deletes the account and clears local auth state. */
export async function deleteAccount(
  body: DeleteAccountRequestDto,
): Promise<void> {
  await request("/users/me", { method: "DELETE", body });
  auth.clear();
}

// --- Sessions (connected devices) ---

export function getSessions(): Promise<SessionDto[]> {
  return request("/auth/sessions");
}

export function revokeSession(id: string): Promise<void> {
  return request(`/auth/sessions/${id}`, { method: "DELETE" });
}

/** Revokes every session except the current device (kept via its jti). */
export function revokeOtherSessions(exceptJti: string): Promise<void> {
  const params = new URLSearchParams({ except: exceptJti });
  return request(`/auth/sessions?${params}`, { method: "DELETE" });
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

// --- Admin ---

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

// --- Catalog ---

export function searchCatalog(
  query: string,
  type?: MediaType,
  page = 1,
): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  return request(`/catalog/search?${params}`);
}

export function getCatalogDetails(
  source: string,
  sourceId: string,
  type: MediaType,
): Promise<MediaDetailsDto> {
  return request(`/catalog/${source.toLowerCase()}/${sourceId}?type=${type}`);
}

/** Live extras (where to watch, cast, similar) — not persisted. */
export function getMediaExtras(
  source: string,
  sourceId: string,
  type: MediaType,
): Promise<MediaExtrasDto> {
  return request(
    `/catalog/${source.toLowerCase()}/${sourceId}/extras?type=${type}`,
  );
}

/** Live detail of a cast entity (TMDB person) for the cast modal. */
export function getCastDetail(
  source: string,
  id: string,
): Promise<CastDetailDto> {
  return request(`/catalog/${source.toLowerCase()}/person/${id}`);
}

/**
 * Unified media page: metadata + the user's library state (`entry` null when
 * not in the library). Addressed by catalogue identity — `type` implies the
 * source, so no source segment is needed.
 */
export function getMediaDetail(
  type: MediaType,
  sourceId: string,
): Promise<MediaDetailDto> {
  return request(`/media/${type.toLowerCase()}/${sourceId}`);
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

export function updateLibraryEntry(
  entryId: string,
  body: Partial<
    Pick<
      LibraryEntryDto,
      | "status"
      | "rating"
      | "notes"
      | "favorite"
      | "ownershipStatus"
      | "ownershipSource"
    >
  >,
): Promise<LibraryEntryDto> {
  return request(`/library/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteLibraryEntry(entryId: string): Promise<void> {
  return request(`/library/entries/${entryId}`, { method: "DELETE" });
}

export function watchEpisode(episodeId: string): Promise<EpisodeWatchDto> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "POST",
    body: {},
  });
}

/** Mark every not-yet-watched episode of a season as watched. */
export function watchSeason(seasonId: string): Promise<void> {
  return request(`/library/seasons/${seasonId}/watches`, { method: "POST" });
}

/** Mark all regular episodes up to and including this one (specials excluded). */
export function watchThrough(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watch-through`, {
    method: "POST",
  });
}

/** Undo the most recent watch of an episode (unwatches it at a single watch). */
export function unwatchEpisode(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "DELETE",
  });
}

export function getCalendar(): Promise<CalendarEntryDto[]> {
  return request("/library/calendar");
}

export function getStats(): Promise<StatsDto> {
  return request("/library/stats");
}

// --- Games ---

export function searchGames(query: string): Promise<GameSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/games/search?${params}`);
}

export function listGames(
  filters: { status?: GameStatus } = {},
): Promise<GameEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/games${suffix}`);
}

export function getGameStats(): Promise<GameStatsDto> {
  return request("/games/stats");
}

/** Resolve + match a Steam library against IGDB (writes nothing). */
export function previewSteamImport(
  body: SteamImportPreviewRequestDto,
): Promise<SteamImportPreviewDto> {
  return request("/games/import/steam/preview", { method: "POST", body });
}

/** Persist the chosen Steam games as library entries. */
export function commitSteamImport(
  body: SteamImportCommitRequestDto,
): Promise<SteamImportResultDto> {
  return request("/games/import/steam/commit", { method: "POST", body });
}

/** Game detail (catalogue metadata + the user's library state). */
export function getGameDetail(
  source: string,
  sourceId: string,
): Promise<GameDetailDto> {
  return request(`/games/${source.toLowerCase()}/${sourceId}`);
}

export function upsertGameEntry(
  body: UpsertGameEntryDto,
): Promise<GameEntryDto> {
  return request("/games", { method: "PUT", body });
}

export function updateGameEntry(
  entryId: string,
  body: UpdateGameEntryDto,
): Promise<GameEntryDto> {
  return request(`/games/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteGameEntry(entryId: string): Promise<void> {
  return request(`/games/entries/${entryId}`, { method: "DELETE" });
}

/** Log a completed replay (a completion beyond the entry's first one). */
export function addGameReplay(entryId: string): Promise<GameEntryDto> {
  return request(`/games/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });
}

export function deleteGameReplay(replayId: string): Promise<void> {
  return request(`/games/replays/${replayId}`, { method: "DELETE" });
}

// --- Books ---

export function searchBooks(query: string): Promise<BookSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/books/search?${params}`);
}

export function listBooks(
  filters: { status?: BookStatus } = {},
): Promise<BookEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/books${suffix}`);
}

export function getBookStats(): Promise<BookStatsDto> {
  return request("/books/stats");
}

/** Book detail (catalogue metadata + the user's library state). */
export function getBookDetail(
  source: string,
  sourceId: string,
): Promise<BookDetailDto> {
  return request(`/books/${source.toLowerCase()}/${sourceId}`);
}

export function upsertBookEntry(
  body: UpsertBookEntryDto,
): Promise<BookEntryDto> {
  return request("/books", { method: "PUT", body });
}

export function updateBookEntry(
  entryId: string,
  body: UpdateBookEntryDto,
): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteBookEntry(entryId: string): Promise<void> {
  return request(`/books/entries/${entryId}`, { method: "DELETE" });
}

/** Log a completed reread (a completion beyond the entry's first one). */
export function addBookReplay(entryId: string): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });
}

export function deleteBookReplay(replayId: string): Promise<void> {
  return request(`/books/replays/${replayId}`, { method: "DELETE" });
}

/** Parse + resolve a StoryGraph CSV against Google Books (writes nothing). */
export function previewStoryGraphImport(
  body: StoryGraphImportPreviewRequestDto,
): Promise<StoryGraphImportPreviewDto> {
  return request("/books/import/storygraph/preview", { method: "POST", body });
}

/** Persist the chosen StoryGraph books as library entries. */
export function commitStoryGraphImport(
  body: StoryGraphImportCommitRequestDto,
): Promise<StoryGraphImportResultDto> {
  return request("/books/import/storygraph/commit", { method: "POST", body });
}

/** Parse + resolve a Goodreads CSV against Google Books (writes nothing). */
export function previewGoodreadsImport(
  body: GoodreadsImportPreviewRequestDto,
): Promise<GoodreadsImportPreviewDto> {
  return request("/books/import/goodreads/preview", { method: "POST", body });
}

/** Persist the chosen Goodreads books as library entries. */
export function commitGoodreadsImport(
  body: GoodreadsImportCommitRequestDto,
): Promise<GoodreadsImportResultDto> {
  return request("/books/import/goodreads/commit", { method: "POST", body });
}

// --- Notifications ---

/** Detect new episodes of tracked shows, then return the refreshed feed. */
export function scanNotifications(): Promise<NotificationFeedDto> {
  return request("/notifications/scan", { method: "POST" });
}

export function getNotifications(): Promise<NotificationFeedDto> {
  return request("/notifications");
}

export function markNotificationsRead(): Promise<void> {
  return request("/notifications/read", { method: "POST" });
}

export function markNotificationRead(id: string): Promise<void> {
  return request(`/notifications/${id}/read`, { method: "PATCH" });
}

// --- Web Push ---

/** VAPID public key; empty string when the server has push disabled. */
export function getPushPublicKey(): Promise<PushPublicKeyDto> {
  return request("/notifications/push/public-key", { withAuth: false });
}

export function subscribePush(body: PushSubscriptionRequestDto): Promise<void> {
  return request("/notifications/push/subscribe", { method: "POST", body });
}

export function unsubscribePush(endpoint: string): Promise<void> {
  return request("/notifications/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });
}

// --- TV Time import ---

/** Analyse an export → reconciliation plan (writes nothing). Poll the job. */
export function analyzeTvTimeImport(
  body: StartTvTimeImportDto,
): Promise<TvTimeImportJobDto> {
  return request("/import/tvtime/analyze", { method: "POST", body });
}

/** Commit an analysed import with the user's reconciliation decisions. */
export function commitTvTimeImport(
  jobId: string,
  body: ImportCommitRequest,
): Promise<TvTimeImportJobDto> {
  return request(`/import/tvtime/${jobId}/commit`, { method: "POST", body });
}

export function getTvTimeImportJob(jobId: string): Promise<TvTimeImportJobDto> {
  return request(`/import/tvtime/${jobId}`);
}
