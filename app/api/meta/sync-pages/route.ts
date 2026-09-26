import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { syncMetaPages } from "@/lib/metaServer";

export async function POST() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const result = await syncMetaPages(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible sincronizar las páginas." }, { status: 502 });
  }
}
