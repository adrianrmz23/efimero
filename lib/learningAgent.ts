import { createHash } from "crypto";

export type LearningAnalysis = {
  id: string;
  category: string;
  tone: string;
  hookType: string;
  structure: string;
  theme: string;
  mechanism: string;
  lengthBucket: string;
  keywords: string[];
};

export type LearningDocument = {
  id: string;
  inspirationPostId: string;
  watchlistId: string;
  pageName: string;
  sourceText: string;
  category: string;
  tone: string;
  hookType: string;
  structure: string;
  theme: string;
  mechanism: string;
  lengthBucket: string;
  keywords: string[];
  engagementScore: number;
  embedding: number[];
};

export function normalizeLearningText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lexicalSimilarity(a: string, b: string) {
  const A = new Set(normalizeLearningText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeLearningText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  const intersection = [...A].filter(x => B.has(x)).length;
  return intersection / new Set([...A, ...B]).size;
}

export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

export function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== "string") return [];
  const clean = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!clean) return [];
  return clean.split(",").map(Number).filter(Number.isFinite);
}

export function meanVector(vectors: number[][]) {
  const valid = vectors.filter(v => v.length);
  if (!valid.length) return [] as number[];
  const length = valid[0].length;
  const out = Array.from({ length }, () => 0);
  for (const vector of valid) {
    for (let i = 0; i < Math.min(length, vector.length); i++) out[i] += vector[i];
  }
  return out.map(value => value / valid.length);
}

export function lengthBucket(text: string) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return words <= 12 ? "micro" : words <= 28 ? "corto" : words <= 55 ? "medio" : "largo";
}

export function localLearningAnalysis(id: string, text: string): LearningAnalysis {
  const normalized = normalizeLearningText(text);
  const question = /[¿?]/.test(text);
  const religious = /\b(dios|jesus|cristo|fe|oracion|biblia|salmo|isaias|senor|bendicion)\b/.test(normalized);
  const nostalgia = /\b(antes|recuerdo|infancia|nostalgia|extrano|cancion|abuelo|abuela)\b/.test(normalized);
  const relationship = /\b(amor|pareja|relacion|querer|carino|corazon|persona)\b/.test(normalized);
  const motivation = /\b(puedes|seguir|adelante|fuerza|rendirse|lograr|intenta|camino)\b/.test(normalized);
  const category = religious ? "Fe y espiritualidad" : nostalgia ? "Nostalgia" : relationship ? "Relaciones" : motivation ? "Motivación" : question ? "Pregunta/reflexión" : "Reflexión";
  const tone = religious ? "esperanzador" : nostalgia ? "nostálgico" : relationship ? "emocional" : "reflexivo";
  const hookType = question ? "pregunta directa" : /[:\-–—]/.test(text.slice(0, 70)) ? "afirmación + giro" : "afirmación directa";
  const structure = `${lengthBucket(text)} · ${question ? "pregunta" : "afirmación"} · ${text.split(/\n+/).filter(Boolean).length > 1 ? "varias líneas" : "bloque breve"}`;
  const theme = religious ? "fe ante situaciones cotidianas" : nostalgia ? "memoria y paso del tiempo" : relationship ? "vínculos y emociones" : motivation ? "superación cotidiana" : "identificación emocional";
  const mechanism = question ? "activa recuerdo o respuesta mental mediante una pregunta natural" : religious ? "conecta dificultad cotidiana con esperanza espiritual" : nostalgia ? "activa memoria autobiográfica e identificación" : "busca identificación mediante una verdad cotidiana breve";
  const keywords = normalized.split(" ").filter(x => x.length >= 5).slice(0, 6);
  return { id, category, tone, hookType, structure, theme, mechanism, lengthBucket: lengthBucket(text), keywords };
}

export function learningDescriptor(analysis: Omit<LearningAnalysis, "id"> | LearningAnalysis) {
  return [
    `Categoría: ${analysis.category}`,
    `Tono: ${analysis.tone}`,
    `Hook: ${analysis.hookType}`,
    `Estructura: ${analysis.structure}`,
    `Tema: ${analysis.theme}`,
    `Mecanismo: ${analysis.mechanism}`,
    `Longitud: ${analysis.lengthBucket}`,
    `Keywords: ${(analysis.keywords || []).join(", ")}`,
  ].join(". ");
}

export function computeRelativeEngagement(
  reactions: number,
  comments: number,
  shares: number,
  pageMaximumWeighted: number,
) {
  const weighted = Math.max(0, Number(reactions || 0) + Number(comments || 0) * 3 + Number(shares || 0) * 4);
  if (pageMaximumWeighted <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.log1p(weighted) / Math.log1p(pageMaximumWeighted)) * 100)));
}

export type LearningCluster = {
  docs: LearningDocument[];
  centroid: number[];
};

export function clusterLearningDocuments(documents: LearningDocument[], threshold = 0.79) {
  const clusters: LearningCluster[] = [];
  const ordered = [...documents].sort((a, b) => b.engagementScore - a.engagementScore);
  for (const doc of ordered) {
    if (!doc.embedding.length) continue;
    let bestIndex = -1;
    let bestScore = -1;
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const categoryMatch = cluster.docs[0]?.category === doc.category;
      const score = cosineSimilarity(cluster.centroid, doc.embedding);
      const adjusted = categoryMatch ? score + 0.025 : score;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0 && bestScore >= threshold) {
      clusters[bestIndex].docs.push(doc);
      clusters[bestIndex].centroid = meanVector(clusters[bestIndex].docs.map(x => x.embedding));
    } else {
      clusters.push({ docs: [doc], centroid: [...doc.embedding] });
    }
  }
  return clusters;
}

export function learningPatternKey(values: string[]) {
  return createHash("sha256").update(values.join("|")).digest("hex").slice(0, 28);
}
