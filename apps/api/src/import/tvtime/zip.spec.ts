import { makeZip } from "./make-zip";
import { readZipEntries } from "./zip";

describe("readZipEntries", () => {
  it("extracts wanted entries, decoding both STORED and DEFLATE", () => {
    const zip = makeZip([
      { name: "a.csv", content: "hello,world", method: 0 }, // stored
      { name: "b.csv", content: "x".repeat(500), method: 8 }, // deflated
    ]);

    const out = readZipEntries(zip, new Set(["a.csv", "b.csv"]));
    expect(out.get("a.csv")).toBe("hello,world");
    expect(out.get("b.csv")).toBe("x".repeat(500));
  });

  it("matches by base name, case-insensitively, ignoring folders", () => {
    const zip = makeZip([
      { name: "gdpr-data/User_TV_Show_Data.csv", content: "col\nval" },
    ]);

    const out = readZipEntries(zip, new Set(["user_tv_show_data.csv"]));
    expect(out.get("user_tv_show_data.csv")).toBe("col\nval");
  });

  it("skips entries that are not wanted", () => {
    const zip = makeZip([
      { name: "keep.csv", content: "yes" },
      { name: "drop.csv", content: "no" },
    ]);

    const out = readZipEntries(zip, new Set(["keep.csv"]));
    expect(out.has("keep.csv")).toBe(true);
    expect(out.has("drop.csv")).toBe(false);
    expect(out.size).toBe(1);
  });

  it("throws on a buffer that is not a ZIP archive", () => {
    expect(() => readZipEntries(Buffer.from("not a zip"), new Set())).toThrow(
      /not a zip/i,
    );
  });
});
