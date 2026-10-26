import { describe, expect, it } from "vitest";
import { mergeVisuals, parseDevotional, visualPlan } from "@/lib/devotional";

describe("parseDevotional", () => {
  it("reads the script and keeps up to 7 support images", () => {
    const raw = 'Listo: {"title":"Oración por los hijos","cardTitle":"","cover":"POR TUS HIJOS","coverWord":"HIJOS","caption":"Para ti","hero":"Virgin Mary","support":["a","b","c","d","e","f","g","h"],"lines":["Uno.","Dos.","Tres.","Amén."]}';
    const d = parseDevotional(raw);
    expect(d.cardTitle).toBe("Oración por los hijos");
    expect(d.support).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(d.lines).toHaveLength(4);
  });
  it("rejects incomplete output", () => {
    expect(() => parseDevotional('{"hero":"","lines":["a","b","c"]}')).toThrow();
  });
});

describe("visual plan", () => {
  it("opens and closes with the hero and alternates supports", () => {
    expect(visualPlan(7, 2)).toEqual(["hero", 0, "hero", 1, "hero", 0, "hero"]);
    expect(visualPlan(4, 0)).toEqual(["hero", "hero", "hero", "hero"]);
    expect(visualPlan(5, 3, true)).toEqual(["hero", "hero", "hero", "hero", "hero"]);
  });
  it("merges consecutive parts with the same image", () => {
    expect(mergeVisuals(visualPlan(6, 2), [3, 4, 5, 6, 7, 8])).toEqual([{ visual: "hero", duration: 3 }, { visual: 0, duration: 4 }, { visual: "hero", duration: 5 }, { visual: 1, duration: 6 }, { visual: "hero", duration: 15 }]);
    expect(mergeVisuals(visualPlan(3, 0), [2, 2, 2])).toEqual([{ visual: "hero", duration: 6 }]);
  });
});

describe("image variety", () => {
  it("gives each middle part its own image when there are enough", () => {
    expect(visualPlan(8, 6)).toEqual(["hero", 0, 1, 2, 3, 4, 5, "hero"]);
  });
  it("spreads extra support images so none is wasted", () => {
    const plan = visualPlan(8, 4);
    expect(plan[0]).toBe("hero"); expect(plan[7]).toBe("hero");
    expect(plan.filter(v => v !== "hero")).toEqual([0, 1, 2, 3]);
  });
});

describe("support images tied to lines", () => {
  it("reads {line, image} supports and places each one on its line", () => {
    const d = parseDevotional('{"title":"Salmo 23","hero":"Jesus","support":[{"line":3,"image":"pastures"},{"line":5,"image":"valley"},"loose"],"lines":["a","b","c","d","e","f","g"]}');
    expect(d.support).toEqual(["pastures", "valley", "loose"]);
    expect(d.supportLines).toEqual([2, 4, -1]);
    expect(visualPlan(7, 3, false, d.supportLines)).toEqual(["hero", "hero", 0, "hero", 1, "hero", "hero"]);
  });
  it("ignores line numbers outside the middle parts", () => {
    expect(visualPlan(6, 2, false, [0, 5])).toEqual(["hero", 0, "hero", 1, "hero", "hero"]);
  });
});
