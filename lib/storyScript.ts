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

export type StoryKind = "real" | "fiction";
// Aviso fijo en pantalla y frase que debe aparecer en la narración de los relatos de ficción.
export const FICTION_BADGE = "Relato inspirador";
export const FICTION_DISCLOSURE = "Esta historia está inspirada en la fe de muchas familias.";

const REAL_RULES = `- Solo hechos verdaderos y verificables; no inventes datos, fechas, cifras ni frases textuales. Si no estás seguro de un dato, no lo incluyas.
- La primera frase es un gancho fuerte que despierte curiosidad.
- Narración total de 110 a 140 palabras, frases cortas, tono de documental intrigante, español latino.`;

// Relato de ficción: personajes comunes inventados, sin hacerlos pasar por un caso real y sin prometer curaciones.
const FICTION_RULES = `- Es un relato de ficción inspirador, NO un caso real: personajes comunes inventados (solo nombre de pila), sin apellidos, ciudades exactas, fechas ni detalles que lo hagan parecer un caso documentado.
- La primera escena empieza con un gancho emotivo y termina con esta frase exacta: "${FICTION_DISCLOSURE}"
- Estructura: gancho, situación difícil con drama y tensión, momento de fe y oración, final feliz y esperanzador, y una invocación corta al santo o a Dios.
- Sin promesas de sanación: no digas que la oración curó una enfermedad ni que algo desapareció milagrosamente. En temas de salud, los médicos atienden y la fe da fuerza, paz y esperanza; el final feliz puede ser recuperación con atención médica, reconciliación, trabajo, regreso a casa o paz.
- Tono cálido y devocional, español latino, narración total de 110 a 140 palabras, frases cortas.`;

export function scriptPrompt(topic: string, scenes: number, kind: StoryKind = "real") {
  return `Escribe el guion de un short vertical de 40 a 60 segundos sobre: ${topic}.
Reglas:
${kind === "fiction" ? FICTION_RULES : REAL_RULES}
- Divide la narración en ${scenes} escenas en orden; cada escena tiene 1 o 2 frases.
- Para cada escena describe en inglés la ilustración (sin texto en la imagen) y el movimiento de cámara.
- No pidas que comenten, compartan, den like ni sigan la cuenta.${kind === "fiction" ? `
- El caption empieza con "${FICTION_BADGE}:".` : ""}
Devuelve exactamente este JSON: {"title":"título corto para mostrar arriba (máx. 60 caracteres)","character":"descripción en inglés del personaje principal (rasgos, peinado y ropa) para dibujarlo igual en todas las escenas; vacío si no hay personaje","caption":"texto corto para la publicación, sin pedir interacción","scenes":[{"text":"narración en español","image":"descripción en inglés","motion":"camera motion in English"}]}`;
}

// Garantiza el aviso en los relatos de ficción aunque el modelo lo olvide (narración y caption).
export function ensureFictionDisclosure(script: StoryScript): StoryScript {
  // El aviso va siempre en la primera escena: si el modelo lo puso en otra, se mueve.
  const disclosure = /[^.!?]*inspirad[ao] en la fe[^.!?]*[.!?]?/gi;
  const scenes = script.scenes.map((s, i) => i === 0 ? s : { ...s, text: s.text.replace(disclosure, "").replace(/\s{2,}/g, " ").trim() }).filter((s, i) => i === 0 || s.text);
  if (!/inspirad[ao] en la fe/i.test(scenes[0].text)) scenes[0] = { ...scenes[0], text: `${scenes[0].text.trim()} ${FICTION_DISCLOSURE}` };
  const caption = /^relato inspirador/i.test(script.caption) ? script.caption : `${FICTION_BADGE}: ${script.caption}`.trim();
  return { ...script, scenes, caption };
}

// Frases que suenan a promesa de curación; se señalan para revisarlas antes de publicar.
// Los límites se escriben con \p{L} porque \b de JavaScript no reconoce las letras con acento.
const HEALING_CLAIMS = /(?<!\p{L})(se cur[óo]|lo cur[óo]|la cur[óo]|cur[óo] su|san[óo] (milagrosamente|por completo|de)|curaci[óo]n milagrosa|desapareci[óo] (el|la|su) (c[áa]ncer|tumor|enfermedad)|(c[áa]ncer|tumor|enfermedad) (desapareci[óo]|se fue)|los m[ée]dicos no (lo|se) (pod[íi]an|explicaban))(?!\p{L})/iu;
export const healingClaims = (script: StoryScript) => script.scenes.map((s, i) => HEALING_CLAIMS.test(s.text) ? i : -1).filter(i => i >= 0);

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
