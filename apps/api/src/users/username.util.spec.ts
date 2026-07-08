import { randomUsernameSuffix, slugifyUsername } from "./username.util";

describe("slugifyUsername", () => {
  it("lowercases and strips separators", () => {
    expect(slugifyUsername("Logan Willem")).toBe("loganwillem");
  });

  it("strips accents", () => {
    expect(slugifyUsername("Émile Zoé")).toBe("emilezoe");
  });

  it("falls back to a default when nothing alphanumeric remains", () => {
    expect(slugifyUsername("!!!")).toBe("user");
  });

  it("truncates to 30 characters", () => {
    const long = "a".repeat(50);
    expect(slugifyUsername(long)).toHaveLength(30);
  });
});

describe("randomUsernameSuffix", () => {
  it("produces the requested length of alphanumeric characters", () => {
    const suffix = randomUsernameSuffix(4);
    expect(suffix).toMatch(/^[a-z0-9]{4}$/);
  });
});
