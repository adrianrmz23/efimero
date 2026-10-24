import { describe, expect, it } from "vitest";
import { parseBulkTexts, planBulkTextSlots } from "@/lib/bulkTextSlots";

/** Fecha en hora local (America/Mexico_City, fijada en vitest.config.mts). */
const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s);
const NOW = local(2026, 3, 5, 10, 0);
const times = (slots: { date: string; time: string }[]) => slots.map((s) => `${s.date} ${s.time}`);

describe("planBulkTextSlots", () => {
  describe("validation", () => {
    const first = local(2026, 3, 6, 9, 0);

    it.each([
      ["start after end", "22:00", "08:00"],
      ["start equal to end", "09:00", "09:00"],
      ["end past 23:59", "08:00", "24:00"],
      ["malformed start", "8", "22:00"],
      ["malformed end", "08:00", "late"],
      ["negative start", "-01:00", "22:00"],
    ])("rejects the window when %s", (_label, start, end) => {
      expect(() => planBulkTextSlots(3, first, 60, start, end, NOW)).toThrow(
        "La franja horaria debe tener inicio anterior al final, dentro del mismo día.",
      );
    });

    it("accepts a full-day window 00:00-23:59", () => {
      expect(planBulkTextSlots(1, first, 60, "00:00", "23:59", NOW)).toHaveLength(1);
    });

    it.each([14, 721, Number.NaN, Number.POSITIVE_INFINITY])("rejects gap %s", (gap) => {
      expect(() => planBulkTextSlots(3, first, gap, "08:00", "22:00", NOW)).toThrow(
        "La separación debe estar entre 15 y 720 minutos.",
      );
    });

    it("accepts the gap bounds 15 and 720", () => {
      expect(planBulkTextSlots(2, first, 15, "08:00", "22:00", NOW)).toHaveLength(2);
      expect(planBulkTextSlots(2, first, 720, "08:00", "22:00", NOW)).toHaveLength(2);
    });

    it("rejects an invalid first date", () => {
      expect(() => planBulkTextSlots(3, new Date("nope"), 60, "08:00", "22:00", NOW)).toThrow("Fecha inicial inválida.");
    });

    it("requires the first slot to respect the Meta minimum lead time (10 min, inclusive)", () => {
      expect(() => planBulkTextSlots(1, local(2026, 3, 5, 10, 9, 59), 60, "08:00", "22:00", NOW)).toThrow(
        "El primer horario debe estar al menos 10 minutos en el futuro.",
      );
      expect(() => planBulkTextSlots(1, local(2026, 3, 5, 9, 0), 60, "08:00", "22:00", NOW)).toThrow(/en el futuro/);
      expect(times(planBulkTextSlots(1, local(2026, 3, 5, 10, 10), 60, "08:00", "22:00", NOW))).toEqual(["2026-03-05 10:10"]);
    });

    it("validates the window before the gap and the gap before the date", () => {
      expect(() => planBulkTextSlots(1, new Date("nope"), 1, "22:00", "08:00", NOW)).toThrow(/franja horaria/);
      expect(() => planBulkTextSlots(1, new Date("nope"), 1, "08:00", "22:00", NOW)).toThrow(/separación/);
    });
  });

  it("returns no slots for count 0 or negative", () => {
    const first = local(2026, 3, 6, 9, 0);
    expect(planBulkTextSlots(0, first, 60, "08:00", "22:00", NOW)).toEqual([]);
    expect(planBulkTextSlots(-2, first, 60, "08:00", "22:00", NOW)).toEqual([]);
  });

  it("spaces slots by the gap inside the window, with local date/time and UTC timestamp", () => {
    const slots = planBulkTextSlots(3, local(2026, 3, 6, 9, 0), 60, "08:00", "22:00", NOW);
    expect(slots).toEqual([
      { date: "2026-03-06", time: "09:00", timestamp: "2026-03-06T15:00:00.000Z" },
      { date: "2026-03-06", time: "10:00", timestamp: "2026-03-06T16:00:00.000Z" },
      { date: "2026-03-06", time: "11:00", timestamp: "2026-03-06T17:00:00.000Z" },
    ]);
  });

  it("rolls to the window start of the next day once past the end", () => {
    const slots = planBulkTextSlots(4, local(2026, 3, 5, 20, 0), 90, "08:00", "22:00", NOW);
    expect(times(slots)).toEqual(["2026-03-05 20:00", "2026-03-05 21:30", "2026-03-06 08:00", "2026-03-06 09:30"]);
  });

  it("treats the window end as inclusive", () => {
    const slots = planBulkTextSlots(3, local(2026, 3, 5, 21, 0), 60, "08:00", "22:00", NOW);
    expect(times(slots)).toEqual(["2026-03-05 21:00", "2026-03-05 22:00", "2026-03-06 08:00"]);
  });

  it("moves a first slot that is before the window start to the start of that same day", () => {
    const slots = planBulkTextSlots(2, local(2026, 3, 6, 6, 30), 30, "08:00", "22:00", NOW);
    expect(times(slots)).toEqual(["2026-03-06 08:00", "2026-03-06 08:30"]);
  });

  it("moves a first slot that is after the window end to the next day's start", () => {
    const slots = planBulkTextSlots(1, local(2026, 3, 5, 22, 30), 30, "08:00", "22:00", NOW);
    expect(times(slots)).toEqual(["2026-03-06 08:00"]);
  });

  it("when the gap crosses midnight, lands on the next day's window start (no night posts)", () => {
    const slots = planBulkTextSlots(3, local(2026, 3, 5, 23, 0), 120, "08:00", "23:30", NOW);
    expect(times(slots)).toEqual(["2026-03-05 23:00", "2026-03-06 08:00", "2026-03-06 10:00"]);
  });

  it("rolls across month and year boundaries", () => {
    const now = local(2026, 12, 31, 12, 0);
    const slots = planBulkTextSlots(3, local(2026, 12, 31, 21, 30), 60, "08:00", "22:00", now);
    expect(times(slots)).toEqual(["2026-12-31 21:30", "2027-01-01 08:00", "2027-01-01 09:00"]);
  });

  it("with a 12h gap and a short window, uses one slot per day at the window start", () => {
    const slots = planBulkTextSlots(3, local(2026, 3, 6, 9, 0), 720, "09:00", "12:00", NOW);
    expect(times(slots)).toEqual(["2026-03-06 09:00", "2026-03-07 09:00", "2026-03-08 09:00"]);
  });

  it("does not round the first slot; non-round minutes and seconds carry over", () => {
    const slots = planBulkTextSlots(2, local(2026, 3, 6, 9, 7, 45), 30, "08:00", "22:00", NOW);
    expect(times(slots)).toEqual(["2026-03-06 09:07", "2026-03-06 09:37"]);
    expect(slots[0].timestamp).toBe("2026-03-06T15:07:45.000Z");
    expect(slots[1].timestamp).toBe("2026-03-06T15:37:45.000Z");
  });

  it("resets seconds when it snaps to the window start", () => {
    const slots = planBulkTextSlots(1, local(2026, 3, 6, 6, 30, 45), 30, "08:00", "22:00", NOW);
    expect(slots[0].timestamp).toBe("2026-03-06T14:00:00.000Z");
  });

  it("does not mutate the `first` date passed in", () => {
    const first = local(2026, 3, 5, 21, 0);
    const before = first.getTime();
    planBulkTextSlots(5, first, 60, "08:00", "22:00", NOW);
    expect(first.getTime()).toBe(before);
  });
});

