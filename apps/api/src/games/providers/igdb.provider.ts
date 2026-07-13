import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GameSource, GameSummaryDto } from "@tracklore/shared";
import type {
  GameCatalogProvider,
  ProviderGameDetails,
} from "./game-provider.types";

const OAUTH_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
const IMG = "https://images.igdb.com/igdb/image/upload";

// IGDB theme id for "Erotic" — our adult-content marker, mirroring TMDB `adult`
// / AniList hentai. See https://api-docs.igdb.com (themes reference).
const EROTIC_THEME_ID = 42;

// Refresh the app-access token a minute before it actually expires, so a call
// never rides on a token that lapses mid-flight.
const TOKEN_SKEW_MS = 60 * 1000;

interface IgdbImage {
  image_id: string;
}

interface IgdbNamed {
  name: string;
}

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number; // Unix seconds.
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  themes?: number[];
}

interface TwitchToken {
  access_token: string;
  expires_in: number; // Seconds.
}

/**
 * Video games, from IGDB (Twitch/Amazon). IGDB authenticates through a Twitch
 * app-access token (OAuth client-credentials) and queries via Apicalypse — a
 * plain-text body POSTed to each endpoint. The token is cached until it nears
 * expiry.
 */
@Injectable()
export class IgdbProvider implements GameCatalogProvider {
  readonly source = GameSource.IGDB;

  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<GameSummaryDto[]> {
    // Apicalypse strings are double-quoted; drop quotes from user input so they
    // cannot break out of the search literal.
    const safeQuery = query.replace(/"/g, "");
    // game_type = 0 keeps only base games (IGDB deprecated the old `category`
    // field; filtering on it silently returns nothing). Excludes DLC, bundles,
    // editions… so the searched title isn't buried under its re-releases.
    const games = await this.query<IgdbGame[]>(
      "/games",
      `search "${safeQuery}"; fields name, cover.image_id, first_release_date, themes; where game_type = 0; limit 20;`,
    );
    return games.map((g) => this.toSummary(g));
  }

  private static readonly DETAIL_FIELDS =
    "name, summary, first_release_date, cover.image_id, artworks.image_id, genres.name, platforms.name, themes";

  async getDetails(sourceId: string): Promise<ProviderGameDetails> {
    const games = await this.query<IgdbGame[]>(
      "/games",
      `fields ${IgdbProvider.DETAIL_FIELDS}; where id = ${Number(sourceId)};`,
    );
    const game = games[0];

    if (!game) {
      throw new NotFoundException("Game not found on IGDB");
    }

    return this.toDetails(game);
  }

  /**
   * Batch details for many IGDB ids in one query each 500 (IGDB's result cap),
   * used by the Steam import so a large library is persisted in a couple of
   * calls instead of one per game.
   */
  async getDetailsByIds(ids: string[]): Promise<ProviderGameDetails[]> {
    const details: ProviderGameDetails[] = [];

    for (const chunk of chunkArray(ids, 500)) {
      const idList = chunk.map((id) => Number(id)).join(",");
      const games = await this.query<IgdbGame[]>(
        "/games",
        `fields ${IgdbProvider.DETAIL_FIELDS}; where id = (${idList}); limit 500;`,
      );
      details.push(...games.map((g) => this.toDetails(g)));
    }

    return details;
  }

  /**
   * Map Steam appids to IGDB ids via IGDB's external_games cross-reference.
   * (`external_game_source = 1` is Steam; the old `category` field is
   * deprecated and silently returns nothing.) Returns appid → IGDB id.
   */
  async matchSteamAppIds(appIds: string[]): Promise<Map<string, string>> {
    const byAppId = new Map<string, string>();

    for (const chunk of chunkArray(appIds, 500)) {
      const uidList = chunk.map((id) => `"${id}"`).join(",");
      const rows = await this.query<{ game: number; uid: string }[]>(
        "/external_games",
        `fields game, uid; where external_game_source = 1 & uid = (${uidList}); limit 500;`,
      );
      for (const row of rows) {
        // First match wins; IGDB can list several rows per game/appid.
        if (!byAppId.has(row.uid)) byAppId.set(row.uid, String(row.game));
      }
    }

    return byAppId;
  }

  private toDetails(game: IgdbGame): ProviderGameDetails {
    return {
      summary: this.toSummary(game),
      overview: game.summary ?? null,
      backdropUrl: game.artworks?.[0]
        ? `${IMG}/t_1080p/${game.artworks[0].image_id}.jpg`
        : null,
      genres: game.genres?.map((g) => g.name) ?? [],
      platforms: game.platforms?.map((p) => p.name) ?? [],
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
        : null,
      externalIds: [{ source: GameSource.IGDB, externalId: String(game.id) }],
    };
  }

  private toSummary(game: IgdbGame): GameSummaryDto {
    return {
      source: GameSource.IGDB,
      sourceId: String(game.id),
      title: game.name,
      year: game.first_release_date
        ? new Date(game.first_release_date * 1000).getUTCFullYear()
        : null,
      coverUrl: game.cover
        ? `${IMG}/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      isAdult: game.themes?.includes(EROTIC_THEME_ID) ?? false,
    };
  }

  /** POST an Apicalypse query to an IGDB endpoint with a valid access token. */
  private async query<T>(path: string, body: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Client-ID": this.configService.getOrThrow<string>("TWITCH_CLIENT_ID"),
        Authorization: `Bearer ${await this.accessToken()}`,
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `IGDB request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }

  /** Cached Twitch app-access token, fetched (or refreshed) on demand. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > Date.now()) {
      return this.token.value;
    }

    const url = new URL(OAUTH_URL);
    url.searchParams.set(
      "client_id",
      this.configService.getOrThrow<string>("TWITCH_CLIENT_ID"),
    );
    url.searchParams.set(
      "client_secret",
      this.configService.getOrThrow<string>("TWITCH_CLIENT_SECRET"),
    );
    url.searchParams.set("grant_type", "client_credentials");

    const response = await fetch(url, { method: "POST" });

    if (!response.ok) {
      throw new BadGatewayException(
        `Twitch token request failed with status ${response.status}`,
      );
    }

    const token = (await response.json()) as TwitchToken;
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return this.token.value;
  }
}

/** Split an array into consecutive slices of at most `size` items. */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
