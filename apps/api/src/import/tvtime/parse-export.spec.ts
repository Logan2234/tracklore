import { parseTvTimeExport } from "./parse-export";

// Minimal headers mirroring the real TV Time files (only the columns the parser
// reads need to be present).
const EPISODES_HEADER =
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at";
const REWATCHED_HEADER = "episode_id,cpt";
const SHOWS_HEADER = "tv_show_name,tv_show_id,nb_episodes_seen";
const RECORDS_HEADER = "type,entity_type,movie_name,release_date";

describe("parseTvTimeExport", () => {
  it("groups watched episodes per show and dedups the repeated rows", () => {
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
      "Doctor Who,295295,1,2,78804,fill-previous,2023-12-29 01:07:03", // dup episode
      "Doctor Who,295298,1,5,78804,,2024-01-02 10:00:00",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv });

    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({ tvdbId: "78804", name: "Doctor Who" });
    expect(shows[0].episodes).toHaveLength(2);
    const ep2 = shows[0].episodes.find((e) => e.episode === 2)!;
    expect(ep2.season).toBe(1);
    expect(ep2.totalWatches).toBe(1);
    // Earliest of the two duplicate rows wins.
    expect(ep2.watchedAt?.toISOString()).toBe("2023-12-29T01:07:02.000Z");
  });

  it("folds rewatch counts into totalWatches (base + cpt)", () => {
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");
    const rewatchedCsv = [REWATCHED_HEADER, "295295,2"].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, rewatchedCsv });

    expect(shows[0].episodes[0].totalWatches).toBe(3); // 1 + 2 rewatches
  });

  it("ignores season-summary rows", () => {
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,999,1,0,78804,season,2023-12-29 01:07:02",
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv });

    expect(shows[0].episodes).toHaveLength(1);
    expect(shows[0].episodes[0].episode).toBe(2);
  });

  it("adds never-started followed shows as empty watchlist entries", () => {
    const showsCsv = [
      SHOWS_HEADER,
      "Watched Show,78804,5",
      "Planned Show,12345,0",
    ].join("\n");
    const episodesCsv = [
      EPISODES_HEADER,
      "Watched Show,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, showsCsv });

    const planned = shows.find((s) => s.tvdbId === "12345")!;
    expect(planned.name).toBe("Planned Show");
    expect(planned.episodes).toHaveLength(0);
  });

  it("prefers the show name from user_tv_show_data over the v2 series_name", () => {
    const showsCsv = [SHOWS_HEADER, "Doctor Who (2005),78804,5"].join("\n");
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, showsCsv });

    expect(shows[0].name).toBe("Doctor Who (2005)");
  });

  it("classifies movies as watched or watchlist and parses the year", () => {
    const recordsCsv = [
      RECORDS_HEADER,
      "follow,movie,The Batman,2022-03-02 00:00:00",
      "watch,movie,The Batman,2022-03-02 00:00:00", // same movie, now watched
      "towatch,movie,Dune,2021-09-15 00:00:00",
      "follow,episode,Not A Movie,", // ignored (wrong entity_type)
    ].join("\n");

    const { movies } = parseTvTimeExport({ recordsCsv });

    expect(movies).toHaveLength(2);
    const batman = movies.find((m) => m.title === "The Batman")!;
    expect(batman).toEqual({ title: "The Batman", year: 2022, watched: true });
    const dune = movies.find((m) => m.title === "Dune")!;
    expect(dune).toEqual({ title: "Dune", year: 2021, watched: false });
  });
});