describe("parseBulkTexts", () => {
  it("splits on blank lines", () => {
    expect(parseBulkTexts("Uno\n\nDos\n\nTres")).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("splits on a '---' line, tolerating surrounding spaces", () => {
    expect(parseBulkTexts("Uno\n---\nDos\n  ---  \nTres")).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("splits on a '---' line surrounded by blank lines", () => {
    expect(parseBulkTexts("Uno\n\n---\n\nDos")).toEqual(["Uno", "Dos"]);
  });

  it("treats whitespace-only lines as blank and collapses repeated blank lines", () => {
    expect(parseBulkTexts("Uno\n   \t\nDos\n\n\n\nTres")).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("keeps single line breaks inside a copy", () => {
    expect(parseBulkTexts("Línea 1\nLínea 2\n\nOtro")).toEqual(["Línea 1\nLínea 2", "Otro"]);
  });

  it("normalizes Windows line endings", () => {
    expect(parseBulkTexts("Uno\r\n\r\nDos\r\n---\r\nTres")).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("trims each copy and drops empty input", () => {
    expect(parseBulkTexts("\n\n  Uno  \n\n")).toEqual(["Uno"]);
    expect(parseBulkTexts("")).toEqual([]);
    expect(parseBulkTexts(" \n\n \n")).toEqual([]);
  });

  it("keeps duplicates (no de-duplication) and preserves order", () => {
    expect(parseBulkTexts("Amén\n\nGracias\n\nAmén")).toEqual(["Amén", "Gracias", "Amén"]);
  });

  it("does not treat '----', inline '---' or '---text' as separators", () => {
    expect(parseBulkTexts("Uno\n----\nDos")).toEqual(["Uno\n----\nDos"]);
    expect(parseBulkTexts("Uno ---\nDos")).toEqual(["Uno ---\nDos"]);
    expect(parseBulkTexts("Uno\n---Dos")).toEqual(["Uno\n---Dos"]);
  });

  it("drops a trailing '---' line when followed by a newline", () => {
    expect(parseBulkTexts("Uno\n---\n")).toEqual(["Uno"]);
  });

  // SUSPECTED BUG: a separator is only recognized when preceded by "\n" and followed by
  // "\n". The regex also greedily swallows the blank lines/whitespace that follow a
  // separator, so in the cases below a literal "---" leaks into a copy that would be
  // published as-is. These tests document CURRENT behavior.
  describe("'---' never leaks into copies", () => {
    it("ignores a leading '---' on the first line", () => {
      expect(parseBulkTexts("---\nUno\n---\nDos")).toEqual(["Uno", "Dos"]);
    });

    it("ignores a trailing '---' without a final newline", () => {
      expect(parseBulkTexts("Uno\n---\nDos\n---")).toEqual(["Uno", "Dos"]);
    });

    it("treats consecutive separators as one", () => {
      expect(parseBulkTexts("Uno\n---\n---\nDos")).toEqual(["Uno", "Dos"]);
      expect(parseBulkTexts("Uno\n---\n\n---\nDos")).toEqual(["Uno", "Dos"]);
    });
  });
});
