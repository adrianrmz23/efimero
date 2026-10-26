import { describe, expect, it } from "vitest";
import { FICTION_BADGE, FICTION_DISCLOSURE, castInScene, ensureFictionDisclosure, healingClaims, narrationOf, parseScript, sceneDurationsFromWords, scriptPrompt, subtitleGroups, type TimedWord } from "@/lib/storyScript";
import { findSaint } from "@/lib/saints";

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

describe("relatos de ficción", () => {
  const base = { title: "La fe de Marta", character: "", caption: "Una familia que no se rindió.", scenes: [{ text: "Marta ya no sabía qué hacer.", image: "", motion: "" }, { text: "Rezó a San Judas cada noche.", image: "", motion: "" }] };

  it("adds the disclosure to the narration and the caption when missing", () => {
    const script = ensureFictionDisclosure(base);
    expect(script.scenes[0].text).toBe(`Marta ya no sabía qué hacer. ${FICTION_DISCLOSURE}`);
    expect(script.caption).toBe(`${FICTION_BADGE}: Una familia que no se rindió.`);
  });

  it("keeps an existing disclosure as is", () => {
    const script = ensureFictionDisclosure({ ...base, caption: "Relato inspirador: ya avisado.", scenes: [{ ...base.scenes[0], text: "Historia inspirada en la fe de muchas familias." }, base.scenes[1]] });
    expect(script.scenes[0].text).toBe("Historia inspirada en la fe de muchas familias.");
    expect(script.caption).toBe("Relato inspirador: ya avisado.");
  });

  it("moves a disclosure written at the end to the first scene", () => {
    const script = ensureFictionDisclosure({ ...base, scenes: [base.scenes[0], { ...base.scenes[1], text: "Rezó a San Judas cada noche. Esta historia está inspirada en la fe de muchas familias." }] });
    expect(script.scenes[0].text).toBe(`Marta ya no sabía qué hacer. ${FICTION_DISCLOSURE}`);
    expect(script.scenes[1].text).toBe("Rezó a San Judas cada noche.");
  });

  it("flags scenes that sound like a promise of healing", () => {
    const script = { ...base, scenes: [{ text: "Rezó y se curó de la noche a la mañana.", image: "", motion: "" }, { text: "Los médicos la atendieron y la fe le dio fuerza.", image: "", motion: "" }, { text: "Al final, el tumor desapareció.", image: "", motion: "" }, { text: "El cáncer desapareció por completo.", image: "", motion: "" }] };
    expect(healingClaims(script)).toEqual([0, 2, 3]);
  });

  it("asks for invented characters and no healing promises in fiction mode", () => {
    expect(scriptPrompt("tema", 8, "fiction")).toMatch(/NO un caso real/);
    expect(scriptPrompt("tema", 8, "fiction")).toMatch(/Sin promesas de sanación/);
    expect(scriptPrompt("tema", 8)).toMatch(/Solo hechos verdaderos/);
  });
});

describe("santos y ganchos", () => {
  it("finds a saint mentioned in the topic, with or without accents", () => {
    expect(findSaint("Una mamá le pide a San Judas Tadeo por su esposo")?.label).toBe("San Judas Tadeo");
    expect(findSaint("milagro de la virgen de GUADALUPE")?.label).toBe("Virgen de Guadalupe");
    expect(findSaint("Roy Sullivan y los rayos")).toBeNull();
  });

  it("asks for strong hooks and for the saint to appear when there is one", () => {
    const prompt = scriptPrompt("tema", 8, "fiction", "Saint Jude look");
    expect(prompt).toMatch(/PRIMERA FRASE es el gancho/);
    expect(prompt).toMatch(/PROHIBIDO empezar con "Esta es la historia de"/);
    expect(prompt).toMatch(/usa exactamente esta: Saint Jude look/);
    expect(scriptPrompt("tema", 8)).not.toMatch(/showsSaint": true/);
  });

  it("keeps the saint fields from the model output", () => {
    const script = parseScript('{"saint":"Saint Jude","scenes":[{"text":"Uno.","showsSaint":true},{"text":"Dos."}]}');
    expect(script.saint).toBe("Saint Jude");
    expect(script.scenes.map(s => s.showsSaint)).toEqual([true, false]);
  });
});

describe("castInScene", () => {
  const script = { title: "", character: "girl", caption: "", cast: [{ name: "Tomás", look: "a small brown-and-white puppy dog" }, { name: "Luna", look: "a 9-year-old girl in a yellow raincoat" }], scenes: [] };
  it("describes every character named in the scene, ignoring accents and case", () => {
    expect(castInScene(script, { text: "Allí, tomas estaba mojado.", image: "the shed at dawn", motion: "" }).map(c => c.name)).toEqual(["Tomás"]);
    expect(castInScene(script, { text: "Luna lo abrazó.", image: "Luna hugs Tomás", motion: "" }).map(c => c.name)).toEqual(["Tomás", "Luna"]);
  });
  it("does not match names inside other words", () => {
    expect(castInScene(script, { text: "Lunares en el cielo.", image: "", motion: "" })).toEqual([]);
  });
});
