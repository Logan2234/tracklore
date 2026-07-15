import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { MediaItemService } from "./media-item.service";

// Runs `fn` straight through without touching the DB — refreshStale's own
// behaviour is what's under test here, not the job-recording wrapper.
const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

describe("MediaItemService.refreshStale", () => {
  function makeService(items: unknown[]) {
    const prisma = {
      mediaItem: { findMany: jest.fn().mockResolvedValue(items) },
    } as unknown as PrismaService;
    const service = new MediaItemService(
      prisma,
      undefined as never,
      undefined as never,
      jobRunsStub,
    );
    return { service, prisma };
  }

  it("only queries non-dropped tracked media past the sync TTL", async () => {
    const { service, prisma } = makeService([]);
    await service.refreshStale();
    expect(prisma.mediaItem.findMany).toHaveBeenCalledWith({
      where: {
        lastSyncedAt: { lt: expect.any(Date) },
        entries: { some: { status: { not: "DROPPED" } } },
      },
      include: { externalIds: true },
    });
  });

  it("re-syncs each stale item via its canonical external id", async () => {
    const items = [
      {
        id: "m1",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "42" }],
      },
      {
        id: "m2",
        type: "ANIME",
        canonicalSource: "ANILIST",
        externalIds: [{ source: "ANILIST", externalId: "99" }],
      },
    ];
    const { service } = makeService(items);
    const upsert = jest
      .spyOn(service, "upsertFromSource")
      .mockResolvedValue(undefined as never);

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(2);
    expect(upsert).toHaveBeenNthCalledWith(1, "TMDB", "42", "SERIES");
    expect(upsert).toHaveBeenNthCalledWith(2, "ANILIST", "99", "ANIME");
  });

  it("skips items missing their canonical external id", async () => {
    const items = [{ id: "m1", canonicalSource: "TMDB", externalIds: [] }];
    const { service } = makeService(items);
    const upsert = jest.spyOn(service, "upsertFromSource");

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps refreshing the rest of the batch when one item fails", async () => {
    const items = [
      {
        id: "m1",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "1" }],
      },
      {
        id: "m2",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "2" }],
      },
    ];
    const { service } = makeService(items);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    const upsert = jest
      .spyOn(service, "upsertFromSource")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined as never);

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
