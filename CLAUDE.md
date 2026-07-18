# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install                                   # workspace-wide
pnpm dev                                       # api on :3000 + web on :5173 (parallel)
pnpm build                                     # builds packages/* first, then apps/*
pnpm --filter @tracklore/shared build          # REQUIRED after any change in packages/shared
                                               # (api and web consume its dist/, not its sources)

# API
pnpm --filter @tracklore/api test              # unit tests (jest)
pnpm --filter @tracklore/api exec jest src/catalog/providers/tmdb.provider.spec.ts   # single file
pnpm --filter @tracklore/api test:e2e          # full API flow; needs the dev Postgres running
pnpm --filter @tracklore/api exec prisma migrate dev --name <name>   # after editing schema.prisma

# Web
pnpm --filter @tracklore/web check             # svelte-check (type errors in .svelte files)

# Self-host stack
docker compose up -d --build                   # db + api + web (see .env.example)
```

Dev database: Docker container `tracklore-dev-db`, Postgres 17 on port **5433**
(5432 is taken by an unrelated project on this machine). Connection string lives
in `apps/api/.env` (copy from `.env.example`). e2e tests reuse that server but
run in an isolated `e2e` schema (see `apps/api/test/global-setup.js`), so they
never touch dev data.

`TMDB_API_TOKEN` empty means movie/series search fails at runtime; anime
(AniList) needs no key. Unit tests stub all HTTP, so they always pass offline.

## Architecture

pnpm monorepo, 100% TypeScript: `apps/api` (NestJS + Prisma + PostgreSQL),
`apps/web` (SvelteKit PWA), `packages/shared` (DTOs/enums used by both).

**The database is an on-demand cache, not a catalogue mirror.** Searching hits
TMDB/AniList live and persists nothing. A `MediaItem` (with its `Season`s,
`Episode`s and `MediaExternalId`s) is created only when a user first references
the media — the single entry point is `MediaItemService.upsertFromSource()`
(`apps/api/src/catalog/media-item.service.ts`), called by `LibraryService` on
entry upsert. Refreshes are throttled by `lastSyncedAt` (24h TTL) and never
delete seasons/episodes, so `EpisodeWatch` rows always keep a valid target.

**Catalogue providers** (`apps/api/src/catalog/providers/`) implement a common
`CatalogProvider` interface. TMDB serves MOVIE/SERIES, AniList serves ANIME.
TMDB movie and TV IDs live in separate namespaces, so every details/upsert call
carries a `MediaType`; AniList implies ANIME (see `resolveType` in
`catalog.controller.ts`). AniList has no per-episode listing: episodes are
generated 1..N as a single season, titles from `streamingEpisodes` when
available.

**External IDs are multi-source** (`MediaExternalId`: TMDB, ANILIST, TVDB,
IMDB) — TVDB is deliberately captured from TMDB responses because the planned
TV Time import (roadmap P1.5) reconciles through TVDB IDs. The user's TV Time
GDPR export sits in `C:\Users\logan\Downloads\gdpr-data\` (CSV). The import
must be interactive: ask the user collection by collection what to keep.

**Watch model:** one `EpisodeWatch` row per viewing — rewatches are additional
rows, never an update. Progress (computed in `LibraryService.computeProgress`)
counts distinct watched episodes and excludes season 0 (TMDB specials).

**Auth:** access JWT (15 min) + rotating refresh tokens, one `RefreshToken` row
per device, SHA-256 hashed. `JwtAuthGuard` is registered globally in
`app.module.ts`; opt out with `@Public()`. Handlers read the user from
`@CurrentUser()` (JWT payload, `sub` = user id). `User.entitlements` (Json) is
the open-core seam — unused in MVP, don't remove it.

**Shared enums** (`packages/shared/src/enums.ts`) are `as const` objects, not
TS enums, and Prisma declares parallel enums with identical values in
`schema.prisma`. They must stay in sync; boundaries cast (`source as
DbExternalSource`) rather than map.

**Web app runs as SPA** (`export const ssr = false` in `+layout.ts`): tokens in
localStorage, auto-refresh-and-retry on 401 in `src/lib/api/client.ts`, auth
state via Svelte 5 runes in `src/lib/auth.svelte.ts` (runes mode is forced in
`vite.config.ts`, which also holds the SvelteKit + PWA config — there is no
`svelte.config.js`). API base URL comes from `PUBLIC_API_URL`
(`$env/dynamic/public`, resolved at server start, Docker-friendly).

**Docker:** both Dockerfiles copy _all_ workspace `package.json` manifests plus
`tsconfig.base.json` before `pnpm install --frozen-lockfile` (a frozen install
validates every importer in the lockfile). The api image runs
`prisma migrate deploy` at boot; the web runtime image ships only the
self-contained adapter-node `build/` output.

## Conventions

- UI strings are French; code, comments and commit messages are English.
- New runtime deps: prefer none — HTTP calls use global `fetch` (Node ≥22).
  pnpm blocks dependency build scripts by default: allow-list them in
  `pnpm-workspace.yaml` (`allowBuilds`) when a package needs a postinstall.
- Roadmap (README): P1 MVP ✓ → P1.5 TV Time import ✓ → P2 push/Capacitor
  (Web Push ✓, self-host mobile access via PWA + ngrok ✓, native Capacitor
  TODO) → **P3 games & books (current)** → P4 social → P5 hosted/entitlements.
  Don't implement ahead of the current phase.
- Versioning: no tagged releases, so the `version` field (root + every
  `apps/*`/`packages/*` package.json, kept in lockstep) is the only record of
  where the app stands. Bump the minor version whenever a roadmap phase above
  advances or a domain/module ships (e.g. 0.1.0 → P1, 0.2.0 → P1.5, 0.3.0 →
  P2, 0.4.0 → P3 under way with media/games/books/music built); patch for
  smaller fixes/polish once past 1.0. Reserve 1.0.0 for when the roadmap
  reaches P4+ and the app is stable enough to call finished, not a specific
  commit.
- Mobile: the app installs as a PWA. `docker-compose.ngrok.yml` + `Caddyfile`
  put web+api behind one origin and expose it via ngrok for phone access (set
  `NGROK_DOMAIN` in `.env`); see README "Mobile access". Single-user; a 2nd
  user means moving to a public host (VPS/PaaS).
- Before adding a new Svelte component, check `apps/web/src/lib/components/`
  (shared) and any route-local `components/` folder for one that already
  covers the need — extend or reuse it rather than writing a new one from
  scratch.
- Visual identity ("Séance" — fonts, palette, nav pattern): see
  `apps/web/DESIGN.md`.
