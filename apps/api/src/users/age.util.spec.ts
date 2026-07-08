import { filterAdultContent, isAdult } from "./age.util";

describe("isAdult", () => {
  const today = new Date("2026-07-08T12:00:00Z");

  it("is false when birth date is unknown", () => {
    expect(isAdult(null, today)).toBe(false);
  });

  it("is true once the 18th birthday has passed", () => {
    expect(isAdult(new Date("2008-07-08"), today)).toBe(true);
    expect(isAdult(new Date("2008-01-01"), today)).toBe(true);
  });

  it("is false the day before the 18th birthday", () => {
    expect(isAdult(new Date("2008-07-09"), today)).toBe(false);
  });

  it("is false for a minor", () => {
    expect(isAdult(new Date("2010-01-01"), today)).toBe(false);
  });
});

describe("filterAdultContent", () => {
  const items = [
    { id: 1, isAdult: false },
    { id: 2, isAdult: true },
  ];

  it("keeps everything when allowed", () => {
    expect(filterAdultContent(items, true)).toEqual(items);
  });

  it("strips adult items when not allowed", () => {
    expect(filterAdultContent(items, false)).toEqual([
      { id: 1, isAdult: false },
    ]);
  });
});
