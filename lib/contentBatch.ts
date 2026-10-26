// Lotes de contenido para el Estudio creativo: una fila = una imagen (titulo, texto, caption).
// Cada preset reproduce el estilo de una página (Efímero: frases y mixto; Ecos de la Fe: oraciones largas).
import { localComplianceReview } from "@/lib/metaCompliance";
import { fingerprint } from "@/lib/creativeDuplicates";

export type BatchRow = { titulo: string; texto: string; caption: string };
export type BatchPreset = { id: string; label: string; page: string; template: "minimal" | "photo"; perCall: number; max: number; rules: string };

const NO_BAIT = "Prohibido pedir que comenten, compartan, den like, etiqueten, escriban o sigan la página (también disfrazado: \"escribe amén\", \"completa la frase\", \"comenta tu nombre\").";

export const BATCH_PRESETS: BatchPreset[] = [
  { id: "efimero-frases", label: "Efímero · frases", page: "Efímero", template: "minimal", perCall: 25, max: 100,
    rules: `Frases ORIGINALES estilo tuit en español de México, con las que la gente se identifique y quiera mandarle a alguien. Mezcla temas: motivación y esfuerzo, desamor, fe y Dios, familia, humor de la vida diaria, reflexión. Cada frase de 6 a 35 palabras, una o dos oraciones, lenguaje cotidiano y directo. "titulo" vacío. "caption" vacío en la mayoría; en 1 de cada 4, un caption de 1 a 5 palabras o un emoji. No copies frases famosas ni de otras páginas.` },
  { id: "efimero-deseos", label: "Efímero · deseos y decretos", page: "Efímero", template: "minimal", perCall: 25, max: 100,
    rules: `Deseos y decretos positivos estilo tuit, en español de México, con gancho de noticia o aviso ("🚨 ÚLTIMA HORA:", "Aviso:", "Atención:", "Antes de que termine el año…", "Este diciembre…", "Este mes…") y deseos de prosperidad, trabajo, deudas pagadas, salud, paz, familia y que lleguen cosas buenas. Tono esperanzador, con un toque de fe en algunas. De 8 a 30 palabras. "titulo" vacío; "caption" vacío o de 1 a 4 palabras o un emoji.
Prohibido: pedir cualquier acción sobre la publicación o pantalla ("toca", "toque", "dale like", "reacciona", "escribe", "comenta", "comparte", "guarda", "si lees esto…haz"), condicionar el deseo a interactuar ("quien toque/lea/comparta esto recibirá…") y prometer resultados seguros ("serás rico", "ganarás dinero seguro", "te llegará dinero garantizado"). Se vale desear y decretar en tono de deseo ("que te llegue…", "viene lo bueno…", "lo que pides ya va en camino").` },
  { id: "efimero-mixto", label: "Efímero · mixto", page: "Efímero", template: "minimal", perCall: 20, max: 100,
    rules: `Mezcla intercalada: 45% frases estilo tuit (titulo vacío), 25% oraciones cortas (titulo "Oración por/para …", 40 a 70 palabras en versos cortos separados por saltos de línea, termina con una línea en blanco y "Amén."), 20% salmos y 10% proverbios u otros versículos (titulo con la cita, ej. "Salmo 46:1"; texto fiel a la Reina-Valera antigua escribiendo "Señor" en lugar de "Jehová", en versos cortos; usa solo versículos muy conocidos que recuerdes con exactitud). Captions cortos o vacíos.` },
  { id: "ecos-oraciones", label: "Ecos de la Fe · oraciones largas", page: "Ecos de la Fe", template: "photo", perCall: 5, max: 60,
    rules: `Oraciones largas para la plantilla con fondo: titulo "Oración por/para/de …" (no menciones días de la semana salvo que el tema lo pida). Texto de 100 a 125 palabras: un saludo en su propia línea ("Amado Dios," / "Señor," / "Padre bueno," / "Señor Jesús,"), línea en blanco, 3 o 4 párrafos separados por línea en blanco, y al final "Amén." en su propia línea. Tono cálido, devocional y cercano; peticiones concretas de la vida diaria. Sin prometer curaciones ni resultados garantizados. Captions de 2 a 8 palabras o vacíos.` },
];

