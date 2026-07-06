import {
  selectNewEpisodeNotifications,
  type CandidateEpisode,
} from "./notification.util";

const base: Omit<CandidateEpisode, "episodeId" | "airDate"> = {
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  mediaTitle: "My Show",
  mediaType: "SERIES",
  sourceId: "500",
};

describe("selectNewEpisodeNotifications", () => {
  const now = new Date("2026-07-06T12:00:00Z");
  const since = new Date("2026-06-22T12:00:00Z"); // 14 days earlier

  it("keeps only episodes aired within (since, now], mapped to payloads", () => {
    const candidates: CandidateEpisode[] = [
      { ...base, episodeId: "recent", airDate: new Date("2026-07-05T00:00:00Z") },
      { ...base, episodeId: "old", airDate: new Date("2026-01-01T00:00:00Z") },
      { ...base, episodeId: "future", airDate: new Date("2026-07-20T00:00:00Z") },
    ];

    const result = selectNewEpisodeNotifications(candidates, {
      since,
      now,
      alreadyNotified: new Set(),
    });

    expect(result.map((n) => n.episodeId)).toEqual(["recent"]);
    expect(result[0]).toEqual({
      episodeId: "recent",
      mediaTitle: "My Show",
      mediaType: "SERIES",
      sourceId: "500",
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: "Pilot",
    });
  });

  it("skips episodes already notified", () => {
    const candidates: CandidateEpisode[] = [
      { ...base, episodeId: "a", airDate: new Date("2026-07-05T00:00:00Z") },
      { ...base, episodeId: "b", airDate: new Date("2026-07-04T00:00:00Z") },
    ];

    const result = selectNewEpisodeNotifications(candidates, {
      since,
      now,
      alreadyNotified: new Set(["a"]),
    });

    expect(result.map((n) => n.episodeId)).toEqual(["b"]);
  });

  it("excludes an episode aired exactly at the window start (exclusive)", () => {
    const result = selectNewEpisodeNotifications(
      [{ ...base, episodeId: "edge", airDate: since }],
      { since, now, alreadyNotified: new Set() },
    );
    expect(result).toEqual([]);
  });
});
