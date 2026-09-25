import { NextRequest, NextResponse } from "next/server";

type InputPost = {
  id: string;
  message?: string;
  picture?: string | null;
  permalinkUrl?: string | null;
  reactions?: number;
  comments?: number;
  shares?: number;
  createdTime?: string | null;
};

type ExtractedItem = {
  postId: string;
  text: string;
  category: string;
  tone: string;
  structure: string;
  hook: string;
  visualSummary: string;
  confidence: number;
  hasReadableText: boolean;
};

const categories = [
  "Frases identificables",
  "Humor",
  "Relaciones",
  "Nostalgia",
  "Preguntas",
  "Pensamientos nocturnos",
  "Motivación ligera",
  "Vida cotidiana",
  "Otros",
];

async function imageToDataUrl(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 EfimeroContentEngine/1.0" },
  });
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 5_000_000) throw new Error("La imagen supera el tamaño permitido para análisis.");
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function localFallback(posts: InputPost[]): ExtractedItem[] {
  return posts.map(post => ({
    postId: post.id,
    text: String(post.message || "").trim(),
    category: "Otros",
    tone: "Sin analizar",
    structure: "Sin analizar",
    hook: "",
    visualSummary: post.picture ? "Imagen pendiente de análisis con IA" : "Sin imagen",
    confidence: post.message?.trim() ? 0.55 : 0,
    hasReadableText: Boolean(post.message?.trim()),
  }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const posts: InputPost[] = Array.isArray(body.posts) ? body.posts.slice(0, 24) : [];
  if (!posts.length) return NextResponse.json({ error: "No llegaron publicaciones para analizar." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      source: "local",
      warning: "OPENAI_API_KEY no está configurada. Solo se conservaron textos existentes.",
      items: localFallback(posts),
    });
  }

  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const results: ExtractedItem[] = [];

  for (let start = 0; start < posts.length; start += 4) {
    const batch = posts.slice(start, start + 4);
    const content: any[] = [{
      type: "input_text",
      text: `Analiza publicaciones visuales de una página de Facebook. Para cada publicación debes leer el texto visible dentro de la imagen cuando exista y describir su patrón editorial.\n\nReglas:\n- Transcribe el texto principal de la creatividad, no botones, nombres de interfaz ni marcas de agua.\n- Si no hay texto legible, text debe ser cadena vacía y hasReadableText=false.\n- No inventes texto que no aparezca en la imagen.\n- category debe ser una de: ${categories.join(", ")}.\n- tone: etiqueta breve, por ejemplo reflexivo, humorístico, nostálgico, conversacional.\n- structure: patrón breve, por ejemplo "afirmación emocional directa", "pregunta simple", "remate de humor cotidiano".\n- hook: primeras palabras o tipo de apertura; no más de 8 palabras.\n- confidence entre 0 y 1.\n- Usa el postId exacto que te damos.`,
    }];

    for (const post of batch) {
      content.push({
        type: "input_text",
        text: `\nPOST_ID: ${post.id}\nTexto del caption si existe: ${String(post.message || "(vacío)").slice(0, 600)}\nReacciones: ${Number(post.reactions || 0)} | Comentarios: ${Number(post.comments || 0)} | Compartidos: ${Number(post.shares || 0)}`,
      });
      if (post.picture) {
        try {
          const dataUrl = await imageToDataUrl(post.picture);
          content.push({ type: "input_image", image_url: dataUrl });
        } catch (error: any) {
          content.push({ type: "input_text", text: `Imagen no disponible para POST_ID ${post.id}: ${error?.message || "error"}` });
        }
      }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "efimero_visual_texts",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      postId: { type: "string" },
                      text: { type: "string" },
                      category: { type: "string", enum: categories },
                      tone: { type: "string" },
                      structure: { type: "string" },
                      hook: { type: "string" },
                      visualSummary: { type: "string" },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                      hasReadableText: { type: "boolean" },
                    },
                    required: ["postId", "text", "category", "tone", "structure", "hook", "visualSummary", "confidence", "hasReadableText"],
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
      return NextResponse.json({ error: "No se pudo analizar el lote visual.", detail }, { status: 502 });
    }

    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
    try {
      const parsed = JSON.parse(outputText || "{}");
      if (Array.isArray(parsed?.items)) results.push(...parsed.items);
    } catch {
      return NextResponse.json({ error: "La respuesta de análisis visual no pudo interpretarse." }, { status: 502 });
    }
  }

  const byId = new Map(results.map(item => [String(item.postId), item]));
  const normalized = posts.map(post => byId.get(String(post.id)) || localFallback([post])[0]);
  return NextResponse.json({ source: "openai", model, items: normalized });
}
