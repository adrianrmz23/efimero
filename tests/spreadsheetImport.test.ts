import { describe, expect, it } from "vitest";
import { parseDelimited, rowsFromTable } from "@/lib/spreadsheetImport";

describe("parseDelimited", () => {
  it("keeps line breaks and escaped quotes inside quoted cells", () => {
    const csv = 'titulo,texto\r\n"Oración de la noche","Señor,\npongo en tus manos este día.\n\nAmén."\r\n"Cita","Dijo ""paz"""';
    expect(parseDelimited(csv)).toEqual([
      ["titulo", "texto"],
      ["Oración de la noche", "Señor,\npongo en tus manos este día.\n\nAmén."],
      ["Cita", 'Dijo "paz"'],
    ]);
  });

  it("detects semicolons (Excel in Spanish) and tabs (pasted from Sheets)", () => {
    expect(parseDelimited("titulo;texto\nA;B")).toEqual([["titulo", "texto"], ["A", "B"]]);
    expect(parseDelimited("titulo\ttexto\nA\tB")).toEqual([["titulo", "texto"], ["A", "B"]]);
  });

  it("strips the UTF-8 BOM and ignores empty rows", () => {
    expect(parseDelimited("﻿titulo,texto\n\nA,B\n")).toEqual([["titulo", "texto"], ["A", "B"]]);
  });
});

describe("rowsFromTable", () => {
  it("maps headers with accents and synonyms", () => {
    expect(rowsFromTable([["Título", "Oración", "Caption"], ["Noche", "Señor…", "Buenas noches"]])).toEqual([
      { title: "Noche", body: "Señor…", caption: "Buenas noches" },
    ]);
  });

  it("falls back to A=title, B=text, C=caption without headers", () => {
    expect(rowsFromTable([["Noche", "Señor…"]])).toEqual([{ title: "Noche", body: "Señor…", caption: "" }]);
  });

  it("skips rows without text", () => {
    expect(rowsFromTable([["titulo", "texto"], ["Solo título", ""], ["Mañana", "Padre…"]])).toHaveLength(1);
  });
});
