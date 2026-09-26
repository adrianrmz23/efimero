import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret } from "@/lib/tokenCrypto";
import { getMetaConnection, getMetaPages, metaGraphGet } from "@/lib/metaServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const { connection, pages } = await getMetaPages(user.id);
    if (!connection) return NextResponse.json({ connected: false, pages: [] });

    let status = String(connection.status || "connected");
    const lastVerified = connection.last_verified_at ? new Date(connection.last_verified_at).getTime() : 0;
    if (Date.now() - lastVerified > 12 * 60 * 60 * 1000) {
      try {
        const token = decryptSecret(connection.encrypted_user_token);
        await metaGraphGet("me", { fields: "id", access_token: token });
        const admin = getSupabaseAdmin();
        await admin.from("efimero_meta_connections").update({ status: "connected", last_verified_at: new Date().toISOString() }).eq("id", connection.id);
        status = "connected";
      } catch {
        const admin = getSupabaseAdmin();
        await admin.from("efimero_meta_connections").update({ status: "reconnect_required", last_verified_at: new Date().toISOString() }).eq("id", connection.id);
        status = "reconnect_required";
      }
    }

    return NextResponse.json({
      connected: true,
      status,
      facebookUser: { id: connection.facebook_user_id, name: connection.facebook_user_name },
      connectedAt: connection.connected_at,
      expiresAt: connection.user_token_expires_at,
      lastVerifiedAt: connection.last_verified_at,
      activePageId: connection.active_page_id || null,
      pageCount: pages.length,
      scopes: connection.granted_scopes || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible comprobar la conexión." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const pageId = String(body.activePageId || "").trim();
    if (!pageId) return NextResponse.json({ error: "Falta activePageId." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const connection = await getMetaConnection(user.id);
    if (!connection) return NextResponse.json({ error: "Facebook no está conectado." }, { status: 404 });

    const { data: page } = await admin.from("efimero_meta_pages").select("page_id").eq("connection_id", connection.id).eq("page_id", pageId).maybeSingle();
    if (!page) return NextResponse.json({ error: "La página no pertenece a esta conexión." }, { status: 404 });
    await admin.from("efimero_meta_pages").update({ is_active: false }).eq("connection_id", connection.id);
    await admin.from("efimero_meta_pages").update({ is_active: true }).eq("connection_id", connection.id).eq("page_id", pageId);
    await admin.from("efimero_meta_connections").update({ active_page_id: pageId, updated_at: new Date().toISOString() }).eq("id", connection.id);
    return NextResponse.json({ ok: true, activePageId: pageId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible guardar la página activa." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const admin = getSupabaseAdmin();
    const connection = await getMetaConnection(user.id);
    if (connection) await admin.from("efimero_meta_connections").delete().eq("id", connection.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No fue posible desconectar Facebook." }, { status: 500 });
  }
}
