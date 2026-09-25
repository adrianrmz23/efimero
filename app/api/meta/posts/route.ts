import { NextRequest, NextResponse } from "next/server";
import { graphGet, resolvePageToken } from "../_shared";

export const dynamic = "force-dynamic";

type RawPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

async function getReach(postId: string, token: string) {
  const metric = (process.env.META_POST_REACH_METRIC || "").trim();
  if (!metric) return 0;
  try {
    const data = await graphGet(`${postId}/insights`, { metric, access_token: token });
    const value = data?.data?.[0]?.values?.[0]?.value;
    return typeof value === "number" ? value : Number(value || 0);
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const pageId = (request.nextUrl.searchParams.get("pageId") || process.env.META_PAGE_ID || "").trim();
  const limit = Math.max(5, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 25)));
  const includeInsights = request.nextUrl.searchParams.get("includeInsights") === "1";
  const after = request.nextUrl.searchParams.get("after") || "";

  if (!pageId) return NextResponse.json({ error: "Falta pageId." }, { status: 400 });

  try {
    const token = await resolvePageToken(pageId);
    let feed: any;
    try {
      feed = await graphGet(`${pageId}/posts`, {
        fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)",
        limit,
        after,
        access_token: token,
      });
    } catch {
      // Fallback: algunos permisos/campos de engagement pueden no estar disponibles todavía.
      feed = await graphGet(`${pageId}/posts`, {
        fields: "id,message,created_time,permalink_url,full_picture,shares",
        limit,
        after,
        access_token: token,
      });
    }

    const raw: RawPost[] = feed?.data || [];
    const reaches = includeInsights
      ? await Promise.all(raw.slice(0, 30).map(post => getReach(post.id, token)))
      : raw.map(() => 0);

    const posts = raw.map((post, index) => ({
      id: post.id,
      message: post.message || "",
      createdTime: post.created_time || null,
      permalinkUrl: post.permalink_url || null,
      picture: post.full_picture || null,
      reactions: Number(post.reactions?.summary?.total_count || 0),
      comments: Number(post.comments?.summary?.total_count || 0),
      shares: Number(post.shares?.count || 0),
      reach: Number(reaches[index] || 0),
    }));

    return NextResponse.json({
      pageId,
      posts,
      paging: { after: feed?.paging?.cursors?.after || null, hasNext: Boolean(feed?.paging?.next) },
      insightsRequested: includeInsights,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible importar publicaciones." }, { status: 502 });
  }
}
