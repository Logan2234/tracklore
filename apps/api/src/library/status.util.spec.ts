import { deriveStatus, normalizeAiringFinished } from "./status.util";

describe("normalizeAiringFinished", () => {
  it("treats TMDB/AniList finished statuses as finished", () => {
    for (const s of ["Ended", "Canceled", "FINISHED", "CANCELLED"]) {
      expect(normalizeAiringFinished(s)).toBe(true);
    }
  });

  it("treats ongoing/unknown statuses as not finished", () => {
    for (const s of [
      "Returning Series",
      "RELEASING",
      "NOT_YET_RELEASED",
      "HIATUS",
      null,
    ]) {
      expect(normalizeAiringFinished(s)).toBe(false);
    }
  });
});

describe("deriveStatus", () => {
  const progress = (watched: number, total: number) => ({
    watchedEpisodes: watched,
    totalEpisodes: total,
  });

  describe("manual overrides win", () => {
    it("keeps PAUSED even when everything is watched", () => {
      expect(deriveStatus("ANIME", progress(12, 12), true, "PAUSED")).toBe(
        "PAUSED",
      );
    });
    it("keeps DROPPED even when episodes are watched", () => {
      expect(deriveStatus("SERIES", progress(3, 10), false, "DROPPED")).toBe(
        "DROPPED",
      );
    });
  });

  describe("movies", () => {
    it("is COMPLETED when stored status is COMPLETED (seen)", () => {
      expect(deriveStatus("MOVIE", null, false, "COMPLETED")).toBe("COMPLETED");
    });
    it("is PLANNED otherwise (never seen / stale WATCHING)", () => {
      expect(deriveStatus("MOVIE", null, false, "PLANNED")).toBe("PLANNED");
      expect(deriveStatus("MOVIE", null, false, "WATCHING")).toBe("PLANNED");
    });
  });

  describe("series / anime", () => {
    it("is PLANNED with no episodes listed", () => {
      expect(deriveStatus("SERIES", null, false, "WATCHING")).toBe("PLANNED");
      expect(deriveStatus("SERIES", progress(0, 0), false, "WATCHING")).toBe(
        "PLANNED",
      );
    });
    it("is PLANNED when nothing is watched", () => {
      expect(deriveStatus("SERIES", progress(0, 10), false, "WATCHING")).toBe(
        "PLANNED",
      );
    });
    it("is WATCHING when partially watched", () => {
      expect(deriveStatus("ANIME", progress(4, 12), false, "PLANNED")).toBe(
        "WATCHING",
      );
    });
    it("is UP_TO_DATE when fully watched but still airing", () => {
      expect(deriveStatus("SERIES", progress(10, 10), false, "PLANNED")).toBe(
        "UP_TO_DATE",
      );
    });
    it("is COMPLETED when fully watched and finished airing", () => {
      expect(deriveStatus("SERIES", progress(10, 10), true, "PLANNED")).toBe(
        "COMPLETED",
      );
    });
  });
});
