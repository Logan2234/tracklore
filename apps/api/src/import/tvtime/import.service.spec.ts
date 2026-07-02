import type { StartTvTimeImportDto } from "@tracklore/shared";
import { ImportService } from "./import.service";
import { makeZip } from "./make-zip";

// Two watched episodes of one show (TVDB 100), plus a never-started show (200).
const EPISODES_CSV = [
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at",
  "My Show,900,1,1,100,,2024-01-01 10:00:00",
  "My Show,901,1,2,100,,2024-01-02 10:00:00",
].join("\n");
const SHOWS_CSV = [
  "tv_show_name,tv_show_id,nb_episodes_seen",
  "My Show,100,2",
  "Planned Show,200,0",
].join("\n");
// Header-only files, so importMovies runs can supply the required movies file.
const EMPTY_SHOWS = "tv_show_name,tv_show_id,nb_episodes_seen";
const EMPTY_EPISODES =
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at";

/** Pack the given CSVs into a base64 TV Time archive for `zipBase64`. */
function zipBase64(files: {
  episodesCsv?: string;
  showsCsv?: string;
  recordsCsv?: string;
  rewatchedCsv?: string;
}): string {
  const names: Record<string, string> = {
    episodesCsv: "tracking-prod-records-v2.csv",
    showsCsv: "user_tv_show_data.csv",
    recordsCsv: "tracking-prod-records.csv",
    rewatchedCsv: "rewatched_episode.csv",
  };
  const entries = Object.entries(files)
    .filter(([, content]) => content !== undefined)
    .map(([field, content]) => ({ name: names[field], content: content! }));
  return makeZip(entries).toString("base64");
}

function seriesDetails() {
  // Season 1 has exactly the two episodes above → fully watched → COMPLETED.
  return {
    seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
  };
}

