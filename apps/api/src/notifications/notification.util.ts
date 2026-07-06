import type { MediaType } from "@tracklore/shared";

/** A released episode of a tracked show, considered for a notification. */
export interface CandidateEpisode {
  episodeId: string;
  airDate: Date;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  mediaTitle: string;
  mediaType: MediaType;
  sourceId: string;
}

/** The payload persisted as a Notification row (minus user/read/date). */
export interface NewEpisodeNotification {
  episodeId: string;
  mediaTitle: string;
  mediaType: MediaType;
  sourceId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
}

/**
 * Pick episodes newly released within `(since, now]` and not already notified.
 * Pure so the detection window + dedup are unit-testable without a database.
 * The window bounds how far back we look, so following an old show never floods
 * the user with notifications for episodes that aired long ago.
 */
export function selectNewEpisodeNotifications(
  candidates: CandidateEpisode[],
  opts: { since: Date; now: Date; alreadyNotified: Set<string> },
): NewEpisodeNotification[] {
  const { since, now, alreadyNotified } = opts;
  return candidates
    .filter(
      (e) =>
        e.airDate > since &&
        e.airDate <= now &&
        !alreadyNotified.has(e.episodeId),
    )
    .map((e) => ({
      episodeId: e.episodeId,
      mediaTitle: e.mediaTitle,
      mediaType: e.mediaType,
      sourceId: e.sourceId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      episodeTitle: e.episodeTitle,
    }));
}
