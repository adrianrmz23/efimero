import { describe, expect, it } from "vitest";
import { narrationOf, parseScript, sceneDurationsFromWords, subtitleGroups, type TimedWord } from "@/lib/storyScript";

const words = (texts: string[], step = .5): TimedWord[] => texts.map((text, i) => ({ text, start: i * step, end: i * step + step * .9 }));

describe("parseScript", () => {
  it("reads JSON wrapped in extra text and drops empty scenes", () => {
    const raw = 'Aquí está: {"title":"Siete rayos","character":"ranger","caption":"Historia real","scenes":[{"text":"Uno.","image":"a","motion":"b"},{"text":"","image":"x"},{"text":"Dos.","image":"c","motion":"d"}]} fin';
    const script = parseScript(raw);
    expect(script.title).toBe("Siete rayos");
    expect(script.scenes.map(s => s.text)).toEqual(["Uno.", "Dos."]);
    expect(narrationOf(script.scenes)).toBe("Uno. Dos.");
  });

  it("rejects a script without enough scenes", () => {
    expect(() => parseScript('{"scenes":[{"text":"Solo una."}]}')).toThrow(/escenas/);
  });
});

describe("sceneDurationsFromWords", () => {
  it("starts each scene when its first word is spoken", () => {
    const spoken = words(["a", "b", "c", "d", "e", "f"]);
    const durations = sceneDurationsFromWords(["a b", "c d e", "f"], spoken, 3, .4, .9);
    // Escena 2 empieza en la palabra "c" (1.0 s + 0.4 s de retraso de la voz); escena 3 en "f" (2.5 s + 0.4 s).
    expect(durations[0]).toBeCloseTo(1.4, 5);
    expect(durations[1]).toBeCloseTo(1.5, 5);
    expect(durations[2]).toBeCloseTo(3 + .4 + .9 - 2.9, 5);
  });

  it("covers the whole narration plus the tail", () => {
    const spoken = words(Array.from({ length: 30 }, (_, i) => `w${i}`));
    const durations = sceneDurationsFromWords(["w ".repeat(10), "w ".repeat(10), "w ".repeat(10)], spoken, 15);
    expect(durations.reduce((a, b) => a + b, 0)).toBeCloseTo(15 + .4 + .9, 5);
  });
});

describe("subtitleGroups", () => {
  it("splits into short phrases and breaks after sentence ends", () => {
    const groups = subtitleGroups(words(["A", "este", "hombre", "le", "cayeron", "siete", "rayos.", "Y", "sobrevivió."]));
    expect(groups.map(g => g.map(w => w.text).join(" "))).toEqual(["A este hombre le", "cayeron siete rayos.", "Y sobrevivió."]);
  });
});
