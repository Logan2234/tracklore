import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GameOwnershipStatus, GameSource } from "@tracklore/shared";
import type {
  SteamImportCommitGameDto,
  SteamImportPreviewDto,
  SteamImportResultDto,
  SteamMatchedGameDto,
  SteamUnmatchedGameDto,
} from "@tracklore/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AgeGateService } from "../../users/age-gate.service";
import { GameItemService } from "../game-item.service";
import { IgdbProvider } from "../providers/igdb.provider";

const STEAM_API = "https://api.steampowered.com";

interface SteamOwnedGame {
  appid: number;
  // Only present because `fetchOwnedGames` requests `include_appinfo=1`.
  name?: string;
  playtime_forever: number; // Minutes.
  playtime_2weeks?: number;
}

@Injectable()
export class SteamImportService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbProvider,
    private readonly gameItemService: GameItemService,
    private readonly ageGate: AgeGateService,
  ) {}

  /**
   * Resolve the input to a Steam library and match it against IGDB — writing
   * nothing. `steamId` may be a SteamID64, a vanity name, or a full
   * steamcommunity.com profile URL.
   */
  async preview(
    userId: string,
    rawInput: string,
  ): Promise<SteamImportPreviewDto> {
    const steamId = await this.resolveSteamId(rawInput);
    const owned = await this.fetchOwnedGames(steamId);

    if (owned.length === 0) {
      return { steamId, totalOwned: 0, matched: [], unmatched: [] };
    }

    const appIds = owned.map((g) => String(g.appid));
    const appToIgdb = await this.igdb.matchSteamAppIds(appIds);
    const igdbIds = [...new Set(appToIgdb.values())];
    const details = await this.igdb.getDetailsByIds(igdbIds);
    const detailById = new Map(details.map((d) => [d.summary.sourceId, d]));

    const [allowAdult, inLibrary] = await Promise.all([
      this.ageGate.allowsAdultContent(userId),
      this.igdbIdsInLibrary(userId, igdbIds),
    ]);

    // One row per matched IGDB game, keeping the highest playtime when several
    // owned appids resolve to the same game (e.g. regional editions).
    const matchedById = new Map<string, SteamMatchedGameDto>();
    // Games IGDB found no entry for at all — offered for manual association.
    // Age-filtered matches are excluded from both lists (not a match issue).
    const unmatchedByAppId = new Map<string, SteamUnmatchedGameDto>();

    for (const game of owned) {
      const igdbId = appToIgdb.get(String(game.appid));
      const detail = igdbId ? detailById.get(igdbId) : undefined;
      if (!igdbId || !detail) {
        unmatchedByAppId.set(String(game.appid), {
          appid: String(game.appid),
          name: game.name ?? null,
          playtimeMinutes: game.playtime_forever,
        });
        continue;
      }
      if (detail.summary.isAdult && !allowAdult) continue;

      const existing = matchedById.get(igdbId);
      const playtimeMinutes = Math.max(
        game.playtime_forever,
        existing?.playtimeMinutes ?? 0,
      );
      matchedById.set(igdbId, {
        sourceId: igdbId,
        title: detail.summary.title,
        coverUrl: detail.summary.coverUrl,
        playtimeMinutes,
        recentlyPlayed:
          (game.playtime_2weeks ?? 0) > 0 || !!existing?.recentlyPlayed,
        alreadyInLibrary: inLibrary.has(igdbId),
      });
    }

    const matched = [...matchedById.values()].sort(
      (a, b) => b.playtimeMinutes - a.playtimeMinutes,
    );
    const unmatched = [...unmatchedByAppId.values()].sort(
      (a, b) => b.playtimeMinutes - a.playtimeMinutes,
    );

    return { steamId, totalOwned: owned.length, matched, unmatched };
  }

  /**
   * Persist the chosen games (bulk-fetching their IGDB details in a couple of
   * calls) and upsert a library entry for each with its status and playtime.
   */
  async commit(
    userId: string,
    games: SteamImportCommitGameDto[],
  ): Promise<SteamImportResultDto> {
    if (games.length === 0) return { imported: 0 };

    const details = await this.igdb.getDetailsByIds(
      games.map((g) => g.sourceId),
    );
    const detailById = new Map(details.map((d) => [d.summary.sourceId, d]));
    const allowAdult = await this.ageGate.allowsAdultContent(userId);

    let imported = 0;

    for (const game of games) {
      const detail = detailById.get(game.sourceId);
      if (!detail) continue;
      // Defence in depth: never import an 18+ title for a non-opted-in account,
      // even if the client sends its id.
      if (detail.summary.isAdult && !allowAdult) continue;

      const gameItem = await this.gameItemService.persistDetails(
        GameSource.IGDB,
        detail,
      );
      // Every Steam-imported game is, by definition, owned digitally on Steam.
      const data = {
        status: game.status,
        playtimeMinutes: game.playtimeMinutes,
        ownershipStatus: GameOwnershipStatus.DIGITAL,
        ownershipSource: "Steam",
      };
      await this.prisma.gameEntry.upsert({
        where: {
          userId_gameItemId: { userId, gameItemId: gameItem.id },
        },
        update: data,
        create: { userId, gameItemId: gameItem.id, ...data },
      });
      imported++;
    }

    return { imported };
  }

  /** IGDB ids (of the given set) the user already has a library entry for. */
  private async igdbIdsInLibrary(
    userId: string,
    igdbIds: string[],
  ): Promise<Set<string>> {
    if (igdbIds.length === 0) return new Set();

    const refs = await this.prisma.gameExternalId.findMany({
      where: { source: "IGDB", externalId: { in: igdbIds } },
      select: { externalId: true, gameItemId: true },
    });
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId, gameItemId: { in: refs.map((r) => r.gameItemId) } },
      select: { gameItemId: true },
    });
    const owned = new Set(entries.map((e) => e.gameItemId));
    return new Set(
      refs.filter((r) => owned.has(r.gameItemId)).map((r) => r.externalId),
    );
  }

  /** SteamID64 / vanity name / profile URL → SteamID64. */
  private async resolveSteamId(rawInput: string): Promise<string> {
    const input = rawInput.trim();

    const profileMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileMatch) return profileMatch[1];

    const vanityUrlMatch = input.match(/steamcommunity\.com\/id\/([^/?#]+)/);
    const vanity = vanityUrlMatch ? vanityUrlMatch[1] : input;

    if (/^\d{17}$/.test(vanity)) return vanity;

    return this.resolveVanity(vanity);
  }

  private async resolveVanity(name: string): Promise<string> {
    const data = await this.getJson<{
      response: { success: number; steamid?: string };
    }>(`${STEAM_API}/ISteamUser/ResolveVanityURL/v1/`, {
      vanityurl: name,
    });

    if (data.response.success !== 1 || !data.response.steamid) {
      throw new BadRequestException(
        "Profil Steam introuvable — vérifie l'identifiant ou l'URL du profil.",
      );
    }

    return data.response.steamid;
  }

  private async fetchOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const data = await this.getJson<{
      response: { game_count?: number; games?: SteamOwnedGame[] };
    }>(`${STEAM_API}/IPlayerService/GetOwnedGames/v1/`, {
      steamid: steamId,
      include_played_free_games: "1",
      // Needed for `name` — used to pre-fill the manual match search for
      // games IGDB couldn't resolve on its own.
      include_appinfo: "1",
      format: "json",
    });

    // A private (or game-details-private) profile returns an empty response
    // object rather than an error.
    if (data.response.game_count === undefined) {
      throw new BadRequestException(
        "Bibliothèque Steam inaccessible — le profil et les détails des jeux doivent être publics.",
      );
    }

    return data.response.games ?? [];
  }

  private async getJson<T>(
    url: string,
    params: Record<string, string>,
  ): Promise<T> {
    const target = new URL(url);
    target.searchParams.set(
      "key",
      this.configService.getOrThrow<string>("STEAM_API_KEY"),
    );

    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }

    const response = await fetch(target);

    if (!response.ok) {
      throw new BadGatewayException(
        `Steam request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}
