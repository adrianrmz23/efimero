import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const apiKey = process.env.OPENAI_API_KEY;
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 60) : [];
  const baseProfile = body.baseProfile && typeof body.baseProfile === "object" ? body.baseProfile : {};

  if (!apiKey || !examples.length) {
    return NextResponse.json({ source: "local", profile: null });
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const sample = examples.map((x: any, i: number) => `${i + 1}. [${String(x.category || "General")}] ${String(x.text || "")}`).join("\n");
  const prompt = `Analiza la voz editorial de Efímero a partir de publicaciones reales. No evalúes si el contenido es bueno o malo. Describe patrones observables y crea instrucciones útiles para producir contenido nuevo sin copiar frases.

Métricas ya calculadas por la aplicación:
${JSON.stringify(baseProfile)}

Muestra histórica:
${sample}

Devuelve un perfil editorial conciso. Los porcentajes de tone deben ser números entre 0 y 1. Mantén reglas prácticas, específicas y en español.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "efimero_editorial_profile",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              generationInstruction: { type: "string" },
              rules: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              avoid: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              tone: {
                type: "object",
                additionalProperties: false,
                properties: {
                  reflective: { type: "number", minimum: 0, maximum: 1 },
                  conversational: { type: "number", minimum: 0, maximum: 1 },
                  humorous: { type: "number", minimum: 0, maximum: 1 },
                  emotional: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["reflective", "conversational", "humorous", "emotional"],
              },
            },
            required: ["summary", "generationInstruction", "rules", "avoid", "tone"],
          },
        },
      },
    }),
  });

  if (!response.ok) return NextResponse.json({ source: "local", profile: null });
  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
  try {
    return NextResponse.json({ source: "openai", profile: JSON.parse(outputText || "null") });
  } catch {
    return NextResponse.json({ source: "local", profile: null });
  }
}
