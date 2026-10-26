// Título, descripción y etiquetas para subir un short a YouTube (se generan con el proveedor de texto elegido).
export type YoutubeMeta = { title: string; description: string; tags: string[] };

export function youtubeMetaPrompt(input: { kind: string; topic: string; title: string; text: string }) {
  return `Prepara la publicación en YouTube Shorts de este video católico en español latino.
Tipo: ${input.kind}. Tema: ${input.topic || input.title}.
Narración del video:
"""${input.text.slice(0, 3000)}"""
Reglas:
- "title": de 40 a 90 caracteres, natural y con la frase que la gente buscaría (por ejemplo "Oración a la Virgen del Carmen por los hijos"); puede llevar un emoji al final y debe terminar con " #Shorts". Sin mayúsculas sostenidas ni promesas ("milagro garantizado", "en 24 horas").
- "description": 3 a 5 párrafos cortos: una frase que invite a rezar con calma, la oración o el salmo completo tal como se narra, una línea de contexto (quién es el santo, de qué trata el salmo) y al final 3 a 5 hashtags (#oracion #fe ...). Si es un salmo, cita el número.
- PROHIBIDO pedir que comenten, compartan, den like, se suscriban o escriban "amén"; sin promesas de curación ni de resultados.
- "tags": 8 a 15 etiquetas de búsqueda en español, sin "#", en minúsculas.
Devuelve solo JSON: {"title":"","description":"","tags":[""]}`;
}

export function parseYoutubeMeta(raw: string): YoutubeMeta {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió el título y la descripción en el formato esperado.");
  const d = JSON.parse(raw.slice(start, end + 1));
  let title = String(d.title || "").replace(/\s+/g, " ").trim();
  if (!title) throw new Error("Llegó sin título. Intenta de nuevo.");
  // YouTube permite 100 caracteres en el título; si se pasa, se recorta antes del #Shorts.
  if (title.length > 100) title = `${title.replace(/\s*#Shorts\s*$/i, "").slice(0, 91).trim()} #Shorts`;
  // Las etiquetas suman como máximo 500 caracteres en YouTube.
  const tags: string[] = []; let used = 0;
  for (const tag of (Array.isArray(d.tags) ? d.tags : []).map((t: unknown) => String(t || "").replace(/^#/, "").trim().toLowerCase()).filter(Boolean)) {
    if (tags.includes(tag) || used + tag.length + 1 > 480) continue;
    tags.push(tag); used += tag.length + 1;
  }
  return { title, description: String(d.description || "").trim().replace(/[<>]/g, "").slice(0, 4800), tags };
}
