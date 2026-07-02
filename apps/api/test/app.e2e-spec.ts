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
        { number: 3, title: "Episode 3", airDate: null },
      ],
    },
  ],
};

// External catalogues are stubbed: e2e exercises our API + database, not TMDB/AniList.
const anilistStub = {
  source: CatalogSource.ANILIST,
  search: jest.fn().mockResolvedValue([ANIME_SUMMARY]),
  getDetails: jest.fn().mockResolvedValue(ANIME_DETAILS),
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
    expect(response.body.status).toBe("WATCHING");
    expect(response.body.progress).toEqual({
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
    expect(entry.body.progress).toEqual({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
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
    expect(entry.body.progress).toEqual({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
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
