// Historias narradas: guion por escenas, estilos de ilustración y sincronía entre voz, escenas y subtítulos.
// `showsSaint`: la escena debe dibujar al santo (con su iconografía de `saint`).
export type StoryScene = { text: string; image: string; motion: string; showsSaint?: boolean };
// `cast`: todos los personajes que se repiten (personas y animales) con su aspecto, para dibujarlos siempre igual.
export type CastMember = { name: string; look: string };
export type StoryScript = { title: string; character: string; cast?: CastMember[]; saint?: string; caption: string; cover?: string; coverWord?: string; scenes: StoryScene[] };
export type TimedWord = { text: string; start: number; end: number };

export const STORY_STYLES: Record<string, { label: string; prompt: string }> = {
  cartoon: { label: "Caricatura de cómic", prompt: "2D cartoon comic illustration, bold clean black outlines, flat colors with soft gradients, expressive faces, cinematic dramatic lighting" },
  realistic: { label: "Ilustración realista", prompt: "realistic cinematic digital painting like movie concept art, painterly brushwork, realistic human proportions and skin textures, soft volumetric light, no outlines, not cartoon, not comic" },
  anime: { label: "Anime", prompt: "Japanese anime film still, hand-drawn anime style, soft cel shading, large expressive anime eyes, detailed painted background, warm cinematic light" },
  watercolor: { label: "Acuarela", prompt: "watercolor storybook illustration, soft textured paper, warm muted colors" },
};
export const styleSuffix = (style: string) => `${(STORY_STYLES[style] || STORY_STYLES.cartoon).prompt}, single full-bleed vertical 9:16 illustration, no comic panels, no borders, no frames, no text, no letters, no watermark.`;

export type StoryKind = "real" | "fiction" | "bible" | "psalm" | "prayer";
export const STORY_KINDS: Array<{ id: StoryKind; label: string; placeholder: string }> = [
  { id: "real", label: "Historia real", placeholder: "Ej. Roy Sullivan, el guardabosques al que le cayeron siete rayos y sobrevivió" },
  { id: "fiction", label: "Relato inspirador (ficción)", placeholder: "Ej. Una mamá que le pide a San Judas Tadeo por el trabajo de su esposo y la familia sale adelante" },
  { id: "bible", label: "Historia bíblica", placeholder: "Ej. David y Goliat · Jonás y el gran pez · Jesús calma la tormenta" },
  { id: "psalm", label: "Salmo narrado", placeholder: "Ej. Salmo 23 · Salmo 91 · Salmo 121" },
  { id: "prayer", label: "Oración narrada", placeholder: "Ej. Oración por los hijos que están lejos · Oración para dormir en paz" },
];
// Tipos que citan la Biblia: se avisa que hay que revisar el texto antes de publicar.
export const QUOTES_SCRIPTURE: StoryKind[] = ["bible", "psalm"];
// Aviso fijo en pantalla y frase que debe aparecer en la narración de los relatos de ficción.
export const FICTION_BADGE = "Relato inspirador";
export const FICTION_DISCLOSURE = "Esta historia está inspirada en la fe de muchas familias.";

// Ganchos: la primera frase decide si la gente se queda; se piden con técnicas concretas y se prohíben aperturas planas.
const HOOK_RULES = `- La PRIMERA FRASE es el gancho y decide si la gente sigue viendo: de 6 a 14 palabras, concreta y visual, que abra una pregunta urgente en la mente. Usa una de estas técnicas: un riesgo inmediato con cuenta regresiva ("Le quedaban tres días para perder su casa."), una imagen impactante ("Cerró la puerta para que sus hijos no la vieran llorar."), una contradicción ("Los médicos ya se habían despedido de él… pero su madre no."), o una frase que nadie esperaría.
- PROHIBIDO empezar con "Esta es la historia de", "Había una vez", "¿Sabías que", "En un pequeño pueblo" o con fechas.
- A la mitad, una frase de giro que mantenga la tensión ("Pero esa noche, todo empeoró.").
- El título en pantalla es corto e intrigante, no un resumen.`;

