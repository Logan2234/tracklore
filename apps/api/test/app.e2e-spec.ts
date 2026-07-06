import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { CatalogSource, MediaSource, MediaType } from "@tracklore/shared";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { AnilistProvider } from "./../src/catalog/providers/anilist.provider";
import type { ProviderMediaDetails } from "./../src/catalog/providers/provider.types";
import { TmdbProvider } from "./../src/catalog/providers/tmdb.provider";
import { PrismaService } from "./../src/prisma/prisma.service";

const ANIME_SUMMARY = {
  source: CatalogSource.ANILIST,
  sourceId: "4242",
  type: MediaType.ANIME,
  title: "Test Anime",
  year: 2024,
  posterUrl: "https://example.com/poster.jpg",
};

const FUTURE_AIR_DATE = new Date(
  Date.now() + 30 * 24 * 60 * 60 * 1000,
).toISOString();

const ANIME_DETAILS: ProviderMediaDetails = {
  summary: ANIME_SUMMARY,
  overview: "An anime used by the e2e suite.",
  backdropUrl: null,
  genres: ["Fantasy"],
  status: "FINISHED",
  releaseDate: "2024-01-05",
  externalIds: [{ source: MediaSource.ANILIST, externalId: "4242" }],
  seasons: [
    {
      number: 1,
      title: null,
      episodes: [
        { number: 1, title: "Episode 1", airDate: null },
        { number: 2, title: "Episode 2", airDate: null },
        // A future air date so the release calendar has something to return.
        { number: 3, title: "Episode 3", airDate: FUTURE_AIR_DATE },
      ],
    },
  ],
};

// External catalogues are stubbed: e2e exercises our API + database, not TMDB/AniList.
// getDetails echoes the requested id so different sourceIds yield distinct media.
const anilistStub = {
  source: CatalogSource.ANILIST,
  search: jest.fn().mockResolvedValue([ANIME_SUMMARY]),
  getDetails: jest.fn().mockImplementation((sourceId: string) =>
    Promise.resolve({
      ...ANIME_DETAILS,
      summary: { ...ANIME_SUMMARY, sourceId },
      externalIds: [{ source: MediaSource.ANILIST, externalId: sourceId }],
    }),
  ),
};
const tmdbStub = {
  source: CatalogSource.TMDB,
  search: jest.fn().mockResolvedValue([]),
  getDetails: jest.fn(),
};

