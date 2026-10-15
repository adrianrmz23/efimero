import { NextRequest, NextResponse } from "next/server";
import { buildAppSecretProof, metaGraphBase } from "@/lib/metaServer";
import { graphGet, resolvePageToken } from "../_shared";

export const dynamic = "force-dynamic";

type Attachment = {
  media_type?: string;
  type?: string;
  url?: string;
  target?: { id?: string; url?: string };
};

type PublishedPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data?: Attachment[] };
};

function reelSignal(post: PublishedPost) {
  const urls = [
    String(post.permalink_url || ""),
    ...(post.attachments?.data || []).flatMap(item => [String(item.url || ""), String(item.target?.url || "")]),
  ].filter(Boolean);
  const confirmed = urls.some(url => /facebook\.com\/(?:reel|reels)\//i.test(url) || /\/reel\//i.test(url));
  const videoLike = (post.attachments?.data || []).some(item => {
    const kind = `${item.media_type || ""} ${item.type || ""}`.toLowerCase();
    return kind.includes("video");
  });
  return { confirmed, videoLike, urls };
}

async function deleteMetaPost(postId: string, token: string) {
  const url = new URL(postId.replace(/^\//, ""), metaGraphBase);
  url.searchParams.set("access_token", token);
  const proof = buildAppSecretProof(token);
  if (proof) url.searchParams.set("appsecret_proof", proof);
  const response = await fetch(url, { method: "DELETE", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error?.message || `Meta Graph API respondió ${response.status}`);
  return data;
}

async function verifyReel(postId: string, token: string) {
  const post = await graphGet(postId, {
    fields: "id,permalink_url,attachments{media_type,type,url,target{id,url}}",
    access_token: token,
  }) as PublishedPost;
  return reelSignal(post).confirmed;
}

export async function GET(request: NextRequest) {
  try {
    const pageId = String(request.nextUrl.searchParams.get("pageId") || "").trim();
    const afterParam = String(request.nextUrl.searchParams.get("after") || "").trim();
    const scanPages = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("scanPages") || 5) || 5));
    const days = Math.max(0, Number(request.nextUrl.searchParams.get("days") || 90) || 0);
    if (!pageId) return NextResponse.json({ error: "Falta pageId." }, { status: 400 });

    const token = await resolvePageToken(pageId);
    const reels: any[] = [];
    const ambiguousVideos: any[] = [];
    let after = afterParam;
    let scannedPosts = 0;
    let nextAfter = "";
    const since = days ? Math.floor((Date.now() - days * 86400_000) / 1000) : undefined;

    for (let page = 0; page < scanPages; page++) {
      const response = await graphGet(`${pageId}/published_posts`, {
        fields: "id,message,created_time,permalink_url,full_picture,attachments{media_type,type,url,target{id,url}}",
        limit: 100,
        after: after || undefined,
        since,
        access_token: token,
      });
      const items: PublishedPost[] = Array.isArray(response?.data) ? response.data : [];
      scannedPosts += items.length;

      for (const post of items) {
        const signal = reelSignal(post);
        const item = {
          id: String(post.id),
          message: String(post.message || ""),
          createdTime: post.created_time || null,
          permalinkUrl: String(post.permalink_url || signal.urls[0] || ""),
          thumbnail: String(post.full_picture || ""),
          confirmed: signal.confirmed,
        };
        if (signal.confirmed) reels.push(item);
        else if (signal.videoLike) ambiguousVideos.push(item);
      }

      const cursor = String(response?.paging?.cursors?.after || "");
      if (!cursor || cursor === after || !items.length) { nextAfter = ""; break; }
      after = cursor;
      nextAfter = cursor;
    }

    return NextResponse.json({
      ok: true,
      pageId,
      scannedPosts,
      reels,
      ambiguousVideos,
      nextAfter,
      hasMore: Boolean(nextAfter),
      days,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible consultar los Reels de Facebook." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pageId = String(body.pageId || "").trim();
    const incoming: unknown[] = Array.isArray(body.postIds) ? body.postIds : [body.postId];
    const postIds = [...new Set(incoming.map(x => String(x ?? "").trim()).filter(Boolean))].slice(0, 25);
    if (!pageId) return NextResponse.json({ error: "Falta pageId." }, { status: 400 });
    if (!postIds.length) return NextResponse.json({ error: "No hay Reels seleccionados." }, { status: 400 });

    const token = await resolvePageToken(pageId);
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const postId of postIds) {
      try {
        const confirmed = await verifyReel(postId, token);
        if (!confirmed) throw new Error("Efímero no pudo confirmar que este elemento sea un Reel. No se eliminó.");
        await deleteMetaPost(postId, token);
        results.push({ id: postId, ok: true });
      } catch (error: any) {
        results.push({ id: postId, ok: false, error: error?.message || "Meta rechazó la eliminación." });
      }
    }
    const deleted = results.filter(x => x.ok).length;
    const failed = results.length - deleted;
    return NextResponse.json({ ok: failed === 0, deleted, failed, results }, { status: failed && !deleted ? 502 : 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible eliminar los Reels." }, { status: 502 });
  }
}
