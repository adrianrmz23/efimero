import { describe, expect, it } from "vitest";
import { parseIdeas, rankTrends } from "@/lib/prayerIdeas";
import { pickCardTheme } from "@/lib/prayerCard";

describe("prayer ideas", () => {
  it("parses ideas and defaults the kind to prayer", () => {
    const ideas = parseIdeas('{"ideas":[{"topic":"Salmo 91 para la protección","kind":"psalm","hook":"h","why":"w"},{"topic":"Oración por el trabajo","kind":"x"},{"topic":""}]}');
    expect(ideas.map(i => i.kind)).toEqual(["psalm", "prayer"]);
  });
  it("ranks trends by views without duplicates", () => {
    const items = [{ id: "a", title: "A", channel: "c", publishedAt: "" }, { id: "b", title: "B", channel: "c", publishedAt: "" }, { id: "a", title: "A", channel: "c", publishedAt: "" }];
    expect(rankTrends(items, { a: 10, b: 500 }).map(t => t.title)).toEqual(["B", "A"]);
  });
});

describe("card themes", () => {
  it("picks the Marian theme for the Virgin and a different one when asked for another", () => {
    expect(pickCardTheme("Oración a la Virgen del Carmen")).toBe("marian");
    expect(pickCardTheme("Oración a la Virgen del Carmen", "marian")).not.toBe("marian");
  });
});

describe("corrupted text", () => {
  it("flags CJK characters and glued words, not normal Spanish or hashtags", async () => {
    const { looksCorrupted } = await import("@/lib/textQuality");
    expect(looksCorrupted("las oraciones más frecuentes en el的手机FB de Latinoamérica")).toBe(true);
    expect(looksCorrupted("Salmo 45 paraIKI la crisis del matrimonio")).toBe(true);
    expect(looksCorrupted("Oración a la Virgen del Carmen por los hijos 🙏 #Shorts #virgenDelCarmen en YouTube y WhatsApp")).toBe(false);
  });
});
