import { describe, expect, it } from "vitest";
import { findDuplicates } from "@/lib/creativeDuplicates";

const night="Señor,\npongo en tus manos este día.\n\nAmén.";

describe("findDuplicates", () => {
  it("flags repeated rows ignoring accents, case and punctuation", () => {
    expect(findDuplicates([night,"Padre, gracias por este día. Amén.","senor pongo en tus manos este dia amen"],[])).toEqual([null,null,{row:1}]);
  });

  it("flags texts already scheduled even when the title changed", () => {
    expect(findDuplicates([night],[{text:`Oración de la noche. ${night}`,date:"2026-10-24"}])).toEqual([{date:"2026-10-24"}]);
  });

  it("ignores very short texts", () => {
    expect(findDuplicates(["Amén.","Amén."],[])).toEqual([null,null]);
  });
});
