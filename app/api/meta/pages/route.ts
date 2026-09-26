import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getMetaPages } from "@/lib/metaServer";
import { graphGet } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getServerUser();
    if (user) {
      const { connection, pages } = await getMetaPages(user.id);
      if (connection) {
        return NextResponse.json({
          configured: true,
          connected: true,
          mode: "oauth",
          activePageId: connection.active_page_id || null,
          connectionStatus: connection.status || "connected",
          pages: pages.map((p:any) => ({
            id: p.page_id,
            name: p.page_name,
            category: p.category || undefined,
            picture: p.picture_url ? { data: { url: p.picture_url } } : undefined,
            tasks: p.tasks || [],
            fan_count: typeof p.fan_count === "number" ? p.fan_count : undefined,
          })),
        });
      }
    }

    // Compatibilidad temporal con el token manual anterior.
    const fixedId = (process.env.META_PAGE_ID || "").trim();
    const fixedToken = (process.env.META_PAGE_ACCESS_TOKEN || "").trim();
    const userToken = (process.env.META_USER_ACCESS_TOKEN || "").trim();
    if (!fixedToken && !userToken) {
      return NextResponse.json({ configured: false, connected: false, pages: [], message: "Conecta Facebook desde esta plataforma." });
    }
    if (fixedToken && fixedId) {
      let page: any = { id: fixedId, name: process.env.META_PAGE_NAME || "Página de Facebook" };
      try { page = await graphGet(fixedId, { fields: "id,name,category,picture{url},fan_count", access_token: fixedToken }); } catch {}
      return NextResponse.json({ configured: true, connected: false, mode: "legacy_page_token", pages: [page], activePageId: fixedId });
    }

    const accounts = await graphGet("me/accounts", { fields: "id,name,category,picture{url},access_token,tasks", limit: 100, access_token: userToken });
    const pages = await Promise.all((accounts?.data || []).map(async (item:any) => {
      let fan_count:number|undefined;
      try { const info = await graphGet(String(item.id), { fields: "fan_count", access_token: item.access_token }); fan_count = typeof info?.fan_count === "number" ? info.fan_count : undefined; } catch {}
      return { id:String(item.id), name:item.name, category:item.category, picture:item.picture, tasks:item.tasks||[], fan_count };
    }));
    return NextResponse.json({ configured: true, connected: false, mode: "legacy_user_token", pages, activePageId: pages[0]?.id || null });
  } catch (error: any) {
    return NextResponse.json({ configured: true, pages: [], error: error?.message || "No fue posible consultar Meta." }, { status: 502 });
  }
}
