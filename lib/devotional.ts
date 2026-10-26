// Oración devocional: una imagen protagonista (santo, Virgen, Jesús o tarjeta de oración) presente casi todo el video,
// 2 o 3 imágenes de apoyo del mismo estilo, voz serena y subtítulos grandes. Pensado para oraciones y salmos.
export type DevotionalKind = "prayer" | "psalm";
export type DevotionalScript = { title: string; cover: string; coverWord: string; caption: string; cardTitle: string; hero: string; support: string[]; supportLines: number[]; lines: string[] };
// `supportLines[k]`: índice (desde 0) de la parte de la narración que ilustra la imagen de apoyo k, o -1 si no se sabe.

export const DEVOTIONAL_STYLES: Record<string, { label: string; prompt: string }> = {
  painting: { label: "Pintura devocional", prompt: "classical Catholic devotional oil painting, warm gold and soft light, rich detail, serene sacred atmosphere, realistic faces, like a traditional holy card masterpiece" },
  celestial: { label: "Celestial luminoso", prompt: "photorealistic celestial scene, glowing golden divine light rays, soft bokeh sparkles, warm sunrise tones, ethereal and hopeful, cinematic" },
};
export const devotionalSuffix = (style: string) => `${(DEVOTIONAL_STYLES[style] || DEVOTIONAL_STYLES.painting).prompt}, vertical 9:16, no text, no letters, no watermark, no frames.`;

export function devotionalPrompt(topic: string, kind: DevotionalKind, saintLook = "", supports = 3) {
  const n = Math.max(2, Math.min(7, Math.round(supports)));
  const body = kind === "psalm"
    ? `Es un salmo narrado: después de una frase gancho (que no es parte del salmo), la narración es el texto del salmo fiel a la Reina-Valera antigua escribiendo "Señor" en lugar de "Jehová", con ortografía actual (sin "á" sueltas ni formas como "guiaráme"). Si es largo, usa sus versículos más conocidos sin alterarlos. Termina con "Amén."`
    : `Es una oración original: una frase gancho que nombre la necesidad ("Si hoy temes por tus hijos, esta oración es para ti."), un saludo a Dios, a Jesús, a la Virgen o al santo, la oración en frases cortas y "Amén." al final. Sin promesas de curación ni de resultados garantizados.`;
  return `Escribe una ${kind === "psalm" ? "lectura de salmo" : "oración"} para un short vertical de 40 a 55 segundos sobre: ${topic}.
${body}
- Narración total de 95 a 125 palabras, para leerse despacio con voz serena.
- PROHIBIDO pedir que comenten, compartan, envíen, etiqueten o escriban "amén" (tampoco "envíale esta oración a alguien").
- "lines": la narración dividida en 6 a 8 partes, en orden.
- "hero": descripción en inglés de la IMAGEN PROTAGONISTA que se verá casi todo el video: la figura devocional principal${saintLook ? ` con esta iconografía exacta: ${saintLook}` : " (Jesús, la Virgen, un santo o una escena simbólica del salmo)"}, de frente, centrada, con luz suave.
- "support": exactamente ${n} imágenes de apoyo, cada una como {"line": número de la parte de "lines" que ilustra (contando la primera parte como 1; de la 2 a la penúltima, sin repetir), "image": descripción en inglés}. Cada imagen ilustra lo que se dice en esa parte y es DISTINTA de las demás (varía el plano y el motivo: personas orando, manos juntas, velas, un rosario, un paisaje al amanecer, un cielo con luz, una iglesia, un detalle de la figura devocional). Mismo estilo y misma paleta que la protagonista; la figura devocional se describe igual cada vez que aparezca.
- "cardTitle": título corto para la tarjeta ("Oración por los hijos").
- "cover": texto de portada de 2 a 6 palabras en mayúsculas que dé curiosidad o emoción sin exagerar, y "coverWord": la palabra a resaltar.
Devuelve solo JSON: {"title":"","cardTitle":"","cover":"","coverWord":"","caption":"texto corto para la publicación, sin pedir interacción","hero":"","lines":["",""],"support":[${Array.from({ length: n }, () => '{"line":2,"image":""}').join(",")}]}`;
}

