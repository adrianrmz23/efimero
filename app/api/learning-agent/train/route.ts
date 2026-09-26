import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";
import {
  clusterLearningDocuments,
  computeRelativeEngagement,
  learningDescriptor,
  learningPatternKey,
  localLearningAnalysis,
  parseVector,
  type LearningAnalysis,
  type LearningDocument,
} from "@/lib/learningAgent";

const MAX_POSTS_PER_RUN = 400;
const ANALYSIS_BATCH = 20;
const EMBEDDING_BATCH = 80;

function outputText(data: any) {
  return data?.output_text || data?.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text || "";
}

async function analyzeBatch(posts: Array<{ id: string; text: string }>): Promise<LearningAnalysis[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return posts.map(post => localLearningAnalysis(post.id, post.text));
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const prompt = `Actúas como analista editorial. Vas a recibir publicaciones públicas de Facebook de páginas externas.\n\nNO debes reescribirlas ni sugerir copias. Solo abstrae patrones editoriales.\n\nPara cada publicación devuelve:\n- category: categoría editorial general.\n- tone: tono dominante.\n- hookType: tipo de apertura, no una copia literal.\n- structure: arquitectura del copy.\n- theme: tema general.\n- mechanism: mecanismo editorial/psicológico abstracto.\n- lengthBucket: micro, corto, medio o largo.\n- keywords: máximo 6 conceptos generales.\n\nNo infieras que una publicación es viral solo por su texto. No juzgues la calidad; las métricas se calculan aparte.\n\nPUBLICACIONES:\n${posts.map((post, index) => `${index + 1}. ID=${post.id}\n${post.text.slice(0, 1200)}`).join("\n\n")}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "learning_agent_analysis",
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
                      id: { type: "string" },
                      category: { type: "string" },
                      tone: { type: "string" },
                      hookType: { type: "string" },
                      structure: { type: "string" },
                      theme: { type: "string" },
                      mechanism: { type: "string" },
                      lengthBucket: { type: "string", enum: ["micro", "corto", "medio", "largo"] },
                      keywords: { type: "array", maxItems: 6, items: { type: "string" } },
                    },
                    required: ["id", "category", "tone", "hookType", "structure", "theme", "mechanism", "lengthBucket", "keywords"],
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
    const byId = new Map<string, LearningAnalysis>();
    for (const item of Array.isArray(parsed.items) ? parsed.items : []) {
      const id = String(item?.id || "");
      if (!id) continue;
      byId.set(id, {
        id,
        category: String(item.category || "Reflexión").slice(0, 120),
        tone: String(item.tone || "reflexivo").slice(0, 120),
        hookType: String(item.hookType || "afirmación directa").slice(0, 180),
        structure: String(item.structure || "copy breve").slice(0, 260),
        theme: String(item.theme || "identificación emocional").slice(0, 220),
        mechanism: String(item.mechanism || "identificación").slice(0, 320),
        lengthBucket: ["micro", "corto", "medio", "largo"].includes(String(item.lengthBucket)) ? String(item.lengthBucket) : "corto",
        keywords: (Array.isArray(item.keywords) ? item.keywords : []).map((x: any) => String(x).slice(0, 80)).filter(Boolean).slice(0, 6),
      });
    }
    return posts.map(post => byId.get(post.id) || localLearningAnalysis(post.id, post.text));
  } catch {
    return posts.map(post => localLearningAnalysis(post.id, post.text));
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const requestedLimit = Math.max(25, Math.min(MAX_POSTS_PER_RUN, Number(body.limit || 200)));
  const force = Boolean(body.force);
  const db = getSupabaseAdmin();

  try {
    const { data: watchlist, error: watchError } = await db
      .from("efimero_inspiration_watchlist")
      .select("id,name,page_url,enabled")
      .eq("owner_user_id", user.id)
      .eq("enabled", true);
    if (watchError) throw watchError;
    const pageNames = new Map((watchlist || []).map((x: any) => [String(x.id), String(x.name || "Página externa")]));

    const activeWatchIds = [...pageNames.keys()];
    const perPageLimit = Math.max(10, Math.ceil(requestedLimit / Math.max(1, activeWatchIds.length)));
    const pagePostResults = await Promise.all(activeWatchIds.map(async watchlistId => {
      const { data, error } = await db
        .from("efimero_inspiration_posts")
        .select("id,watchlist_id,text,reactions,comments,shares,posted_at")
        .eq("owner_user_id", user.id)
        .eq("watchlist_id", watchlistId)
        .neq("text", "")
        .order("posted_at", { ascending: false })
        .limit(Math.min(400, perPageLimit));
      if (error) throw error;
      return data || [];
    }));
    const usablePosts = pagePostResults.flat()
      .filter((post: any) => String(post.text || "").trim().length >= 8)
      .slice(0, requestedLimit);
    if (!usablePosts.length) {
      return NextResponse.json({ error: "Todavía no hay posts externos sincronizados. Ve al Radar y sincroniza una o más páginas primero." }, { status: 400 });
    }

    const postIds = usablePosts.map((x: any) => x.id);
    const { data: existingDocs, error: existingError } = await db
      .from("efimero_learning_documents")
      .select("inspiration_post_id")
      .eq("owner_user_id", user.id)
      .in("inspiration_post_id", postIds);
    if (existingError && !String(existingError.message || "").includes("does not exist")) throw existingError;
    const existingSet = new Set((existingDocs || []).map((x: any) => String(x.inspiration_post_id)));
    const pending = force ? usablePosts : usablePosts.filter((post: any) => !existingSet.has(String(post.id)));

    const pageMaximumWeighted = new Map<string, number>();
    for (const post of usablePosts as any[]) {
      const weighted = Number(post.reactions || 0) + Number(post.comments || 0) * 3 + Number(post.shares || 0) * 4;
      const key = String(post.watchlist_id || "");
      pageMaximumWeighted.set(key, Math.max(pageMaximumWeighted.get(key) || 0, weighted));
    }

    let analyzedNow = 0;
    for (let offset = 0; offset < pending.length; offset += ANALYSIS_BATCH) {
      const chunk = pending.slice(offset, offset + ANALYSIS_BATCH) as any[];
      const analyses = await analyzeBatch(chunk.map(post => ({ id: String(post.id), text: String(post.text || "") })));
      const analysisById = new Map(analyses.map(item => [item.id, item]));
      const descriptors = chunk.map(post => {
        const analysis = analysisById.get(String(post.id)) || localLearningAnalysis(String(post.id), String(post.text || ""));
        return learningDescriptor(analysis);
      });
      const embeddings: number[][] = [];
      for (let i = 0; i < descriptors.length; i += EMBEDDING_BATCH) {
        const vectors = await createEmbeddings(descriptors.slice(i, i + EMBEDDING_BATCH));
        embeddings.push(...vectors);
      }
      const rows = chunk.map((post, index) => {
        const analysis = analysisById.get(String(post.id)) || localLearningAnalysis(String(post.id), String(post.text || ""));
        const engagementScore = computeRelativeEngagement(
          Number(post.reactions || 0),
          Number(post.comments || 0),
          Number(post.shares || 0),
          pageMaximumWeighted.get(String(post.watchlist_id || "")) || 0,
        );
        return {
          owner_user_id: user.id,
          inspiration_post_id: post.id,
          watchlist_id: post.watchlist_id,
          page_name: pageNames.get(String(post.watchlist_id || "")) || "Página externa",
          source_text: String(post.text || ""),
          category: analysis.category,
          tone: analysis.tone,
          hook_type: analysis.hookType,
          structure: analysis.structure,
          theme: analysis.theme,
          mechanism: analysis.mechanism,
          length_bucket: analysis.lengthBucket,
          keywords: analysis.keywords,
          engagement_score: engagementScore,
          embedding: vectorLiteral(embeddings[index] || []),
          analysis: analysis,
          analyzed_at: new Date().toISOString(),
        };
      });
      const { error: upsertError } = await db.from("efimero_learning_documents").upsert(rows, { onConflict: "inspiration_post_id" });
      if (upsertError) throw upsertError;
      analyzedNow += rows.length;
    }

    const { data: allDocs, error: docsError } = await db
      .from("efimero_learning_documents")
      .select("id,inspiration_post_id,watchlist_id,page_name,source_text,category,tone,hook_type,structure,theme,mechanism,length_bucket,keywords,engagement_score,embedding")
      .eq("owner_user_id", user.id)
      .in("watchlist_id", activeWatchIds)
      .order("engagement_score", { ascending: false })
      .limit(1200);
    if (docsError) throw docsError;

    const documents: LearningDocument[] = (allDocs || []).map((row: any) => ({
      id: String(row.id),
      inspirationPostId: String(row.inspiration_post_id),
      watchlistId: String(row.watchlist_id),
      pageName: String(row.page_name || "Página externa"),
      sourceText: String(row.source_text || ""),
      category: String(row.category || "Reflexión"),
      tone: String(row.tone || "reflexivo"),
      hookType: String(row.hook_type || "afirmación directa"),
      structure: String(row.structure || "copy breve"),
      theme: String(row.theme || "identificación emocional"),
      mechanism: String(row.mechanism || "identificación"),
      lengthBucket: String(row.length_bucket || "corto"),
      keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
      engagementScore: Number(row.engagement_score || 0),
      embedding: parseVector(row.embedding),
    })).filter(doc => doc.embedding.length);

    const clusters = clusterLearningDocuments(documents, 0.79)
      .sort((a, b) => {
        const pagesA = new Set(a.docs.map(doc => doc.pageName)).size;
        const pagesB = new Set(b.docs.map(doc => doc.pageName)).size;
        const scoreA = a.docs.length * 4 + pagesA * 8 + a.docs.reduce((sum, doc) => sum + doc.engagementScore, 0) / Math.max(1, a.docs.length);
        const scoreB = b.docs.length * 4 + pagesB * 8 + b.docs.reduce((sum, doc) => sum + doc.engagementScore, 0) / Math.max(1, b.docs.length);
        return scoreB - scoreA;
      })
      .slice(0, 60);

    const patternRows = clusters.map(cluster => {
      const docs = [...cluster.docs].sort((a, b) => b.engagementScore - a.engagementScore);
      const lead = docs[0];
      const avg = docs.reduce((sum, doc) => sum + doc.engagementScore, 0) / Math.max(1, docs.length);
      const sourcePages = [...new Set(docs.map(doc => doc.pageName))].slice(0, 20);
      const common = <T extends string>(values: T[]) => {
        const counts = new Map<string, number>();
        values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      };
      const category = common(docs.map(doc => doc.category));
      const tone = common(docs.map(doc => doc.tone));
      const mechanism = common(docs.map(doc => doc.mechanism));
      const structure = common(docs.map(doc => doc.structure));
      const theme = common(docs.map(doc => doc.theme));
      const hookType = common(docs.map(doc => doc.hookType));
      const title = `${theme || category} · ${hookType || "patrón"}`.slice(0, 180);
      const description = `Estructura: ${structure || lead.structure}. Tono: ${tone || lead.tone}. Mecanismo: ${mechanism || lead.mechanism}.`;
      return {
        owner_user_id: user.id,
        pattern_key: learningPatternKey([category, tone, mechanism, structure, theme, hookType, sourcePages.join(",")]),
        title,
        category,
        tone,
        hook_type: hookType,
        structure,
        theme,
        mechanism,
        description,
        sample_size: docs.length,
        avg_engagement_score: Number(avg.toFixed(2)),
        source_pages: sourcePages,
        source_post_ids: docs.slice(0, 30).map(doc => doc.inspirationPostId),
        embedding: vectorLiteral(cluster.centroid),
        updated_at: new Date().toISOString(),
      };
    });

    await db.from("efimero_learning_patterns").delete().eq("owner_user_id", user.id);
    if (patternRows.length) {
      const { error: patternError } = await db.from("efimero_learning_patterns").insert(patternRows);
      if (patternError) throw patternError;
    }

    const stats = {
      sourcePages: pageNames.size,
      sourcePosts: usablePosts.length,
      analyzedNow,
      analyzedTotal: documents.length,
      patternsFound: patternRows.length,
      reusedDocuments: Math.max(0, documents.length - analyzedNow),
    };
    const { error: runError } = await db.from("efimero_learning_runs").insert({
      owner_user_id: user.id,
      source_posts: usablePosts.length,
      analyzed_posts: analyzedNow,
      patterns_found: patternRows.length,
      stats,
      created_at: new Date().toISOString(),
    });
    if (runError) throw runError;

    return NextResponse.json({ ok: true, ...stats, trainedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No fue posible actualizar el aprendizaje.") }, { status: 500 });
  }
}
