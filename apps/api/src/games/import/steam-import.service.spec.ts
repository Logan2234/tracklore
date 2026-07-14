import { ConfigService } from "@nestjs/config";
import { GameSource } from "@tracklore/shared";
import type { ProviderGameDetails } from "../providers/game-provider.types";
import { GameItemService } from "../game-item.service";
import { IgdbProvider } from "../providers/igdb.provider";
import { PrismaService } from "../../prisma/prisma.service";
import { AgeGateService } from "../../users/age-gate.service";
import { SteamImportService } from "./steam-import.service";

const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([part]) => url.includes(part));
    if (!match) throw new Error(`Unexpected fetch call in test: ${url}`);
    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function detail(id: string, adult = false): ProviderGameDetails {
  return {
    summary: {
      source: GameSource.IGDB,
      sourceId: id,
      title: `Game ${id}`,
      year: 2020,
      coverUrl: `cover-${id}`,
      isAdult: adult,
    },
    overview: null,
    backdropUrl: null,
    genres: [],
    platforms: [],
    releaseDate: null,
    externalIds: [{ source: GameSource.IGDB, externalId: id }],
  };
}

interface Mocks {
  igdb: { matchSteamAppIds: jest.Mock; getDetailsByIds: jest.Mock };
  gameItemService: { persistDetails: jest.Mock };
  ageGate: { allowsAdultContent: jest.Mock };
  prisma: {
    gameExternalId: { findMany: jest.Mock };
    gameEntry: { findMany: jest.Mock; upsert: jest.Mock };
  };
}

function build(over: Partial<Mocks> = {}): {
  service: SteamImportService;
  mocks: Mocks;
} {
  const mocks: Mocks = {
    igdb: {
      matchSteamAppIds: jest.fn().mockResolvedValue(new Map()),
      getDetailsByIds: jest.fn().mockResolvedValue([]),
      ...over.igdb,
    },
    gameItemService: {
      persistDetails: jest.fn(),
      ...over.gameItemService,
    },
    ageGate: {
      allowsAdultContent: jest.fn().mockResolvedValue(false),
      ...over.ageGate,
    },
    prisma: {
      gameExternalId: { findMany: jest.fn().mockResolvedValue([]) },
      gameEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      ...over.prisma,
    },
  };
  const config = { getOrThrow: jest.fn().mockReturnValue("steam-key") };
  const service = new SteamImportService(
    config as unknown as ConfigService,
    mocks.prisma as unknown as PrismaService,
    mocks.igdb as unknown as IgdbProvider,
    mocks.gameItemService as unknown as GameItemService,
    mocks.ageGate as unknown as AgeGateService,
  );
  return { service, mocks };
}

describe("SteamImportService", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("matches owned games to IGDB, filtering adult titles and sorting by playtime", async () => {
    const { service, mocks } = build({
      igdb: {
        matchSteamAppIds: jest.fn().mockResolvedValue(
          new Map([
            ["10", "100"],
            ["20", "200"],
            ["30", "300"],
          ]),
        ),
        getDetailsByIds: jest
          .fn()
          .mockResolvedValue([
            detail("100"),
            detail("200"),
            detail("300", true),
          ]),
      },
      prisma: {
        gameExternalId: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ externalId: "200", gameItemId: "gi200" }]),
        },
        gameEntry: {
          findMany: jest.fn().mockResolvedValue([{ gameItemId: "gi200" }]),
          upsert: jest.fn(),
        },
      },
    });

    mockFetchByUrl({
      GetOwnedGames: {
        response: {
          game_count: 4,
          games: [
            { appid: 10, playtime_forever: 600 },
            { appid: 20, playtime_forever: 100, playtime_2weeks: 30 },
            { appid: 30, playtime_forever: 50 }, // adult → filtered
            { appid: 40, playtime_forever: 5 }, // unmatched
          ],
        },
      },
    });

    const preview = await service.preview(
      "user1",
      "76561197960287930", // SteamID64 → used as-is
    );

    expect(preview.steamId).toBe("76561197960287930");
    expect(preview.totalOwned).toBe(4);
    // Adult (300) and unmatched (40) excluded; sorted by playtime desc.
    expect(preview.matched).toEqual([
      {
        sourceId: "100",
        title: "Game 100",
        coverUrl: "cover-100",
        playtimeMinutes: 600,
        recentlyPlayed: false,
        alreadyInLibrary: false,
      },
      {
        sourceId: "200",
        title: "Game 200",
        coverUrl: "cover-200",
        playtimeMinutes: 100,
        recentlyPlayed: true,
        alreadyInLibrary: true,
      },
    ]);
    // The adult title (300) matched IGDB fine but is age-filtered, not
    // "unmatched" — only the truly unresolved appid (40) shows up here.
    expect(preview.unmatched).toEqual([
      { appid: "40", name: null, playtimeMinutes: 5 },
    ]);
    expect(mocks.igdb.matchSteamAppIds).toHaveBeenCalledWith([
      "10",
      "20",
      "30",
      "40",
    ]);
  });

  it("resolves a vanity profile URL through Steam", async () => {
    const { service } = build();
    const fetchMock = mockFetchByUrl({
      ResolveVanityURL: {
        response: { success: 1, steamid: "76561190000000000" },
      },
      GetOwnedGames: { response: { game_count: 0, games: [] } },
    });

    const preview = await service.preview(
      "user1",
      "https://steamcommunity.com/id/gaben",
    );

    expect(preview.steamId).toBe("76561190000000000");
    const vanityCall = fetchMock.mock.calls.find(([u]) =>
      String(u).includes("ResolveVanityURL"),
    );
    expect(String(vanityCall?.[0])).toContain("vanityurl=gaben");
  });

  it("throws a clear error when the profile is private", async () => {
    const { service } = build();
    mockFetchByUrl({ GetOwnedGames: { response: {} } });
    await expect(service.preview("user1", "76561197960287930")).rejects.toThrow(
      /public/i,
    );
  });

  it("commit persists chosen games and skips adult titles for non-opted-in users", async () => {
    const { service, mocks } = build({
      igdb: {
        matchSteamAppIds: jest.fn(),
        getDetailsByIds: jest
          .fn()
          .mockResolvedValue([detail("100"), detail("300", true)]),
      },
      gameItemService: {
        persistDetails: jest
          .fn()
          .mockImplementation((_s, d: ProviderGameDetails) =>
            Promise.resolve({ id: `gi-${d.summary.sourceId}` }),
          ),
      },
    });

    const result = await service.commit("user1", [
      { sourceId: "100", status: "PLAYING", playtimeMinutes: 600 },
      { sourceId: "300", status: "BACKLOG", playtimeMinutes: 50 },
    ]);

    expect(result.imported).toBe(1);
    expect(mocks.gameItemService.persistDetails).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.gameEntry.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.gameEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user1",
          gameItemId: "gi-100",
          status: "PLAYING",
          playtimeMinutes: 600,
          ownershipStatus: "DIGITAL",
          ownershipSource: "Steam",
        }),
      }),
    );
  });
});
