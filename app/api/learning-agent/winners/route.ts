import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeRelativeEngagement } from "@/lib/learningAgent";
import { effectivePostText, postImageUrl } from "@/lib/imageText";

// Publicaciones externas con más interacción, comparadas contra lo normal en su propia página.
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const days = Math.max(7, Math.min(365, Number(params.get("days") || 90)));
  const watchlistId = String(params.get("watchlistId") || "").trim();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = getSupabaseAdmin();
  try {
    const { data: watchlist, error: watchError } = await db.from("efimero_inspiration_watchlist").select("id,name").eq("owner_user_id", user.id).eq("enabled", true);
    if (watchError) throw watchError;
    const names = new Map((watchlist || []).map((x: any) => [String(x.id), String(x.name || "Página externa")]));
    const ids = watchlistId ? [watchlistId].filter(id => names.has(id)) : [...names.keys()];
    if (!ids.length) return NextResponse.json({ items: [] });
    const { data, error } = await db
      .from("efimero_inspiration_posts")
      .select("id,watchlist_id,post_url,text,reactions,comments,shares,posted_at,post_image:raw->>post_image,attachments:raw->attachments,ocr:raw->efimero_ocr")
      .eq("owner_user_id", user.id)
      .in("watchlist_id", ids)
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(1500);
    if (error) throw error;
    const weighted = (p: any) => Number(p.reactions || 0) + Number(p.comments || 0) * 3 + Number(p.shares || 0) * 4;
    const pageMax = new Map<string, number>();
    for (const post of data || []) pageMax.set(String(post.watchlist_id), Math.max(pageMax.get(String(post.watchlist_id)) || 0, weighted(post)));
    const items = (data || []).map((post: any) => {
      const imageText = String(post.ocr?.text || "");
      return {
        id: String(post.id),
        pageName: names.get(String(post.watchlist_id)) || "Página externa",
        postUrl: String(post.post_url || ""),
        text: effectivePostText(post.text, imageText),
        caption: imageText ? String(post.text || "").trim() : "",
        fromImage: imageText.trim().length >= 8,
        imageUrl: postImageUrl({ post_image: post.post_image, attachments: post.attachments }),
        reactions: Number(post.reactions || 0),
        comments: Number(post.comments || 0),
        shares: Number(post.shares || 0),
        postedAt: post.posted_at,
        score: computeRelativeEngagement(Number(post.reactions || 0), Number(post.comments || 0), Number(post.shares || 0), pageMax.get(String(post.watchlist_id)) || 0),
      };
    })
      .filter(item => item.text.length >= 8)
      .sort((a, b) => b.score - a.score || (b.shares - a.shares))
      .slice(0, 60);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudieron leer las publicaciones ganadoras.") }, { status: 500 });
  }
}
