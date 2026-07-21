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

## 0.6.0 — P4: activity feed & comments

- CI pipeline (GitHub Actions): lint/build/test/e2e/Docker build gates,
  Dependabot, CodeQL, Codecov.
- Social follow-ups (P4): private profiles now return a locked identity-only
  preview (with a request/cancel affordance) instead of a 404 — GHOST/blocked
  still 404, and no content leaves the server. A "Mon profil" nav entry opens
  your own profile as others see it. "Mes reviews" rows link to the work and
  support bulk delete / audience changes; the revision history shows each
  version's text. `/notifications` gained a followers/following network view.
- Social notifications: a generic `Notification` model powers in-app alerts for
  new followers, follow requests and approvals (alongside new-episode alerts).
- Reviews on detail pages: rate + write a critique (with audience) and read the
  community's reviews directly on each media/game/book/album page. The default
  review audience is now configurable from "Mes reviews".
- Profile bio is now editable from account settings (it was displayed but had
  no input).
- Activity feed (P4, increment 3): a materialised `ActivityEvent` log records
  library milestones (started/finished/dropped/added/favourited) and reviews
  across all four domains. A home feed at `/feed` (people you follow, binge-
  aggregated), a "Dernières activités" teaser on the home page, and a "Activité
  récente" timeline on each profile (visibility-filtered by the Activité facet).
- Comments (P4, increment 4): threaded discussion (flat + one reply level) on
  any work and, for series/anime, their individual seasons/episodes. Automatic
  spoiler masking compares the viewer's own progress (per-episode for
  season/episode targets, a binary "finished" gate for movies/games/books —
  albums are never masked, nothing to spoil), stacked with a manual tag; the
  reader can reveal a single blurred comment or turn off masking for the whole
  thread. Fixed 6-emote reactions (one per user/comment), @mentions and reply
  notifications reuse the existing `Notification` model and respect blocks.
  Reports are a polymorphic `Report` model (comments today, reviews/profiles
  ready for later) feeding a new `/admin/reports` moderation queue with a
  pending-count badge. The web app's first shared data-fetching layer,
  `@tanstack/svelte-query`, drives the thread (5s poll on the open thread only,
  paused when the tab is backgrounded).

## 0.5.0 — P4: social foundation & reviews

All of it is gated behind the runtime `SOCIAL_ENABLED` flag (off by default; a
single Docker image serves both modes), exposed to the web via `GET /api/config`.

- **Foundation**: `User.bio`/`profileAccess` (PUBLIC/PRIVATE/GHOST) and a
  `VisibilitySetting` matrix (per-domain × facet audience).
- **Social graph & profiles**: `Follow` (with private-profile approval) + `Block`,
  a central `VisibilityService`, public profiles at `/u/:username`, member search,
  and the account "Confidentialité" screen. Reusable identicon `Avatar`.
- **Reviews**: a `Review` model (mandatory /10 rating + optional text + audience)
  with edit history is now the single source of truth for ratings — the `rating`
  column was removed from every entry and projected from `Review` instead
  (rating your own items still works with social off). A "Mes reviews" management
  screen (`/reviews`) lists, edits and deletes them.
- Deferred within P4: social notifications (needs a generic `Notification` model),
  bio-editing UI, and the activity feed / comments / lists / Figurant increments.

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