function makeMocks() {
  const prisma = {
    season: { findMany: jest.fn() },
    episode: { count: jest.fn() },
    episodeWatch: {
      count: jest.fn().mockResolvedValue(0),
      createMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mediaExternalId: { findUnique: jest.fn() },
    libraryEntry: {
      upsert: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const mediaItemService = {
    getLiveDetails: jest.fn().mockResolvedValue(seriesDetails()),
    upsertFromSource: jest.fn().mockResolvedValue({ id: "media-100" }),
  };
  const tmdb = {
    findSeriesByTvdbId: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
  };
  const service = new ImportService(
    prisma as never,
    mediaItemService as never,
    tmdb as never,
  );
  return { prisma, mediaItemService, tmdb, service };
}

async function runToEnd(service: ImportService, userId: string, jobId: string) {
  for (let i = 0; i < 100; i++) {
    if (service.getJob(userId, jobId).status !== "running") break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return service.getJob(userId, jobId);
}

describe("ImportService", () => {
  it("dry-run reconciles and reports without writing anything", async () => {
    const { prisma, tmdb, service } = makeMocks();
    tmdb.findSeriesByTvdbId.mockResolvedValue("500");

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
      dryRun: true,
      importMovies: false,
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.status).toBe("completed");
    expect(job.report!.shows).toMatchObject({
      total: 2,
      imported: 1, // My Show → COMPLETED
      watchlist: 1, // Planned Show → PLANNED
    });
    expect(job.report!.episodes.watched).toBe(2);
    expect(job.report!.episodes.watchesCreated).toBe(0);
    // Nothing persisted in a dry run.
    expect(prisma.episodeWatch.createMany).not.toHaveBeenCalled();
    expect(prisma.libraryEntry.upsert).not.toHaveBeenCalled();
  });

  it("real run creates watches and a COMPLETED entry for a fully-watched show", async () => {
    const { prisma, mediaItemService, tmdb, service } = makeMocks();
    tmdb.findSeriesByTvdbId.mockResolvedValue("500");
    prisma.season.findMany.mockResolvedValue([
      {
        number: 1,
        episodes: [
          { id: "e1", number: 1 },
          { id: "e2", number: 2 },
        ],
      },
    ]);
    prisma.mediaExternalId.findUnique.mockResolvedValue({
      mediaItemId: "media-100",
    });

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
      importMovies: false,
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.status).toBe("completed");
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "500",
      "SERIES",
    );
    expect(prisma.episodeWatch.createMany).toHaveBeenCalledTimes(2);
    expect(job.report!.episodes.watchesCreated).toBe(2);
    expect(prisma.libraryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });

  it("reports a show whose TVDB id does not resolve", async () => {
    const { tmdb, service } = makeMocks();
    tmdb.findSeriesByTvdbId.mockResolvedValue(null);

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({
        episodesCsv: EPISODES_CSV,
        showsCsv: "tv_show_name,tv_show_id,nb_episodes_seen\nMy Show,100,2",
      }),
      importMovies: false,
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.report!.shows.imported).toBe(0);
    expect(job.report!.shows.unresolved).toEqual([
      {
        title: "My Show",
        tvdbId: "100",
        episodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
    ]);
  });

  it("classifies movies as watched (COMPLETED) or watchlist (PLANNED)", async () => {
    const { prisma, mediaItemService, tmdb, service } = makeMocks();
    tmdb.search.mockImplementation((title: string) =>
      Promise.resolve([
        {
          source: "TMDB",
          sourceId: `id-${title}`,
          type: "MOVIE",
          title,
          year: 2020,
          posterUrl: null,
        },
      ]),
    );
    mediaItemService.upsertFromSource.mockImplementation((_s, sourceId) =>
      Promise.resolve({ id: `media-${sourceId}` }),
    );

    const recordsCsv = [
      "type,entity_type,movie_name,release_date",
      "watch,movie,Seen Film,2020-01-01 00:00:00",
      "towatch,movie,Later Film,2020-01-01 00:00:00",
    ].join("\n");

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({
        episodesCsv: EMPTY_EPISODES,
        showsCsv: EMPTY_SHOWS,
        recordsCsv,
      }),
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.report!.movies).toMatchObject({
      total: 2,
      imported: 1,
      watchlist: 1,
    });
    const statuses = prisma.libraryEntry.upsert.mock.calls.map(
      (c) => c[0].create.status,
    );
    expect(statuses.sort()).toEqual(["COMPLETED", "PLANNED"]);
  });

  it("matches a movie on its original title when TMDB returns a localized title", async () => {
    const { prisma, mediaItemService, tmdb, service } = makeMocks();
    // TV Time exports "君の名は。"; TMDB's en-US title is "Your Name.".
    tmdb.search.mockResolvedValue([
      {
        source: "TMDB",
        sourceId: "372058",
        type: "MOVIE",
        title: "Your Name.",
        originalTitle: "君の名は。",
        year: 2016,
        posterUrl: null,
      },
    ]);
    mediaItemService.upsertFromSource.mockResolvedValue({ id: "media-372058" });

    const recordsCsv = [
      "type,entity_type,movie_name,release_date",
      "watch,movie,君の名は。,2016-08-26 00:00:00",
    ].join("\n");

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({
        episodesCsv: EMPTY_EPISODES,
        showsCsv: EMPTY_SHOWS,
        recordsCsv,
      }),
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.report!.movies.imported).toBe(1);
    expect(job.report!.movies.unresolved).toEqual([]);
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "372058",
      "MOVIE",
    );
  });

  it("reports unresolved movies with their watched/watchlist flag", async () => {
    const { tmdb, service } = makeMocks();
    tmdb.search.mockResolvedValue([]); // nothing matches → both unresolved

    const recordsCsv = [
      "type,entity_type,movie_name,release_date",
      "watch,movie,Seen Film,2020-01-01 00:00:00",
      "towatch,movie,Later Film,",
    ].join("\n");

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({
        episodesCsv: EMPTY_EPISODES,
        showsCsv: EMPTY_SHOWS,
        recordsCsv,
      }),
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.report!.movies.unresolved).toEqual(
      expect.arrayContaining([
        { title: "Seen Film", year: 2020, watched: true },
        { title: "Later Film", year: null, watched: false },
      ]),
    );
  });

  it("overwrite wipes the user's history and library before a real import", async () => {
    const { prisma, tmdb, service } = makeMocks();
    tmdb.findSeriesByTvdbId.mockResolvedValue(null); // resolution outcome is irrelevant here

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
      importMovies: false,
      overwrite: true,
    };
    const { id } = service.startImport("u1", dto);
    const job = await runToEnd(service, "u1", id);

    expect(job.status).toBe("completed");
    expect(job.report!.overwrite).toBe(true);
    expect(prisma.episodeWatch.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prisma.libraryEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("does not wipe anything on a dry run, even with overwrite", async () => {
    const { prisma, tmdb, service } = makeMocks();
    tmdb.findSeriesByTvdbId.mockResolvedValue(null);

    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
      importMovies: false,
      dryRun: true,
      overwrite: true,
    };
    const { id } = service.startImport("u1", dto);
    await runToEnd(service, "u1", id);

    expect(prisma.episodeWatch.deleteMany).not.toHaveBeenCalled();
    expect(prisma.libraryEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects an archive missing a required file", () => {
    const { service } = makeMocks();
    // No user_tv_show_data.csv → required file absent.
    const dto: StartTvTimeImportDto = {
      zipBase64: zipBase64({ episodesCsv: EPISODES_CSV }),
      importMovies: false,
    };
    expect(() => service.startImport("u1", dto)).toThrow(
      /user_tv_show_data\.csv/,
    );
  });
});