const REAL_RULES = `- Solo hechos verdaderos y verificables; no inventes datos, fechas, cifras ni frases textuales. Si no estás seguro de un dato, no lo incluyas.
- Narración total de 110 a 140 palabras, frases cortas, tono de documental intrigante, español latino.`;

// Relato de ficción: personajes comunes inventados, sin hacerlos pasar por un caso real y sin prometer curaciones.
const FICTION_RULES = `- Es un relato de ficción inspirador, NO un caso real: personajes comunes inventados (solo nombre de pila), sin apellidos, ciudades exactas, fechas ni detalles que lo hagan parecer un caso documentado.
- La primera escena empieza con el gancho y termina con esta frase exacta: "${FICTION_DISCLOSURE}"
- Estructura: gancho, situación difícil con drama y tensión, momento de fe y oración, final feliz y esperanzador, y una invocación corta al santo o a Dios.
- Sin promesas de sanación: no digas que la oración curó una enfermedad ni que algo desapareció milagrosamente. En temas de salud, los médicos atienden y la fe da fuerza, paz y esperanza; el final feliz puede ser recuperación con atención médica, reconciliación, trabajo, regreso a casa o paz.
- Tono cálido y devocional, español latino, narración total de 110 a 140 palabras, frases cortas.`;

// Historia bíblica: fiel al relato de la Biblia, con drama pero sin agregar hechos.
const BIBLE_RULES = `- Es un relato bíblico: sé fiel a lo que narra la Biblia (indica en el título o la primera escena el libro, por ejemplo "1 Samuel 17"). No agregues hechos, diálogos ni personajes que no estén en el texto; puedes describir emociones y escenarios para dar drama.
- Estructura: gancho, conflicto con tensión creciente, momento decisivo de fe, desenlace y una enseñanza breve en una frase final.
- Tono épico y reverente, español latino, narración total de 110 a 140 palabras, frases cortas.
- Personajes bíblicos con vestimenta y entorno de la época (Antiguo Oriente o Israel del siglo I), descritos en "cast".`;

// Salmo narrado: el texto del salmo se lee tal cual, con imágenes que ilustran cada verso.
const PSALM_RULES = `- Es un salmo narrado: después de un gancho de una frase (que no es parte del salmo), la narración es el texto del salmo fiel a la Reina-Valera antigua, escribiendo "Señor" en lugar de "Jehová". Si el salmo es largo, usa sus versículos más conocidos sin alterarlos.
- Termina con una frase breve de oración o "Amén."; nada más.
- Cada escena ilustra lo que dice su versículo con imágenes simbólicas y emotivas (paisajes, luz, una persona orando, familias); "character" vacío salvo que haya una persona que se repita.
- Tono sereno y reverente, para leerse despacio; título con la cita, por ejemplo "Salmo 23".`;

// Oración narrada: una oración original leída con imágenes de situaciones de la vida diaria.
const PRAYER_RULES = `- Es una oración narrada, original: empieza con una frase gancho que nombre la necesidad ("Si hoy no puedes dormir, esta oración es para ti."), luego un saludo a Dios y la oración en frases cortas, y termina con "Amén."
- Cada escena muestra una situación cotidiana que corresponde a lo que se pide (madre preocupada, familia en la mesa, trabajador al amanecer…).
- Sin promesas de curación ni de resultados garantizados. Tono cálido y devocional, narración de 100 a 130 palabras.`;

const kindRules = (kind: StoryKind) => kind === "fiction" ? FICTION_RULES : kind === "bible" ? BIBLE_RULES : kind === "psalm" ? PSALM_RULES : kind === "prayer" ? PRAYER_RULES : REAL_RULES;

