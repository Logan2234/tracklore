import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { MediaItemService } from "../catalog/media-item.service";
import { LibraryService } from "./library.service";

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "entry-1";
  return {
    id,
    userId: "user-1",
    mediaItemId: `media-${id}`,
    status: overrides.status ?? "PLANNED",
    rating: overrides.rating ?? null,
    notes: null,
    favorite: overrides.favorite ?? false,
    startedAt: null,
    finishedAt: overrides.finishedAt ?? null,
    ownershipStatus: "NONE",
    ownershipSource: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    mediaItem: {
      id: `media-${id}`,
      type: overrides.type ?? "MOVIE",
      title: overrides.title ?? "Arrival",
      posterUrl: null,
      canonicalSource: "TMDB",
      status: overrides.airingStatus ?? "Ended",
      externalIds: [{ source: "TMDB", externalId: `tmdb-${id}` }],
    },
  };
}

interface ServiceOpts {
  episodesByMediaItem?: Record<
    string,
    { id: string; number: number; airDate: Date | null; season: { number: number } }[]
  >;
  watchedByMediaItem?: Record<string, string[]>;
  lastWatchedByMediaItem?: Record<string, Date | null>;
}

function makeService(rows: ReturnType<typeof makeRow>[], opts: ServiceOpts = {}) {
  const prisma = {
    libraryEntry: { findMany: jest.fn().mockResolvedValue(rows) },
    episode: {
      findMany: jest.fn(
        ({ where }: { where: { season: { mediaItemId: string } } }) =>
          Promise.resolve(
            opts.episodesByMediaItem?.[where.season.mediaItemId] ?? [],
          ),
      ),
    },
    episodeWatch: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: { episode: { season: { mediaItemId: string } } };
        }) => {
          const ids =
            opts.watchedByMediaItem?.[where.episode.season.mediaItemId] ?? [];
          return Promise.resolve(ids.map((episodeId) => ({ episodeId })));
        },
      ),
      aggregate: jest.fn(
        ({
          where,
        }: {
          where: { episode: { season: { mediaItemId: string } } };
        }) =>
          Promise.resolve({
            _max: {
              watchedAt:
                opts.lastWatchedByMediaItem?.[
                  where.episode.season.mediaItemId
                ] ?? null,
            },
          }),
      ),
    },
  } as unknown as PrismaService;
  const service = new LibraryService(
    prisma,
    {} as MediaItemService,
    {} as AgeGateService,
  );
  return { service, prisma };
}

describe("LibraryService.listEntries", () => {
  it("paginates and reports total/hasMore (movies, no episode progress)", async () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      makeRow({ id: `e${i}`, title: `Movie ${i}` }),
    );
    const { service } = makeService(rows);

    const page1 = await service.listEntries("user-1", {});
    expect(page1.items).toHaveLength(40);
    expect(page1.total).toBe(45);
    expect(page1.hasMore).toBe(true);

    const page2 = await service.listEntries("user-1", { page: 2 });
    expect(page2.items).toHaveLength(5);
    expect(page2.hasMore).toBe(false);
  });

  it("filters by favorite", async () => {
    const rows = [
      makeRow({ id: "a", favorite: true }),
      makeRow({ id: "b", favorite: false }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { favorite: true });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by free-text title search, case-insensitive", async () => {
    const rows = [
      makeRow({ id: "a", title: "Arrival" }),
      makeRow({ id: "b", title: "Dune" }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { q: "arr" });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters the synthetic DORMANT status (WATCHING with no recent activity)", async () => {
    const dormantRow = makeRow({
      id: "dormant",
      type: "SERIES",
      status: "WATCHING",
    });
    const activeRow = makeRow({
      id: "active",
      type: "SERIES",
      status: "WATCHING",
    });
    const episodes = [
      { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
      { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
    ];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const { service } = makeService([dormantRow, activeRow], {
      episodesByMediaItem: {
        "media-dormant": episodes,
        "media-active": episodes,
      },
      watchedByMediaItem: {
        "media-dormant": ["ep1"],
        "media-active": ["ep1"],
      },
      lastWatchedByMediaItem: {
        "media-dormant": sixtyDaysAgo,
        "media-active": oneDayAgo,
      },
    });

    const dormantOnly = await service.listEntries("user-1", {
      statuses: ["DORMANT"],
    });
    expect(dormantOnly.items.map((i) => i.id)).toEqual(["dormant"]);

    const bothWatching = await service.listEntries("user-1", {
      statuses: ["WATCHING"],
    });
    expect(bothWatching.items.map((i) => i.id).sort()).toEqual([
      "active",
      "dormant",
    ]);
  });
});
