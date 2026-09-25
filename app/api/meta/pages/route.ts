import { NextResponse } from "next/server";
import { graphGet } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const fixedId = (process.env.META_PAGE_ID || "").trim();
  const fixedToken = (process.env.META_PAGE_ACCESS_TOKEN || "").trim();
  const userToken = (process.env.META_USER_ACCESS_TOKEN || "").trim();

  if (!fixedToken && !userToken) {
    return NextResponse.json({
      configured: false,
      pages: [],
      message: "Configura META_USER_ACCESS_TOKEN en .env.local. También se admite META_PAGE_ACCESS_TOKEN + META_PAGE_ID para una sola página.",
    });
  }

  try {
    if (fixedToken && fixedId) {
      let page: any = { id: fixedId, name: process.env.META_PAGE_NAME || "Página de Facebook" };
      try {
        page = await graphGet(fixedId, {
          fields: "id,name,category,picture{url},fan_count",
          access_token: fixedToken,
        });
      } catch {}
      return NextResponse.json({ configured: true, mode: "page_token", pages: [page] });
    }

    const accounts = await graphGet("me/accounts", {
      fields: "id,name,category,picture{url},access_token,tasks",
      limit: 100,
      access_token: userToken,
    });

    const pages = await Promise.all((accounts?.data || []).map(async (item:any) => {
      let fan_count:number|undefined;
      try {
        const info = await graphGet(String(item.id), {
          fields: "fan_count",
          access_token: item.access_token,
        });
        fan_count = typeof info?.fan_count === "number" ? info.fan_count : undefined;
      } catch {}
      return {
        id: String(item.id),
        name: item.name,
        category: item.category,
        picture: item.picture,
        tasks: item.tasks || [],
        fan_count,
      };
    }));

    return NextResponse.json({ configured: true, mode: "user_token", pages });
  } catch (error: any) {
    return NextResponse.json({ configured: true, pages: [], error: error?.message || "No fue posible consultar Meta." }, { status: 502 });
  }
}
