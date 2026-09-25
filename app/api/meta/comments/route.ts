import { NextRequest, NextResponse } from "next/server";
import { graphGet, resolvePageToken } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pageId = (request.nextUrl.searchParams.get("pageId") || "").trim();
  const postId = (request.nextUrl.searchParams.get("postId") || "").trim();
  const limit = Math.max(10, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 100)));
  if (!pageId || !postId) return NextResponse.json({ error: "Faltan pageId o postId." }, { status: 400 });
  try {
    const token = await resolvePageToken(pageId);
    let data:any;
    try {
      data = await graphGet(`${postId}/comments`, { fields:"id,message,created_time,like_count", filter:"stream", order:"reverse_chronological", limit, access_token:token });
    } catch {
      data = await graphGet(`${postId}/comments`, { fields:"id,message,created_time", limit, access_token:token });
    }
    const comments=(data?.data||[]).map((x:any)=>({id:String(x.id),message:String(x.message||""),createdTime:x.created_time||null,likeCount:Number(x.like_count||0)})).filter((x:any)=>x.message.trim());
    return NextResponse.json({ comments, paging:{after:data?.paging?.cursors?.after||null,hasNext:Boolean(data?.paging?.next)} });
  } catch (error:any) {
    return NextResponse.json({ error:error?.message||"No fue posible consultar comentarios." }, { status:502 });
  }
}
