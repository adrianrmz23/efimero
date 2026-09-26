import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { retrieveBrightDataSnapshot, startBrightDataFacebookScrape, type BrightDataPost } from "@/lib/brightData";

function isFacebookUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host === "facebook.com" || host === "www.facebook.com" || host.endsWith(".facebook.com");
  } catch { return false; }
}

async function persistPosts(ownerUserId: string, watchlistId: string, posts: BrightDataPost[]) {
  const db = getSupabaseAdmin();
  if (posts.length) {
    const rows = posts.map(post => ({
      owner_user_id: ownerUserId,
      watchlist_id: watchlistId,
      provider: "brightdata",
      provider_post_id: post.providerPostId,
      post_url: post.postUrl || null,
      text: post.text || "",
      posted_at: post.postedAt || null,
      reactions: post.reactions || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
      raw: post.raw || {},
      captured_at: new Date().toISOString(),
    }));
    const { error } = await db.from("efimero_inspiration_posts").upsert(rows, { onConflict: "watchlist_id,provider_post_id" });
    if (error) throw error;
  }
  const { error: watchError } = await db.from("efimero_inspiration_watchlist").update({
    provider: "brightdata",
    last_synced_at: new Date().toISOString(),
    sync_status: "ready",
    last_sync_error: null,
    last_snapshot_id: null,
    updated_at: new Date().toISOString(),
  }).eq("id", watchlistId).eq("owner_user_id", ownerUserId);
  if (watchError) throw watchError;
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const watchlistId = String(body.watchlistId || "").trim();
  if (!watchlistId) return NextResponse.json({ error: "Falta watchlistId." }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: watch } = await db.from("efimero_inspiration_watchlist").select("id,page_url,last_snapshot_id").eq("id", watchlistId).eq("owner_user_id", user.id).maybeSingle();
  if (!watch) return NextResponse.json({ error: "La página no existe en tu Watchlist." }, { status: 404 });

  try {
    let posts: BrightDataPost[] = [];
    let snapshotId = String(body.snapshotId || watch.last_snapshot_id || "").trim();
    if (String(body.action || "") === "poll" && snapshotId) {
      const result = await retrieveBrightDataSnapshot(snapshotId);
      if (!result.ready) return NextResponse.json({ status: "processing", snapshotId });
      posts = result.posts;
    } else {
      const pageUrl = String(watch.page_url || body.pageUrl || "").trim();
      if (!isFacebookUrl(pageUrl)) return NextResponse.json({ error: "La Watchlist necesita una URL pública de Facebook válida." }, { status: 400 });
      const result = await startBrightDataFacebookScrape({
        url: pageUrl,
        numPosts: Number(body.numPosts || 25),
        startDate: String(body.startDate || "").trim() || undefined,
        endDate: String(body.endDate || "").trim() || undefined,
      });
      if (result.pending) {
        snapshotId = result.snapshotId;
        await db.from("efimero_inspiration_watchlist").update({
          provider: "brightdata", sync_status: "processing", last_snapshot_id: snapshotId, last_sync_error: null, updated_at: new Date().toISOString(),
        }).eq("id", watchlistId).eq("owner_user_id", user.id);
        return NextResponse.json({ status: "processing", snapshotId });
      }
      posts = result.posts;
    }

    await persistPosts(user.id, watchlistId, posts);
    return NextResponse.json({ status: "ready", posts, count: posts.length });
  } catch (error: any) {
    const message = String(error?.message || "No se pudo sincronizar con Bright Data.").slice(0, 900);
    await db.from("efimero_inspiration_watchlist").update({ sync_status: "error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", watchlistId).eq("owner_user_id", user.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
