import { NextRequest, NextResponse } from "next/server";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

const fallback = [
  "A veces uno no necesita respuestas, solo un poco de paz.",
  "Qué tranquilidad cuando dejas de forzar lo que ya no fluye.",
  "Hay recuerdos que llegan sin avisar y se quedan toda la tarde.",
  "¿Qué canción te devuelve de inmediato a otra etapa de tu vida?",
  "Dormir temprano: ese proyecto que llevo meses posponiendo.",
];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const apiKey = process.env.OPENAI_API_KEY;
  const category = String(body.category || "Frases identificables");
  const count = Math.min(Math.max(Number(body.count || 5), 1), 30);
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 12) : [];
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;

  if (!apiKey) {
    return NextResponse.json({
      source: "fallback",
      items: Array.from({ length: count }, (_, i) => `${fallback[i % fallback.length]}${i >= fallback.length ? ` · ${i + 1}` : ""}`),
    });
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const profileContext = profile
    ? `\n\nHuella editorial activa:\n- ${String(profile.generationInstruction || "")}` +
      `\n- Promedio: ${Number(profile.avgWords || 0)} palabras.` +
      `\n- Preguntas: ${Math.round(Number(profile.questionRate || 0) * 100)}%.` +
      `\n- Emojis: ${Math.round(Number(profile.emojiRate || 0) * 100)}%.` +
      `\n- Reglas: ${(Array.isArray(profile.rules) ? profile.rules : []).join(" | ")}` +
      `\n- Evitar: ${(Array.isArray(profile.avoid) ? profile.avoid : []).join(" | ")}`
    : "";

  const prompt = `Eres el motor editorial de una página de Facebook llamada Efímero. Crea ${count} publicaciones nuevas en español para la categoría "${category}".

Estilo base: breve, natural, emocional o conversacional según la categoría; fácil de leer; evita frases excesivamente solemnes, clichés obvios y tono corporativo. No copies literalmente los ejemplos. REGLA OBLIGATORIA DE META: no incluyas llamados directos a comentar, compartir, reaccionar, dar like, etiquetar, seguir la página, activar notificaciones ni cualquier engagement bait. Una pregunta natural puede existir si no ordena interactuar. Evita clickbait e incentivos artificiales.${profileContext}

Ejemplos del histórico:
${examples.map((x: string) => `- ${x}`).join("\n")}

Devuelve únicamente JSON válido con esta forma: {"items":["texto 1","texto 2"]}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "efimero_posts",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 30 },
            },
            required: ["items"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: "No se pudo generar con IA", detail: error }, { status: 502 });
  }

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
  let items: string[] = [];
  try {
    const parsed = JSON.parse(outputText || "{}");
    items = Array.isArray(parsed?.items) ? parsed.items.filter((x: unknown) => typeof x === "string").slice(0, count) : [];
  } catch {}

  const sourceItems = items.length ? items : fallback.slice(0, count);
  const compliant = sourceItems.map(text => {
    const first = localComplianceReview(text);
    if (first.status === "pass") return text;
    const cleaned = sanitizeEngagementBait(text);
    return localComplianceReview(cleaned).status === "pass" ? cleaned : "";
  }).filter(Boolean).slice(0, count);
  const safeFallback = fallback.filter(x => localComplianceReview(x).status === "pass");
  while (compliant.length < count && safeFallback.length) compliant.push(safeFallback[compliant.length % safeFallback.length]);
  return NextResponse.json({ source: "openai", items: compliant.slice(0, count), complianceChecked: true });
}
