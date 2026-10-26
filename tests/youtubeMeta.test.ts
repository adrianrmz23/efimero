import { describe, expect, it } from "vitest";
import { parseYoutubeMeta } from "@/lib/youtubeMeta";

describe("parseYoutubeMeta", () => {
  it("keeps the title under 100 characters with #Shorts and dedupes tags", () => {
    const long = "Oración ".repeat(20) + "#Shorts";
    const d = parseYoutubeMeta(`Aquí: {"title":"${long}","description":"Reza <con> calma.","tags":["#Oración","oración","fe"]}`);
    expect(d.title.length).toBeLessThanOrEqual(100);
    expect(d.title.endsWith("#Shorts")).toBe(true);
    expect(d.tags).toEqual(["oración", "fe"]);
    expect(d.description).toBe("Reza con calma.");
  });
  it("fails without a title", () => {
    expect(() => parseYoutubeMeta('{"title":"","description":"x"}')).toThrow();
  });
});
