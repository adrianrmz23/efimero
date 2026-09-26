import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const db = getSupabaseAdmin();
  try {
    const [pages, watchlist, posts, docs, patternCount, patterns, ownDataset, lastRun] = await Promise.all([
      db.from("efimero_inspiration_watchlist").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id).eq("enabled", true),
      db.from("efimero_inspiration_watchlist").select("id,name,page_url,last_synced_at,sync_status").eq("owner_user_id", user.id).eq("enabled", true).order("created_at", { ascending: false }).limit(20),
      db.from("efimero_inspiration_posts").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
      db.from("efimero_learning_documents").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
      db.from("efimero_learning_patterns").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
      db.from("efimero_learning_patterns").select("id,title,category,tone,mechanism,description,sample_size,avg_engagement_score,source_pages,updated_at").eq("owner_user_id", user.id).order("sample_size", { ascending: false }).order("avg_engagement_score", { ascending: false }).limit(18),
      db.from("efimero_editorial_dataset").select("id", { count: "exact", head: true }),
      db.from("efimero_learning_runs").select("id,source_posts,analyzed_posts,patterns_found,stats,created_at").eq("owner_user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return NextResponse.json({
      pages: pages.count || 0,
      watchlist: watchlist.data || [],
      posts: posts.count || 0,
      analyzed: docs.count || 0,
      ownDataset: ownDataset.count || 0,
      patterns: patterns.data || [],
      patternCount: patternCount.count || 0,
      lastRun: lastRun.data || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No fue posible leer el estado del Learning Agent.") }, { status: 500 });
  }
}
