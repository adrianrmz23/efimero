import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";
import { lexicalSimilarity } from "@/lib/learningAgent";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

function outputText(data: any) {
  return data?.output_text || data?.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text || "";
}

function compactExample(text: unknown, max = 260) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const objective = String(body.objective || "Crear textos frescos y naturales para Facebook").trim().slice(0, 600);
  const category = String(body.category || "").trim().slice(0, 120);
  const count = Math.max(1, Math.min(12, Number(body.count || 6)));
  const exploration = Math.max(0, Math.min(100, Number(body.exploration ?? 55)));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Falta OPENAI_API_KEY." }, { status: 500 });
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const db = getSupabaseAdmin();

  try {
    const [queryVector] = await createEmbeddings([`${category ? `Categoría: ${category}. ` : ""}${objective}`]);
    let patterns: any[] = [];
    try {
      const { data, error } = await db.rpc("match_efimero_learning_patterns", {
        query_embedding: vectorLiteral(queryVector),
        owner_filter: user.id,
        match_count: 10,
        filter_category: category || null,
      });
      if (error) throw error;
      patterns = data || [];
    } catch {
      const query = db.from("efimero_learning_patterns")
        .select("id,title,category,tone,hook_type,structure,theme,mechanism,description,sample_size,avg_engagement_score,source_pages")
        .eq("owner_user_id", user.id)
        .order("avg_engagement_score", { ascending: false })
        .order("sample_size", { ascending: false })
        .limit(10);
      const { data } = category ? await query.eq("category", category) : await query;
      patterns = data || [];
    }

    if (!patterns.length) {
      return NextResponse.json({ error: "El Learning Agent todavía no tiene patrones. Sincroniza páginas en Radar y pulsa Actualizar aprendizaje." }, { status: 400 });
    }

    let ownExamples: any[] = [];
    try {
      const { data } = await db.rpc("match_efimero_dataset", {
        query_embedding: vectorLiteral(queryVector),
        match_count: 8,
        filter_category: category || null,
      });
      ownExamples = data || [];
    } catch {
      const { data } = await db.from("efimero_editorial_dataset")
        .select("text,category,hook,topic_key,length_bucket,performance_score")
        .order("performance_score", { ascending: false })
        .limit(8);
      ownExamples = data || [];
    }

    const patternContext = patterns.slice(0, 8).map((p, index) => [
      `${index + 1}. ${String(p.title || "Patrón editorial")}`,
      `Categoría: ${String(p.category || "general")}`,
      `Tono: ${String(p.tone || "")}`,
      `Estructura: ${String(p.structure || p.description || "")}`,
      `Mecanismo: ${String(p.mechanism || "")}`,
      `Muestra: ${Number(p.sample_size || 0)} posts · señal relativa ${Math.round(Number(p.avg_engagement_score || 0))}/100`,
      `Fuentes: ${Array.isArray(p.source_pages) ? p.source_pages.slice(0, 5).join(", ") : "varias páginas"}`,
    ].join("\n")).join("\n\n");

    const ownContext = ownExamples.length
      ? ownExamples.slice(0, 8).map((item, index) => `${index + 1}. [${String(item.category || "General")}] ${compactExample(item.text)}`).join("\n")
      : "No hay suficientes ejemplos propios indexados todavía. Prioriza naturalidad y novedad.";

    const explorationInstruction = exploration <= 30
      ? "Sé conservador: usa estructuras probadas, pero cambia formulación y tema lo suficiente para que cada texto sea original."
      : exploration >= 75
        ? "Explora combinaciones nuevas: conserva mecanismos abstractos, pero cambia bastante tema, ritmo, apertura y estructura superficial."
        : "Equilibra patrones probados con novedad real. No repitas formulaciones ni remates.";

    const prompt = `Eres el Learning Agent editorial de Efímero. Genera ${count} copys ORIGINALES para Facebook.\n\nOBJETIVO:\n${objective}\n${category ? `Categoría solicitada: ${category}` : "Categoría: elige la más adecuada según los patrones."}\nNivel de exploración: ${exploration}/100. ${explorationInstruction}\n\nJERARQUÍA DE CONOCIMIENTO:\n1) La voz y los ejemplos PROPIOS de Efímero mandan sobre cualquier fuente externa.\n2) Los patrones EXTERNOS solo sirven para abstraer estructuras, hooks y mecanismos.\n3) Introduce novedad; no conviertas el resultado en una paráfrasis.\n\nPATRONES EXTERNOS APRENDIDOS (NO son textos para copiar):\n${patternContext}\n\nMEMORIA PROPIA / RAG DE EFÍMERO:\n${ownContext}\n\nREGLAS OBLIGATORIAS:\n- No copies frases distintivas, metáforas, secuencias de palabras ni cierres de páginas externas.\n- No menciones las páginas fuente.\n- Español natural de México.\n- No engagement bait: nada de pedir comentar, compartir, reaccionar, etiquetar, seguir o dar like.\n- Una pregunta natural sí es válida si el contenido funciona sin pedir interacción.\n- No clickbait ni promesas de viralidad.\n- Evita que todas las salidas usen la misma apertura.\n- Cada copy debe sostenerse por sí mismo.\n\nPara cada copy devuelve además una razón breve que explique qué patrón abstracto usó y qué cambió para mantener originalidad.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "learning_agent_generation",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  minItems: 1,
                  maxItems: 12,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      text: { type: "string" },
                      category: { type: "string" },
                      rationale: { type: "string" },
                      patternUsed: { type: "string" },
                    },
                    required: ["text", "category", "rationale", "patternUsed"],
                  },
                },
              },
              required: ["items"],
            },
          },
        },
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const parsed = JSON.parse(outputText(data) || "{}");
    let generated = (Array.isArray(parsed.items) ? parsed.items : [])
      .slice(0, count)
      .map((item: any) => ({
        text: String(item.text || "").trim(),
        category: String(item.category || category || "General").trim(),
        rationale: String(item.rationale || "").trim(),
        patternUsed: String(item.patternUsed || "").trim(),
      }))
      .filter((item: any) => item.text);

    const vectors = generated.length ? await createEmbeddings(generated.map((item: any) => item.text)) : [];
    const results: any[] = [];
    for (let index = 0; index < generated.length; index++) {
      const raw = generated[index];
      let text = raw.text;
      let compliance = localComplianceReview(text);
      if (compliance.status !== "pass") {
        text = sanitizeEngagementBait(text);
        compliance = localComplianceReview(text);
      }
      const vector = vectors[index] || [];
      let externalNearest: any[] = [];
      let ownNearest: any[] = [];
      if (vector.length) {
        try {
          const { data: ext } = await db.rpc("match_efimero_learning_documents", {
            query_embedding: vectorLiteral(vector),
            owner_filter: user.id,
            match_count: 3,
          });
          externalNearest = ext || [];
        } catch {}
        try {
          const { data: own } = await db.rpc("match_efimero_dataset", {
            query_embedding: vectorLiteral(vector),
            match_count: 3,
            filter_category: null,
          });
          ownNearest = own || [];
        } catch {}
      }

      const externalSemantic = Math.max(0, ...externalNearest.map(item => Number(item.similarity || 0)));
      const ownSemantic = Math.max(0, ...ownNearest.map(item => Number(item.similarity || 0)));
      const externalLexical = Math.max(0, ...externalNearest.map(item => lexicalSimilarity(text, String(item.source_text || ""))));
      const ownLexical = Math.max(0, ...ownNearest.map(item => lexicalSimilarity(text, String(item.text || ""))));
      const duplicateRisk = externalSemantic >= 0.88 || externalLexical >= 0.5 || ownSemantic >= 0.95 || ownLexical >= 0.72;
      const novelty = Math.max(0, Math.min(100, Math.round(100 - Math.max(externalSemantic * 92, externalLexical * 100, Math.max(0, ownSemantic - 0.72) * 120))));
      const editorialScore = Math.max(0, Math.min(100, Math.round(
        compliance.score * 0.45 +
        novelty * 0.35 +
        Math.min(100, Math.max(...patterns.map(p => Number(p.avg_engagement_score || 0)), 0)) * 0.2 -
        (duplicateRisk ? 28 : 0),
      )));

      results.push({
        ...raw,
        text,
        compliance,
        novelty,
        editorialScore,
        duplicateRisk,
        externalSimilarity: Number(externalSemantic.toFixed(3)),
        ownSimilarity: Number(ownSemantic.toFixed(3)),
        nearestExternal: externalNearest.slice(0, 3).map(item => ({
          pageName: item.page_name,
          similarity: Number(item.similarity || 0),
          category: item.category,
        })),
        nearestOwn: ownNearest.slice(0, 3).map(item => ({
          similarity: Number(item.similarity || 0),
          category: item.category,
          performanceScore: Number(item.performance_score || 0),
        })),
      });
    }

    const { error: saveError } = await db.from("efimero_learning_generations").insert({
      owner_user_id: user.id,
      objective,
      category: category || null,
      exploration,
      pattern_ids: patterns.slice(0, 8).map(item => item.id).filter(Boolean),
      result: results,
      created_at: new Date().toISOString(),
    });
    if (saveError) throw saveError;

    return NextResponse.json({
      source: "learning-agent",
      model,
      weights: { ownVoice: 50, externalPatterns: 30, exploration: 20 },
      patternsUsed: patterns.slice(0, 8),
      ownExamplesUsed: ownExamples.length,
      items: results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No fue posible generar con el Learning Agent.") }, { status: 500 });
  }
}
