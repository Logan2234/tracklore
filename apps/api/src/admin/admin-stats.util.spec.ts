import {
  bucketize,
  cumulativeBucketize,
  TREND_BUCKETS,
  trendBucketStarts,
} from "./admin-stats.util";

describe("trendBucketStarts", () => {
  it("returns the configured bucket count per period", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(trendBucketStarts("day", now)).toHaveLength(TREND_BUCKETS.day);
    expect(trendBucketStarts("week", now)).toHaveLength(TREND_BUCKETS.week);
    expect(trendBucketStarts("month", now)).toHaveLength(TREND_BUCKETS.month);
    expect(trendBucketStarts("year", now)).toHaveLength(TREND_BUCKETS.year);
  });

  it("ends the day window on the current UTC midnight", () => {
    const now = new Date("2026-07-15T12:34:00.000Z");
    const starts = trendBucketStarts("day", now);
    expect(starts[starts.length - 1].toISOString()).toBe(
      "2026-07-15T00:00:00.000Z",
    );
    // 30 daily buckets → first is 29 days earlier.
    expect(starts[0].toISOString()).toBe("2026-06-16T00:00:00.000Z");
  });

  it("uses calendar month boundaries, including across a year edge", () => {
    const now = new Date("2026-02-10T00:00:00.000Z");
    const starts = trendBucketStarts("month", now);
    expect(starts[starts.length - 1].toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
    // 12 monthly buckets back → March of the previous year.
    expect(starts[0].toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("uses calendar year boundaries", () => {
    const now = new Date("2026-07-15T00:00:00.000Z");
    const starts = trendBucketStarts("year", now);
    expect(starts.map((s) => s.getUTCFullYear())).toEqual([
      2022, 2023, 2024, 2025, 2026,
    ]);
  });
});

describe("bucketize", () => {
  const starts = trendBucketStarts("day", new Date("2026-07-15T12:00:00.000Z"));

  it("returns zeroed buckets for no dates", () => {
    const out = bucketize([], starts);
    expect(out).toHaveLength(starts.length);
    expect(out.every((b) => b.count === 0)).toBe(true);
    expect(out[0].periodStart).toBe(starts[0].toISOString());
  });

  it("assigns each date to the bucket it falls in", () => {
    const out = bucketize(
      [
        new Date("2026-07-15T09:00:00.000Z"), // today
        new Date("2026-07-15T20:00:00.000Z"), // today too
        new Date("2026-07-14T01:00:00.000Z"), // yesterday
      ],
      starts,
    );
    expect(out[out.length - 1].count).toBe(2);
    expect(out[out.length - 2].count).toBe(1);
  });

  it("drops dates before the window", () => {
    const out = bucketize([new Date("2020-01-01T00:00:00.000Z")], starts);
    expect(out.every((b) => b.count === 0)).toBe(true);
  });
});

describe("cumulativeBucketize", () => {
  const starts = trendBucketStarts(
    "year",
    new Date("2026-07-15T00:00:00.000Z"),
  );

  it("carries the baseline forward and adds per bucket", () => {
    const out = cumulativeBucketize(
      [
        new Date("2025-05-01T00:00:00.000Z"),
        new Date("2026-01-02T00:00:00.000Z"),
        new Date("2026-06-01T00:00:00.000Z"),
      ],
      starts,
      10,
    );
    // buckets: 2022,2023,2024,2025,2026
    expect(out[0].count).toBe(10); // baseline, nothing in 2022
    expect(out[3].count).toBe(11); // +1 in 2025
    expect(out[4].count).toBe(13); // +2 in 2026
  });

  it("holds at the baseline when there are no dates", () => {
    const out = cumulativeBucketize([], starts, 5);
    expect(out.every((b) => b.count === 5)).toBe(true);
  });
});
