import { describe, expect, it } from "vitest";
import { BATCH_PRESETS, parseBatch, rowsToCsv, screenRows } from "@/lib/contentBatch";

const frases = BATCH_PRESETS.find(p => p.id === "efimero-frases")!;
const ecos = BATCH_PRESETS.find(p => p.id === "ecos-oraciones")!;
const prayer = (extra = "") => `Señor,\n\nTe pido por mi familia ${extra}. ${"Cuida cada paso que damos y danos paz en casa. ".repeat(9)}\n\nAmén.`;

describe("parseBatch", () => {
  it("reads items even when the model writes real line breaks inside the text", () => {
    const raw = 'Aquí va:\n{"items":[{"titulo":"Oración","texto":"Señor,\n\nGracias.\n\nAmén.","caption":""},{"titulo":"","texto":"Frase corta de prueba.","caption":"🙏"}]}';
    expect(parseBatch(raw)).toEqual([{ titulo: "Oración", texto: "Señor,\n\nGracias.\n\nAmén.", caption: "" }, { titulo: "", texto: "Frase corta de prueba.", caption: "🙏" }]);
  });

  it("returns nothing for invalid output", () => {
    expect(parseBatch("no hay json")).toEqual([]);
  });
});

describe("screenRows", () => {
  it("drops repeated rows, also against existing content", () => {
    const rows = [{ titulo: "", texto: "No tienes que hacerlo perfecto hoy.", caption: "" }, { titulo: "", texto: "no tienes que hacerlo PERFECTO hoy", caption: "" }, { titulo: "", texto: "Lo que es para ti, ni aunque te quites.", caption: "" }];
    const { accepted, rejected } = screenRows(frases, rows, ["Lo que es para ti, ni aunque te quites."]);
    expect(accepted.map(r => r.texto)).toEqual(["No tienes que hacerlo perfecto hoy."]);
    expect(rejected.map(r => r.reason)).toEqual(["Repetida", "Repetida"]);
  });

  it("drops engagement bait", () => {
    const { rejected } = screenRows(frases, [{ titulo: "", texto: "Si crees en Dios, comenta amén y comparte con tu familia.", caption: "" }], []);
    expect(rejected[0]?.reason).toBe("No pasa Compliance");
  });

  it("checks weekdays and completeness for long prayers", () => {
    const { accepted, rejected } = screenRows(ecos, [
      { titulo: "Oración de lunes", texto: prayer(), caption: "" },
      { titulo: "Oración por la familia", texto: "Señor, cuida a mi familia. Amén.", caption: "" },
      { titulo: "Oración por la familia", texto: prayer("y por mis hijos"), caption: "" },
    ], []);
    expect(rejected.map(r => r.reason)).toEqual(["Menciona un día de la semana", "Oración incompleta"]);
    expect(accepted).toHaveLength(1);
  });
});

it("builds a CSV with BOM, header and line breaks kept inside the cell", () => {
  const csv = rowsToCsv([{ titulo: "Oración", texto: "Señor,\nAmén.", caption: 'Dijo "paz"' }]);
  expect(csv.startsWith('﻿"titulo","texto","caption"\r\n')).toBe(true);
  expect(csv).toContain('"Señor,\r\nAmén."');
  expect(csv).toContain('"Dijo ""paz"""');
});

describe("deseos y decretos", () => {
  const deseos = BATCH_PRESETS.find(p => p.id === "efimero-deseos")!;
  it("rejects asking to touch the post and promises of guaranteed money", () => {
    const { accepted, rejected } = screenRows(deseos, [
      { titulo: "", texto: "🚨 ÚLTIMA HORA: Cualquiera que toque esta publicación será rico antes de diciembre.", caption: "" },
      { titulo: "", texto: "Atención: este diciembre serás rico, es seguro.", caption: "" },
      { titulo: "", texto: "🚨 ÚLTIMA HORA: diciembre viene con buenas noticias para los que no se rindieron este año.", caption: "" },
    ], []);
    expect(rejected.map(r => r.reason)).toEqual(["Pide interacción", "Promete dinero seguro"]);
    expect(accepted).toHaveLength(1);
  });
});

it("does not flag everyday uses of the same verbs", () => {
  const frases = BATCH_PRESETS.find(p => p.id === "efimero-frases")!;
  const { accepted } = screenRows(frases, [
    { titulo: "", texto: "Hoy me toca trabajar doble, pero lo hago por los míos.", caption: "" },
    { titulo: "", texto: "Lo bueno de tocar fondo es que ya solo queda subir.", caption: "" },
  ], []);
  expect(accepted).toHaveLength(2);
});