// Si la historia es de un santo, debe VERSE: aparece con su iconografía en las escenas clave.
const saintRules = (saintLook: string) => `- La historia es de un santo: el santo debe APARECER en la imagen al menos en 3 escenas (marca esas escenas con "showsSaint": true): cuando lo invocan (su imagen, estampa o figura cobra vida con luz suave o se aparece en sueños), en el momento decisivo (presencia luminosa que acompaña, consuela o guía, sin hacer magia) y en el final feliz (bendiciendo a la familia desde una luz cálida).
- En esas escenas la descripción en inglés de la ilustración incluye al santo junto a los personajes.
- Campo "saint": descripción en inglés del santo con su iconografía tradicional${saintLook ? `; usa exactamente esta: ${saintLook}` : ""}.`;

export function scriptPrompt(topic: string, scenes: number, kind: StoryKind = "real", saintLook = "", isSaintStory = Boolean(saintLook)) {
  return `Escribe el guion de un short vertical de 40 a 60 segundos sobre: ${topic}.
Reglas:
${HOOK_RULES}
${kindRules(kind)}${isSaintStory ? `\n${saintRules(saintLook)}` : ""}
- Divide la narración en ${scenes} escenas en orden; cada escena tiene 1 o 2 frases.
- Para cada escena describe en inglés la ilustración (sin texto en la imagen) y el movimiento de cámara.
- En las descripciones de la ilustración NUNCA nombres a un personaje solo por su nombre: escribe siempre quién es y cómo se ve (ej. "Tomás, the small brown-and-white puppy dog", "Luna, the 9-year-old girl"). Un animal siempre es un animal en todas las escenas.
- En "cast" incluye a TODOS los personajes que se repiten (personas y animales), con su aspecto en inglés.
- No pidas que comenten, compartan, den like ni sigan la cuenta.${kind === "fiction" ? `
- El caption empieza con "${FICTION_BADGE}:".` : ""}
- Además propone el texto de la PORTADA del reel: 2 a 6 palabras en mayúsculas, muy llamativas, que den curiosidad o emoción sin mentir ni exagerar (ej. "LE QUEDABAN 3 DÍAS", "NADIE CREÍA EN ÉL", "SALMO PARA DORMIR EN PAZ"), y la palabra que debe resaltarse en color.
Devuelve exactamente este JSON: {"title":"título corto e intrigante para mostrar arriba (máx. 60 caracteres)","cover":"TEXTO DE PORTADA","coverWord":"PALABRA A RESALTAR","character":"descripción en inglés del personaje principal (rasgos, peinado y ropa) para dibujarlo igual en todas las escenas; vacío si no hay personaje","cast":[{"name":"nombre","look":"species, age, appearance and clothes in English"}],"saint":"descripción en inglés del santo con su iconografía; vacío si no hay santo","caption":"texto corto para la publicación, sin pedir interacción","scenes":[{"text":"narración en español","image":"descripción en inglés","motion":"camera motion in English","showsSaint":false}]}`;
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
  const scenes = (Array.isArray(data.scenes) ? data.scenes : []).map((s: any) => ({ text: String(s?.text || "").trim(), image: String(s?.image || "").trim(), motion: String(s?.motion || "").trim(), showsSaint: s?.showsSaint === true })).filter((s: StoryScene) => s.text);
  if (scenes.length < 2) throw new Error("El guion llegó sin escenas suficientes. Intenta de nuevo.");
  const cast = (Array.isArray(data.cast) ? data.cast : []).map((c: any) => ({ name: String(c?.name || "").trim(), look: String(c?.look || "").trim() })).filter((c: CastMember) => c.name && c.look).slice(0, 8);
  return { title: String(data.title || "").trim().slice(0, 80), cover: String(data.cover || "").trim().slice(0, 60), coverWord: String(data.coverWord || "").trim().slice(0, 30), character: String(data.character || "").trim(), cast, saint: String(data.saint || "").trim(), caption: String(data.caption || "").trim(), scenes: scenes.slice(0, 14) };
}

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// Personajes que salen en una escena (por su nombre en la narración o en la descripción), con su aspecto.
export function castInScene(script: StoryScript, scene: StoryScene) {
  const haystack = plain(`${scene.text} ${scene.image}`);
  return (script.cast || []).filter(c => new RegExp(`(?<![\\p{L}])${plain(c.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(haystack));
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
