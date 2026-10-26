// Historias narradas: guion por escenas, estilos de ilustración y sincronía entre voz, escenas y subtítulos.
export type StoryScene = { text: string; image: string; motion: string };
export type StoryScript = { title: string; character: string; caption: string; scenes: StoryScene[] };
export type TimedWord = { text: string; start: number; end: number };

export const STORY_STYLES: Record<string, { label: string; prompt: string }> = {
  cartoon: { label: "Caricatura de cómic", prompt: "2D cartoon comic illustration, bold clean black outlines, flat colors with soft gradients, expressive faces, cinematic dramatic lighting" },
  realistic: { label: "Ilustración realista", prompt: "semi-realistic digital painting, cinematic lighting, detailed, dramatic atmosphere" },
  anime: { label: "Anime", prompt: "anime illustration, clean line art, cel shading, vivid colors, cinematic composition" },
  watercolor: { label: "Acuarela", prompt: "watercolor storybook illustration, soft textured paper, warm muted colors" },
};
export const styleSuffix = (style: string) => `${(STORY_STYLES[style] || STORY_STYLES.cartoon).prompt}, single full-bleed vertical 9:16 illustration, no comic panels, no borders, no frames, no text, no letters, no watermark.`;

export function scriptPrompt(topic: string, scenes: number) {
  return `Escribe el guion de un short vertical de 40 a 60 segundos sobre: ${topic}.
Reglas:
- Solo hechos verdaderos y verificables; no inventes datos, fechas, cifras ni frases textuales. Si no estás seguro de un dato, no lo incluyas.
- La primera frase es un gancho fuerte que despierte curiosidad.
- Narración total de 110 a 140 palabras, frases cortas, tono de documental intrigante, español latino.
- Divide la narración en ${scenes} escenas en orden; cada escena tiene 1 o 2 frases.
- Para cada escena describe en inglés la ilustración (sin texto en la imagen) y el movimiento de cámara.
- No pidas que comenten, compartan, den like ni sigan la cuenta.
Devuelve exactamente este JSON: {"title":"título corto para mostrar arriba (máx. 60 caracteres)","character":"descripción en inglés del personaje principal (rasgos, peinado y ropa) para dibujarlo igual en todas las escenas; vacío si no hay personaje","caption":"texto corto para la publicación, sin pedir interacción","scenes":[{"text":"narración en español","image":"descripción en inglés","motion":"camera motion in English"}]}`;
}

// Acepta el JSON aunque venga rodeado de texto y deja solo campos válidos.
export function parseScript(raw: string): StoryScript {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió el guion en el formato esperado.");
  const data = JSON.parse(raw.slice(start, end + 1));
  const scenes = (Array.isArray(data.scenes) ? data.scenes : []).map((s: any) => ({ text: String(s?.text || "").trim(), image: String(s?.image || "").trim(), motion: String(s?.motion || "").trim() })).filter((s: StoryScene) => s.text);
  if (scenes.length < 2) throw new Error("El guion llegó sin escenas suficientes. Intenta de nuevo.");
  return { title: String(data.title || "").trim().slice(0, 80), character: String(data.character || "").trim(), caption: String(data.caption || "").trim(), scenes: scenes.slice(0, 14) };
}

export const narrationOf = (scenes: StoryScene[]) => scenes.map(s => s.text.trim()).filter(Boolean).join(" ");

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

// Duración de cada escena según cuándo empieza a narrarse. Si la transcripción tiene otro número de palabras
// que el guion, se reparte de forma proporcional. `offset` es el retraso con el que arranca la voz.
export function sceneDurationsFromWords(sceneTexts: string[], words: TimedWord[], audioDuration: number, offset = .4, tail = .9) {
  const counts = sceneTexts.map(countWords);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const starts: number[] = [];
  let cumulative = 0;
  for (const count of counts) {
    const index = Math.min(words.length - 1, Math.round(cumulative / total * words.length));
    starts.push(words.length ? (index <= 0 ? 0 : words[index].start + offset) : cumulative / total * audioDuration + offset);
    cumulative += count;
  }
  starts[0] = 0;
  const end = audioDuration + offset + tail;
  return starts.map((s, i) => Math.max(1.2, (i < starts.length - 1 ? starts[i + 1] : end) - s));
}

// Agrupa las palabras en frases cortas para los subtítulos (máximo `maxWords` o `maxChars`).
export function subtitleGroups(words: TimedWord[], maxWords = 4, maxChars = 24) {
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  for (const word of words) {
    const length = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
    // La transcripción no siempre trae puntos: una mayúscula también se toma como inicio de frase.
    const newSentence = current.length >= 2 && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(word.text);
    if (current.length && (current.length >= maxWords || length > maxChars || newSentence || /[.!?…]$/.test(current[current.length - 1].text))) { groups.push(current); current = []; }
    current.push(word);
  }
  if (current.length) groups.push(current);
  return groups;
}
