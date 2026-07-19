# Changelog

All notable changes to this project are documented here, grouped by the
roadmap phase they belong to (see `README.md` → Roadmap). No tagged releases
exist yet — the `version` field in `package.json` (root + every
`apps/*`/`packages/*`, kept in lockstep) is the current record of where the
app stands; see `CLAUDE.md` → Conventions for the versioning rule.

This file starts from the current state and is updated going forward on each
version bump — it does not attempt to reconstruct exhaustive history prior to
this point beyond the roadmap phases already documented in the README.

## [Unreleased]

- CI pipeline (GitHub Actions): lint/build/test/e2e/Docker build gates,
  Dependabot, CodeQL, Codecov.

## 0.4.0 — P3: games, books & music

- Games module (IGDB catalogue): library, statuses, playtime, Steam import,
  community ratings.
- Books module (Google Books catalogue): library, reading progress,
  StoryGraph/Goodreads import.
- Music module (MusicBrainz catalogue): library, listen status.
- Unified global search across all domains; `enabledDomains` enforced
  server-side on search/stats, and filters notifications.
- Unified async import framework — all sources (TV Time, StoryGraph,
  Goodreads, Steam) on one job engine with manual match-correction.

## 0.1.0 — P1 MVP, P1.5 TV Time import, P2 notifications

- P1: auth, search, tracking, episode progress, PWA, Docker self-host.
- P1.5: interactive TV Time import (analyze → review collection by
  collection → commit), matched through TVDB IDs, source-agnostic pipeline.
- P2: in-app notifications, periodic scan of tracked shows, Web Push,
  transactional/notification email via SMTP, PWA mobile access via ngrok.
  Native (Capacitor) wrapper still outstanding.
