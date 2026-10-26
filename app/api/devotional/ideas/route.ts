import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { availableProviders, generateChecked } from "@/lib/textProviders";
import { ideasPrompt, parseIdeas, rankTrends, type ShortTrend } from "@/lib/prayerIdeas";
import { loadYoutubeConnection, youtubeAccessToken } from "@/lib/youtubeServer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Algunos proveedores responden como si tuvieran herramientas («voy a verificar el calendario…»).
const NO_TOOLS = "No tienes herramientas ni acceso a internet: no digas que vas a verificar o buscar nada; responde de inmediato únicamente con el JSON.";
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Shorts en español con más vistas del último mes. Usa el canal conectado o YOUTUBE_API_KEY; sin ninguno, no hay tendencias.
async function shortTrends(userId: string, query: string): Promise<ShortTrend[]> {
  const key = (process.env.YOUTUBE_API_KEY || "").trim();
  let auth: { headers?: Record<string, string>; key?: string } | null = key ? { key } : null;
  if (!auth && await loadYoutubeConnection(userId).catch(() => null)) auth = { headers: { Authorization: `Bearer ${(await youtubeAccessToken(userId)).accessToken}` } };
  if (!auth) return [];
  const get = async (path: string, params: Record<string, string>) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    Object.entries({ ...params, ...(auth?.key ? { key: auth.key } : {}) }).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url, { headers: auth?.headers, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`YouTube respondió: ${d?.error?.message || r.status}`);
    return d;
  };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const search = await get("search", { part: "snippet", q: query, type: "video", videoDuration: "short", order: "viewCount", publishedAfter: since, relevanceLanguage: "es", regionCode: "MX", maxResults: "30" });
  const items = (search.items || []).filter((i: any) => i?.id?.videoId).map((i: any) => ({ id: i.id.videoId, title: decode(String(i.snippet?.title || "")), channel: decode(String(i.snippet?.channelTitle || "")), publishedAt: String(i.snippet?.publishedAt || "") }));
  if (!items.length) return [];
  const stats = await get("videos", { part: "statistics", id: items.map((i: { id: string }) => i.id).join(",") });
  const views: Record<string, number> = {};
  for (const v of stats.items || []) views[v.id] = Number(v.statistics?.viewCount || 0);
  return rankTrends(items, views);
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "psalm" ? "psalm" : body.kind === "prayer" ? "prayer" : "any";
  const recent = (Array.isArray(body.recent) ? body.recent : []).map((x: unknown) => String(x || "").slice(0, 120)).filter(Boolean).slice(0, 12);
  if (!availableProviders().some(p => p.ready)) return NextResponse.json({ error: "No hay proveedor de texto configurado." }, { status: 501 });
  // Las tendencias son un extra: si YouTube falla, las ideas salen igual.
  let trends: ShortTrend[] = []; let trendsError = "";
  try { trends = await shortTrends(user.id, kind === "psalm" ? "salmo" : "oración"); } catch (error: any) { trendsError = String(error?.message || "No se pudieron leer las tendencias."); }
  try {
    const today = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date());
    const result = await generateChecked("claudeapi", `Eres estratega de contenido católico para YouTube Shorts y Facebook en español latino. Respondes solo JSON válido. ${NO_TOOLS}`, ideasPrompt({ today, kind, trends, recent }), raw => { const ideas = parseIdeas(raw); if (!ideas.length) throw new Error("Llegaron sin ideas."); return ideas; });
    return NextResponse.json({ ideas: result.value, trends, trendsError, model: result.model, fallback: result.fallback });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudieron generar ideas.") }, { status: Number(error?.status || 502) });
  }
}
