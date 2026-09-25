export type ComplianceStatus = "pass" | "review" | "block";
export type ComplianceIssue = { code:string; severity:"low"|"medium"|"high"; message:string; match?:string };
export type ComplianceResult = {
  status: ComplianceStatus;
  score: number;
  issues: ComplianceIssue[];
  correctedText?: string;
  reviewedAt: string;
  rulesetVersion: string;
  rulesChecked: string[];
};

export const META_RULESET_VERSION = process.env.META_POLICY_RULESET_VERSION || "2026-09";
export const META_RULES = [
  "Sin engagement bait ni solicitudes artificiales de likes, reacciones, comentarios, compartidos, etiquetas o follows.",
  "Sin clickbait, promesas engañosas, titulares que oculten información esencial ni afirmaciones sensacionalistas.",
  "Sin spam, contenido repetitivo o variaciones mínimas creadas para forzar distribución.",
  "Sin incentivos, premios o dinero a cambio de interacción.",
  "Sin lenguaje que intente manipular explícitamente el algoritmo o la monetización.",
  "Sin contenido que infrinja Normas comunitarias, propiedad intelectual o categorías restringidas/prohibidas de monetización.",
  "Evitar desinformación, afirmaciones engañosas y promesas absolutas en salud, finanzas, legal u otros temas de alto impacto.",
  "Evitar sexualización, violencia gráfica, odio, acoso, explotación, actividades ilícitas o promoción de bienes/servicios restringidos.",
  "Evitar contenido no original, copias casi literales, marcas de agua ajenas o reutilización que pueda generar problemas de propiedad intelectual/originalidad.",
  "Evitar lenguaje diseñado para explotar tragedias, conmoción o temas sensibles solo con fines de monetización o interacción.",
  "Las preguntas orgánicas son válidas; no deben ordenar al usuario comentar, compartir, reaccionar o etiquetar.",
];

const patterns: Array<{code:string; severity:"medium"|"high"; re:RegExp; message:string}> = [
  { code:"ENGAGEMENT_COMMENT", severity:"high", re:/\b(comenta|comenten|escribe en los comentarios|déjalo en comentarios|pon en comentarios|cuéntanos en comentarios)\b/i, message:"Solicita comentarios de forma directa." },
  { code:"ENGAGEMENT_SHARE", severity:"high", re:/\b(comparte|compártelo|comparte esto|comparte si|envíaselo a|mándaselo a)\b/i, message:"Solicita compartir o reenviar el contenido." },
  { code:"ENGAGEMENT_TAG", severity:"high", re:/\b(etiqueta|etiqueten|menciona a|taggea|taguea)\b/i, message:"Solicita etiquetar o mencionar personas." },
  { code:"ENGAGEMENT_REACT", severity:"high", re:/\b(dale like|da like|reacciona|reacciona con|deja un like|me encanta si|like si)\b/i, message:"Solicita reacciones o Me gusta." },
  { code:"ENGAGEMENT_FOLLOW", severity:"medium", re:/\b(síguenos|sigue la página|activa las notificaciones|hazte seguidor)\b/i, message:"Incluye una llamada directa a seguir o activar notificaciones." },
  { code:"ALGO_MANIPULATION", severity:"high", re:/\b(para que facebook|para que el algoritmo|hazlo viral|viraliza|rompe el algoritmo)\b/i, message:"Intenta manipular explícitamente distribución o algoritmo." },
  { code:"INCENTIVIZED_ENGAGEMENT", severity:"high", re:/\b(gana|premio|sorteo|dinero|regalo)\b.{0,40}\b(like|comenta|comparte|etiqueta|sigue)\b/i, message:"Parece ofrecer un incentivo a cambio de interacción." },
  { code:"CLICKBAIT", severity:"medium", re:/\b(no vas a creer|te sorprenderá|nadie te cuenta|el secreto que|esto cambiará tu vida|mira hasta el final)\b/i, message:"Usa una fórmula típica de clickbait o promesa exagerada." },
];

export function localComplianceReview(text:string): ComplianceResult {
  const value = String(text || "").trim();
  const issues:ComplianceIssue[] = [];
  for (const p of patterns) {
    const match = value.match(p.re)?.[0];
    if (match) issues.push({ code:p.code, severity:p.severity, message:p.message, match });
  }
  if (/(.)\1{8,}/.test(value)) issues.push({code:"SPAM_PATTERN",severity:"medium",message:"Contiene una repetición excesiva que puede sentirse como spam."});
  if (value.length > 900) issues.push({code:"VERY_LONG",severity:"low",message:"Texto inusualmente largo para el formato editorial; conviene revisión manual."});
  const high = issues.filter(i=>i.severity==="high").length;
  const medium = issues.filter(i=>i.severity==="medium").length;
  const score = Math.max(0, 100 - high*32 - medium*14 - issues.filter(i=>i.severity==="low").length*4);
  const status:ComplianceStatus = high ? "block" : medium ? "review" : "pass";
  return { status, score, issues, reviewedAt:new Date().toISOString(), rulesetVersion:META_RULESET_VERSION, rulesChecked:META_RULES };
}

export function sanitizeEngagementBait(text:string){
  let out = String(text||"").trim();
  const replacements:[RegExp,string][] = [
    [/\s*(comenta|comenten|escribe en los comentarios|déjalo en comentarios|pon en comentarios|cuéntanos en comentarios)[^.!?]*[.!?]?\s*$/i,""],
    [/\s*(comparte|compártelo|comparte esto|comparte si|envíaselo a|mándaselo a)[^.!?]*[.!?]?\s*$/i,""],
    [/\s*(etiqueta|etiqueten|menciona a|taggea|taguea)[^.!?]*[.!?]?\s*$/i,""],
    [/\s*(dale like|da like|reacciona|reacciona con|deja un like|me encanta si|like si)[^.!?]*[.!?]?\s*$/i,""],
  ];
  for (const [re,rep] of replacements) out=out.replace(re,rep).trim();
  return out;
}
