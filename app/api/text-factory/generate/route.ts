import { NextRequest, NextResponse } from "next/server";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

type Example = {
  text: string;
  category?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
  performanceScore?: number;
  structure?: string;
  hook?: string;
};

const fallback = [
  "Qué paz cuando ya no tienes que insistir para sentirte importante.",
  "Hay personas que se van y, sin querer, también se llevan una versión de ti.",
  "¿Qué pequeña cosa te hace sentir que todo va a estar bien?",
  "La adultez es cancelar un plan y sentir que te regalaron una tarde.",
  "A veces avanzar se parece más a soltar que a seguir corriendo.",
];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const count = Math.max(1, Math.min(30, Number(body.count || 10)));
  const category = String(body.category || "Automática");
  const objective = String(body.objective || "Equilibrado");
  const length = String(body.length || "Automática");
  const examples: Example[] = Array.isArray(body.examples) ? body.examples.slice(0, 24) : [];
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  const learningProfile = body.learningProfile && typeof body.learningProfile === "object" ? body.learningProfile : null;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "fallback",
      items: Array.from({ length: count }, (_, i) => ({
        text: fallback[i % fallback.length] + (i >= fallback.length ? ` · ${i + 1}` : ""),
        category: category === "Automática" ? "Frases identificables" : category,
        pattern: "fallback local",
      })),
    });
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const profileContext = profile ? `\nHuella editorial: ${String(profile.generationInstruction || profile.summary || "")}` : "";
  const learningContext = learningProfile ? `\nAprendizaje por rendimiento: ${String(learningProfile.generationInstruction || "")}\nReglas observadas: ${(Array.isArray(learningProfile.rules)?learningProfile.rules:[]).join(" | ")}` : "";
  const sample = examples.map((x, i) => {
    const metrics = `👍${Number(x.reactions || 0)} 💬${Number(x.comments || 0)} ↗${Number(x.shares || 0)}`;
    return `${i + 1}. [${x.category || "General"}] ${x.text} | ${metrics}${x.structure ? ` | patrón: ${x.structure}` : ""}`;
  }).join("\n");

  const prompt = `Eres la Fábrica de Textos de Efímero. Genera ${count} textos NUEVOS para Facebook.\n\nObjetivo editorial: ${objective}.\nCategoría solicitada: ${category}.\nLongitud: ${length}.\n${profileContext}${learningContext}\n\nUsa los ejemplos solo para aprender estructuras, longitud, tono y tipos de hook. NO copies frases, metáforas distintivas ni secuencias de palabras. Evita variantes casi idénticas. Cada texto debe poder publicarse por sí solo y sonar natural en español de México.\n\nSi el objetivo es Compartibilidad, prioriza identificación emocional sin pedir que compartan. Si es Comentarios, usa preguntas naturales pero NUNCA ordenes comentar ni responder. Si es Equilibrado, mezcla identificación, conversación y variedad. REGLA OBLIGATORIA META: no incluyas llamados directos a comentar, compartir, reaccionar, dar like, etiquetar, seguir la página o activar notificaciones; no uses engagement bait, clickbait ni incentivos artificiales.\n\nHistórico de referencia con señales de rendimiento:\n${sample || "Sin ejemplos disponibles."}\n\nDevuelve JSON válido. Para cada texto incluye un pattern breve que describa su estructura, no una predicción de viralidad.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "efimero_factory_batch",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                minItems: 1,
                maxItems: 30,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    text: { type: "string" },
                    category: { type: "string" },
                    pattern: { type: "string" },
                  },
                  required: ["text", "category", "pattern"],
                },
              },
            },
            required: ["items"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "No se pudo generar el lote de textos.", detail }, { status: 502 });
  }

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
  try {
    const parsed = JSON.parse(outputText || "{}");
    const rawItems = Array.isArray(parsed?.items) ? parsed.items.slice(0, count) : [];
    const items = rawItems.map((item:any) => {
      const rawText = String(item?.text || "").trim();
      const first = localComplianceReview(rawText);
      const text = first.status === "pass" ? rawText : sanitizeEngagementBait(rawText);
      const compliance = localComplianceReview(text);
      return { ...item, text, compliance };
    }).filter((item:any) => item.text && item.compliance.status !== "block");
    return NextResponse.json({ source: "openai", model, items, complianceChecked: true });
  } catch {
    return NextResponse.json({ error: "La respuesta del generador no pudo interpretarse." }, { status: 502 });
  }
}