export function parseDevotional(raw: string): DevotionalScript {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió la oración en el formato esperado.");
  const d = JSON.parse(raw.slice(start, end + 1));
  const lines = (Array.isArray(d.lines) ? d.lines : []).map((x: unknown) => String(x || "").trim()).filter(Boolean);
  const hero = String(d.hero || "").trim();
  if (lines.length < 3 || !hero) throw new Error("La oración llegó incompleta. Intenta de nuevo.");
  return {
    title: String(d.title || "").trim().slice(0, 80), cardTitle: String(d.cardTitle || d.title || "").trim().slice(0, 60),
    cover: String(d.cover || "").trim().slice(0, 60), coverWord: String(d.coverWord || "").trim().slice(0, 30), caption: String(d.caption || "").trim(),
    hero, ...supportsOf(d.support), lines: lines.slice(0, 10),
  };
}

// Acepta las imágenes de apoyo como texto o como {line, image}; `line` llega contando desde 1.
function supportsOf(raw: unknown) {
  const items = (Array.isArray(raw) ? raw : []).map((x: any) => typeof x === "string" ? { image: x.trim(), line: -1 } : { image: String(x?.image || "").trim(), line: Number.isInteger(Number(x?.line)) ? Number(x.line) - 1 : -1 }).filter(x => x.image).slice(0, 7);
  return { support: items.map(x => x.image), supportLines: items.map(x => x.line) };
}

// Qué imagen usa cada parte de la narración. Con pocas imágenes, la protagonista abre, cierra y aparece en las partes
// pares, y las de apoyo se alternan en las impares. Si hay imagen para cada parte, la protagonista abre y cierra y las
// de apoyo van en orden. Con tarjeta de oración, la tarjeta se ve todo el tiempo.
// Si se sabe a qué parte va cada imagen de apoyo (`at`), se respeta: así la imagen coincide con lo que se dice.
export function visualPlan(parts: number, supports: number, cardOnly = false, at: number[] = []): Array<"hero" | number> {
  const middle = parts - 2;
  if (!cardOnly && supports > 0) {
    const placed = new Map<number, number>();
    at.slice(0, supports).forEach((line, k) => { if (line >= 1 && line <= parts - 2 && !placed.has(line)) placed.set(line, k); });
    if (placed.size >= Math.ceil(supports / 2)) return Array.from({ length: parts }, (_, i) => placed.get(i) ?? "hero");
  }
  if (!cardOnly && supports > 0 && supports >= middle) return Array.from({ length: parts }, (_, i) => i === 0 || i === parts - 1 ? "hero" : (i - 1) % supports);
  // Si hay más imágenes de apoyo que huecos alternados, se reparten parejo para usarlas todas.
  if (!cardOnly && supports > Math.floor((parts - 1) / 2)) {
    const at = new Map(Array.from({ length: supports }, (_, k) => [1 + Math.round(k * (middle - 1) / Math.max(1, supports - 1)), k] as const));
    return Array.from({ length: parts }, (_, i) => at.get(i) ?? "hero");
  }
  return Array.from({ length: parts }, (_, i) => cardOnly || !supports || i % 2 === 0 || i === parts - 1 ? "hero" : ((i - 1) / 2) % supports);
}

// Cuántas imágenes de apoyo pedir según la variedad elegida.
export const IMAGE_VARIETY = [{ id: "few", label: "Pocas (3 imágenes)", supports: 2 }, { id: "some", label: "Varias (5 imágenes)", supports: 4 }, { id: "many", label: "Una por parte (7 u 8)", supports: 6 }] as const;

// Une las partes seguidas que usan la misma imagen en una sola escena (sin disolver una imagen consigo misma).
export function mergeVisuals(plan: Array<"hero" | number>, durations: number[]) {
  const out: Array<{ visual: "hero" | number; duration: number }> = [];
  plan.forEach((visual, i) => { const last = out[out.length - 1]; if (last && last.visual === visual) last.duration += durations[i] || 0; else out.push({ visual, duration: durations[i] || 0 }); });
  return out;
}
