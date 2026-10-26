// Oración devocional: una imagen protagonista (santo, Virgen, Jesús o tarjeta de oración) presente casi todo el video,
// 2 o 3 imágenes de apoyo del mismo estilo, voz serena y subtítulos grandes. Pensado para oraciones y salmos.
export type DevotionalKind = "prayer" | "psalm";
export type DevotionalScript = { title: string; cover: string; coverWord: string; caption: string; cardTitle: string; hero: string; support: string[]; lines: string[] };

export const DEVOTIONAL_STYLES: Record<string, { label: string; prompt: string }> = {
  painting: { label: "Pintura devocional", prompt: "classical Catholic devotional oil painting, warm gold and soft light, rich detail, serene sacred atmosphere, realistic faces, like a traditional holy card masterpiece" },
  celestial: { label: "Celestial luminoso", prompt: "photorealistic celestial scene, glowing golden divine light rays, soft bokeh sparkles, warm sunrise tones, ethereal and hopeful, cinematic" },
};
export const devotionalSuffix = (style: string) => `${(DEVOTIONAL_STYLES[style] || DEVOTIONAL_STYLES.painting).prompt}, vertical 9:16, no text, no letters, no watermark, no frames.`;

export function devotionalPrompt(topic: string, kind: DevotionalKind, saintLook = "") {
  const body = kind === "psalm"
    ? `Es un salmo narrado: después de una frase gancho (que no es parte del salmo), la narración es el texto del salmo fiel a la Reina-Valera antigua escribiendo "Señor" en lugar de "Jehová", con ortografía actual (sin "á" sueltas ni formas como "guiaráme"). Si es largo, usa sus versículos más conocidos sin alterarlos. Termina con "Amén."`
    : `Es una oración original: una frase gancho que nombre la necesidad ("Si hoy temes por tus hijos, esta oración es para ti."), un saludo a Dios, a Jesús, a la Virgen o al santo, la oración en frases cortas y "Amén." al final. Sin promesas de curación ni de resultados garantizados.`;
  return `Escribe una ${kind === "psalm" ? "lectura de salmo" : "oración"} para un short vertical de 40 a 55 segundos sobre: ${topic}.
${body}
- Narración total de 95 a 125 palabras, para leerse despacio con voz serena.
- PROHIBIDO pedir que comenten, compartan, envíen, etiqueten o escriban "amén" (tampoco "envíale esta oración a alguien").
- "lines": la narración dividida en 6 a 8 partes, en orden.
- "hero": descripción en inglés de la IMAGEN PROTAGONISTA que se verá casi todo el video: la figura devocional principal${saintLook ? ` con esta iconografía exacta: ${saintLook}` : " (Jesús, la Virgen, un santo o una escena simbólica del salmo)"}, de frente, centrada, con luz suave.
- "support": 2 o 3 descripciones en inglés de imágenes de apoyo coherentes con la protagonista y la oración (por ejemplo, una madre orando junto a sus hijos dormidos), mismo estilo y misma paleta.
- "cardTitle": título corto para la tarjeta ("Oración por los hijos").
- "cover": texto de portada de 2 a 6 palabras en mayúsculas que dé curiosidad o emoción sin exagerar, y "coverWord": la palabra a resaltar.
Devuelve solo JSON: {"title":"","cardTitle":"","cover":"","coverWord":"","caption":"texto corto para la publicación, sin pedir interacción","hero":"","support":["",""],"lines":["",""]}`;
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
    hero, support: (Array.isArray(d.support) ? d.support : []).map((x: unknown) => String(x || "").trim()).filter(Boolean).slice(0, 3), lines: lines.slice(0, 10),
  };
}

// Qué imagen usa cada parte de la narración: la protagonista abre, cierra y aparece en las partes pares;
// las de apoyo se alternan en las impares. Con tarjeta de oración, la tarjeta se ve todo el tiempo.
export function visualPlan(parts: number, supports: number, cardOnly = false): Array<"hero" | number> {
  return Array.from({ length: parts }, (_, i) => cardOnly || !supports || i % 2 === 0 || i === parts - 1 ? "hero" : ((i - 1) / 2) % supports);
}

// Une las partes seguidas que usan la misma imagen en una sola escena (sin disolver una imagen consigo misma).
export function mergeVisuals(plan: Array<"hero" | number>, durations: number[]) {
  const out: Array<{ visual: "hero" | number; duration: number }> = [];
  plan.forEach((visual, i) => { const last = out[out.length - 1]; if (last && last.visual === visual) last.duration += durations[i] || 0; else out.push({ visual, duration: durations[i] || 0 }); });
  return out;
}
