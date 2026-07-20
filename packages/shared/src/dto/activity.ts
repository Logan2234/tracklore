import type { ActivityType, Domain } from "../enums";

/** Minimal identity of the person an activity event belongs to. */
export interface ActivityActorDto {
  username: string;
  displayName: string;
}

/** Granularity of an activity event's target, per the feed matrix. */
export type ActivityLevel = "WORK" | "SEASON" | "EPISODE";

/** One activity-feed event (post-visibility), with its target snapshot. */
export interface ActivityEventDto {
  id: string;
  type: ActivityType;
  domain: Domain;
  /** "MEDIA" | "GAME" | "BOOK" | "MUSIC" — the work's domain, singular. */
  targetType: string;
  level: ActivityLevel;
  /** Denormalised target snapshot at emit time. */
  title: string;
  imageUrl: string | null;
  /** Client link to the work, or null. */
  href: string | null;
  /** Kind-specific extras: `{ rating }`, `{ seasonNumber, episodeNumber }`… */
  data: Record<string, unknown>;
  createdAt: string;
  actor: ActivityActorDto;
  /**
   * How many like events were collapsed into this one (read-time aggregation of
   * a binge). 1 for a standalone event; >1 for an aggregated PROGRESS run.
   */
  count: number;
}

/** A page of activity events, newest first. */
export interface ActivityFeedDto {
  events: ActivityEventDto[];
  /** Opaque cursor for the next page, or null when there are no more. */
  nextCursor: string | null;
}
