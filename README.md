# Tracklore

Self-hosted tracker for **series, movies and anime** — with games, books and
more planned. Built as a TV Time replacement you fully own: your data lives in
your own PostgreSQL, catalogues come live from [TMDB](https://www.themoviedb.org/)
(movies & series) and [AniList](https://anilist.co/) (anime).

## Stack

- **Monorepo** pnpm workspaces, 100% TypeScript
- `apps/api` — NestJS + Prisma + PostgreSQL (JWT auth, rotating refresh tokens)
- `apps/web` — SvelteKit PWA (installable, dark UI), talks to the API
- `packages/shared` — DTOs/enums shared between front and back

Key design choice: the database is an **on-demand cache**. Searching queries
TMDB/AniList live; a media is persisted (with its seasons, episodes and
external IDs — TMDB/AniList/TVDB/IMDB) only when a user tracks it. Episode
watches are stored **one row per viewing**, so rewatches are first-class.

## Self-hosting (Docker)

```sh
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, both JWT secrets and TMDB_API_TOKEN.
docker compose up -d --build
```

Then open http://localhost:8080 (or `WEB_PORT`), create an account, done.
On a NAS, set `PUBLIC_API_URL` and `WEB_ORIGIN` to the host's address
(e.g. `http://nas.local:3000/api` and `http://nas.local:8080`).

Upgrades: `git pull && docker compose up -d --build` — database migrations
run automatically when the API boots.

### TMDB API key

Create a free account on themoviedb.org, then copy the **API Read Access
Token (v4)** from Settings → API into `TMDB_API_TOKEN`. Anime search (AniList)
works without any key.

## Development

```sh
pnpm install
docker run -d --name tracklore-dev-db -e POSTGRES_USER=tracklore \
  -e POSTGRES_PASSWORD=tracklore -e POSTGRES_DB=tracklore \
  -p 5433:5432 postgres:17-alpine
cp apps/api/.env.example apps/api/.env   # then add your TMDB token
pnpm --filter @tracklore/api exec prisma migrate dev
pnpm --filter @tracklore/shared build
pnpm dev        # api on :3000, web on :5173
```

Tests:

```sh
pnpm --filter @tracklore/api test        # unit (provider mapping)
pnpm --filter @tracklore/api test:e2e    # full API flow, isolated "e2e" schema
```

## Roadmap

- **P1 — MVP** (current): auth, search, tracking, episode progress, PWA, Docker
- **P1.5** — TV Time import (interactive, collection by collection, via TVDB IDs)
- **P2** — Capacitor + push notifications ("new episode out")
- **P3** — games & books modules
- **P4** — social (friends, activity feed, shared lists)
- **P5** — hosted offer / entitlements (open core)

## License

AGPL-3.0 — self-host freely; run it as a service, share your changes.
