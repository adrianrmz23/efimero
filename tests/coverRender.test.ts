import { describe, expect, it } from "vitest";
import { fitLines } from "@/lib/coverRender";
import { scriptPrompt } from "@/lib/storyScript";

// Medida simple: cada letra ocupa la mitad del tamaño de fuente.
const measure = (text: string, size: number) => text.length * size * .5;

describe("fitLines", () => {
  it("keeps the big size when the text fits", () => {
    expect(fitLines(measure, "LE QUEDABAN 3 DÍAS", 1200, 3, 200, 80)).toEqual({ size: 200, lines: ["LE QUEDABAN", "3 DÍAS"] });
  });
  it("shrinks the text until it fits in the allowed lines", () => {
    const { size, lines } = fitLines(measure, "NADIE SABE CÓMO SOBREVIVIÓ A SIETE RAYOS", 900, 2, 200, 60);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(size).toBeLessThan(200);
  });
});

describe("story kinds", () => {
  it("uses specific rules for psalms, Bible stories and prayers", () => {
    expect(scriptPrompt("Salmo 23", 8, "psalm")).toMatch(/Reina-Valera antigua/);
    expect(scriptPrompt("David y Goliat", 8, "bible")).toMatch(/No agregues hechos/);
    expect(scriptPrompt("Oración por los hijos", 8, "prayer")).toMatch(/Sin promesas de curación/);
    expect(scriptPrompt("tema", 8)).toMatch(/TEXTO DE PORTADA/);
  });
});