describe("Tracklore API (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  const user = {
    email: "e2e@tracklore.test",
    password: "e2e-password-1",
    displayName: "E2E",
  };
  let accessToken: string;
  let refreshToken: string;
  let entryId: string;
  let firstEpisodeId: string;
  let firstSeasonId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TmdbProvider)
      .useValue(tmdbStub)
      .overrideProvider(AnilistProvider)
      .useValue(anilistStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    // Start from a clean e2e schema (cascades cover the child tables).
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
    await prisma.mediaItem.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a new account", async () => {
    const response = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);

    expect(response.body.user).toMatchObject({
      email: user.email,
      displayName: "E2E",
    });
    expect(response.body.tokens.accessToken).toBeDefined();
  });

  it("rejects a duplicate email", () => {
    return request(http).post("/api/auth/register").send(user).expect(409);
  });

  it("logs in and returns tokens", async () => {
    const response = await request(http)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    accessToken = response.body.tokens.accessToken;
    refreshToken = response.body.tokens.refreshToken;
    expect(accessToken).toBeDefined();
  });

  it("rejects unauthenticated access to the library", () => {
    return request(http).get("/api/library").expect(401);
  });

  it("returns the profile of the authenticated user", async () => {
    const response = await request(http)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      email: user.email,
      entitlements: [],
    });
  });

  it("searches the catalog (stubbed providers)", async () => {
    const response = await request(http)
      .get("/api/catalog/search?q=test&type=ANIME")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.results).toEqual([ANIME_SUMMARY]);
  });

  it("tracks a media: first touch persists it with seasons and episodes", async () => {
    const response = await request(http)
      .put("/api/library")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        source: "ANILIST",
        sourceId: "4242",
        type: "ANIME",
        status: "WATCHING",
      })
      .expect(200);

    entryId = response.body.id;
    expect(response.body.mediaItem.title).toBe("Test Anime");
    expect(response.body.mediaItem.sourceId).toBe("4242");
    // Status is derived: nothing watched yet → PLANNED, regardless of the
    // WATCHING sent in the request.
    expect(response.body.status).toBe("PLANNED");
    expect(response.body.progress).toMatchObject({
      watchedEpisodes: 0,
      totalEpisodes: 3,
    });
  });

  it("lists the library with the new entry", async () => {
    const response = await request(http)
      .get("/api/library?type=ANIME")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(entryId);
  });

  it("exposes the persisted episodes of the entry", async () => {
    const response = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.seasons).toHaveLength(1);
    expect(response.body.seasons[0].episodes).toHaveLength(3);
    firstSeasonId = response.body.seasons[0].id;
    firstEpisodeId = response.body.seasons[0].episodes[0].id;
    expect(response.body.seasons[0].episodes[0].watchCount).toBe(0);
  });

  it("marks an episode as watched and updates progress", async () => {
    await request(http)
      .post(`/api/library/episodes/${firstEpisodeId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
    expect(entry.body.status).toBe("WATCHING"); // 1 of 3 → in progress
  });

  it("supports rewatches: same episode again bumps the count, not the progress", async () => {
    await request(http)
      .post(`/api/library/episodes/${firstEpisodeId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ rating: 9 })
      .expect(201);

    const episodes = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(episodes.body.seasons[0].episodes[0].watchCount).toBe(2);

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
  });

  it("marks a whole season without inflating already-watched episodes", async () => {
    // Episode 1 is already watched (twice); watchSeason fills only 2 and 3.
    await request(http)
      .post(`/api/library/seasons/${firstSeasonId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const episodes = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const eps = episodes.body.seasons[0].episodes;
    expect(eps.every((e: { watchCount: number }) => e.watchCount > 0)).toBe(true);
    expect(eps[0].watchCount).toBe(2); // episode 1 not re-watched by the bulk mark

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // All episodes watched + FINISHED airing → COMPLETED (not UP_TO_DATE).
    expect(entry.body.status).toBe("COMPLETED");
  });

  it("returns upcoming episodes of tracked series in the calendar", async () => {
    const response = await request(http)
      .get("/api/library/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Only episode 3 has a future air date.
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 3,
      episodeTitle: "Episode 3",
    });
    expect(response.body[0].mediaItem.title).toBe("Test Anime");
  });

  it("serves the unified media page with metadata + the user's state", async () => {
    await request(http).get("/api/media/anime/4242").expect(401);

    const response = await request(http)
      .get("/api/media/anime/4242")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.title).toBe("Test Anime");
    expect(response.body.airingFinished).toBe(true);
    expect(response.body.seasons[0].episodes[0].watchCount).toBeGreaterThan(0);
    expect(response.body.entry).not.toBeNull();
    expect(response.body.entry.status).toBe("COMPLETED");
  });

  it("keeps a manual pause override until the user resumes", async () => {
    await request(http)
      .patch(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "PAUSED" })
      .expect(200);

    const paused = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Override wins even though every episode is watched.
    expect(paused.body.status).toBe("PAUSED");

    // Resume → back to the derived status.
    await request(http)
      .patch(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "WATCHING" })
      .expect(200);
    const resumed = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(resumed.body.status).toBe("COMPLETED");
  });

  it("marks episodes through a chosen one, excluding specials", async () => {
    // A fresh media so earlier watches don't interfere.
    const created = await request(http)
      .put("/api/library")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ source: "ANILIST", sourceId: "5555", type: "ANIME" })
      .expect(200);
    const newEntryId = created.body.id;

    const before = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const eps = before.body.seasons[0].episodes;

    // Watch through episode 2 → episodes 1 and 2, not 3.
    await request(http)
      .post(`/api/library/episodes/${eps[1].id}/watch-through`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const counts = after.body.seasons[0].episodes.map(
      (e: { watchCount: number }) => e.watchCount,
    );
    expect(counts).toEqual([1, 1, 0]);

    const entry = await request(http)
      .get(`/api/library/entries/${newEntryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 2,
      totalEpisodes: 3,
    });
    expect(entry.body.status).toBe("WATCHING");

    // Undo watching episode 2 → back to 1 watched.
    await request(http)
      .delete(`/api/library/episodes/${eps[1].id}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const undone = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      undone.body.seasons[0].episodes.map((e: { watchCount: number }) => e.watchCount),
    ).toEqual([1, 0, 0]);

    // #4 "Resume": next up is now episode 2 (first unwatched, released).
    const resume = await request(http)
      .get(`/api/library/entries/${newEntryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(resume.body.progress.nextEpisode).toMatchObject({
      episodeId: eps[1].id,
      episodeNumber: 2,
    });

    // The media detail exposes each viewing (date + rating); rate one of them.
    const detail = await request(http)
      .get(`/api/media/anime/5555`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const firstEp = detail.body.seasons[0].episodes[0];
    expect(firstEp.watches).toHaveLength(1);
    const watchId: string = firstEp.watches[0].id;
    expect(firstEp.watches[0].rating).toBeNull();

    await request(http)
      .patch(`/api/library/watches/${watchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ rating: 8 })
      .expect(204);

    const rated = await request(http)
      .get(`/api/media/anime/5555`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(rated.body.seasons[0].episodes[0].watches[0].rating).toBe(8);
  });

  it("notifications: scan and feed respond", async () => {
    const scan = await request(http)
      .post("/api/notifications/scan")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(Array.isArray(scan.body.notifications)).toBe(true);
    expect(typeof scan.body.unread).toBe("number");

    await request(http)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(http)
      .post("/api/notifications/read")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });

  it("rotates refresh tokens: the old one is consumed", async () => {
    const response = await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    const newRefreshToken: string = response.body.tokens.refreshToken;
    expect(newRefreshToken).toBeDefined();

    // The consumed token must be rejected.
    await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    refreshToken = newRefreshToken;
  });

  it("logs out: the refresh token becomes unusable", async () => {
    await request(http)
      .post("/api/auth/logout")
      .send({ refreshToken })
      .expect(204);
    await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });
});