export function batchPrompt(preset: BatchPreset, count: number, themes: string, avoid: string[]) {
  return `Genera ${count} piezas para imágenes de Facebook.
${preset.rules}
${themes.trim() ? `Temas o enfoque pedidos: ${themes.trim()}.` : "Varía los temas lo más posible."}
Reglas generales:
- Todo original y distinto entre sí; nada repetido ni casi repetido.
- ${NO_BAIT}
- Sin promesas de curación, dinero o milagros garantizados.
${avoid.length ? `- No repitas ni parafrasees estas piezas ya existentes:\n${avoid.slice(0, 60).map(a => `  · ${a}`).join("\n")}` : ""}
Devuelve SOLO JSON válido: {"items":[{"titulo":"","texto":"","caption":""}]} con exactamente ${count} elementos. En "texto" usa \\n para los saltos de línea.`;
}

// Los modelos a veces escriben saltos de línea reales dentro de los textos del JSON (inválido); se escapan aquí.
function escapeNewlinesInStrings(json: string) {
  let out = "", inString = false, escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === "\\") { escaped = true; out += ch; continue; }
      if (ch === '"') inString = false;
      out += ch === "\n" ? "\\n" : ch === "\r" ? "" : ch === "\t" ? "\\t" : ch;
    } else { if (ch === '"') inString = true; out += ch; }
  }
  return out;
}

export function parseBatch(raw: string): BatchRow[] {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(escapeNewlinesInStrings(raw.slice(start, end + 1)));
    return (Array.isArray(data.items) ? data.items : []).map((x: any) => ({ titulo: String(x?.titulo ?? x?.title ?? "").trim(), texto: String(x?.texto ?? x?.text ?? "").replace(/\r\n?/g, "\n").trim(), caption: String(x?.caption ?? "").trim() })).filter((r: BatchRow) => r.texto);
  } catch { return []; }
}

// Interacción con la publicación o promesas seguras de dinero: Meta lo trata como engagement bait o engaño.
const INTERACTION_BAIT = /((?<!\p{L})(toca|toque|toquen|toques|comparte|comparta|guarda|reacciona a|dale like a|dale me gusta a) (esta|este|esto)(?!\p{L})|(?<!\p{L})(quien|cualquiera que|el que|la que) (toque|lea|vea|comparta|reaccione)|dale like|dale me gusta|escribe am[eé]n|escribe s[ií]|comenta (am[eé]n|tu|s[ií])|etiqueta a)/iu;
const MONEY_PROMISE = /(ser[aá]s? ric[oa]|ser[aá]n ric[oa]s|millonari[oa]|ganar[aá]s? (mucho )?dinero|dinero (seguro|garantizad[oa])|te llegar[aá] dinero seguro)/iu;

const WEEKDAYS = /(?<!\p{L})(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?!\p{L})/iu;
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

// Revisa cada fila: repetidas (en el lote o contra lo que ya existe), Compliance local y forma esperada del preset.
export function screenRows(preset: BatchPreset, rows: BatchRow[], existing: string[], themes = "") {
  const seen = new Set(existing.map(fingerprint).filter(k => k.length >= 12));
  const accepted: BatchRow[] = [];
  const rejected: Array<BatchRow & { reason: string }> = [];
  for (const row of rows) {
    const key = fingerprint(row.texto);
    let reason = "";
    if (key.length < 12) reason = "Muy corta";
    else if (seen.has(key)) reason = "Repetida";
    else if ([row.texto, row.caption].some(t => t && localComplianceReview(t).status !== "pass")) reason = "No pasa Compliance";
    else if ([row.texto, row.caption].some(t => t && INTERACTION_BAIT.test(t))) reason = "Pide interacción";
    else if ([row.texto, row.caption].some(t => t && MONEY_PROMISE.test(t))) reason = "Promete dinero seguro";
    else if (preset.id === "ecos-oraciones" && !WEEKDAYS.test(themes) && WEEKDAYS.test(`${row.titulo} ${row.texto}`)) reason = "Menciona un día de la semana";
    else if (preset.id === "ecos-oraciones" && (wordCount(row.texto) < 70 || !/Am[eé]n\.?\s*$/i.test(row.texto))) reason = "Oración incompleta";
    if (reason) { rejected.push({ ...row, reason }); continue; }
    seen.add(key); accepted.push(row);
  }
  return { accepted, rejected };
}

// CSV con BOM para que Excel respete acentos; los saltos de línea quedan dentro de la celda.
export function rowsToCsv(rows: BatchRow[]) {
  const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, "\r\n")}"`;
  return "﻿" + [["titulo", "texto", "caption"], ...rows.map(r => [r.titulo, r.texto, r.caption])].map(r => r.map(cell).join(",")).join("\r\n");
}
