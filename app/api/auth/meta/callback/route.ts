import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptSecret } from "@/lib/tokenCrypto";
import { exchangeCodeForLongLivedToken, getMetaRedirectUri, metaGraphGet, syncMetaPages } from "@/lib/metaServer";

function metaRedirect(request: NextRequest, status: string, detail?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("section", "meta");
  url.searchParams.set("meta", status);
  if (detail) url.searchParams.set("detail", detail.slice(0, 180));
  return url;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  const denied = request.nextUrl.searchParams.get("error") || "";
  const savedState = request.cookies.get("efimero_meta_oauth_state")?.value || "";

  if (denied) return NextResponse.redirect(metaRedirect(request, "cancelled"));
  if (!state || !savedState || state !== savedState || !code) {
    return NextResponse.redirect(metaRedirect(request, "error", "La validación OAuth no coincidió."));
  }

  try {
    const user = await getServerUser();
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    const redirectUri = getMetaRedirectUri(request.nextUrl.origin);
    const longLived = await exchangeCodeForLongLivedToken(code, redirectUri);
    const facebookUser = await metaGraphGet("me", {
      fields: "id,name",
      access_token: longLived.accessToken,
    });
    const permissions = await metaGraphGet("me/permissions", {
      access_token: longLived.accessToken,
    }).catch(() => ({ data: [] }));
    const grantedScopes = (permissions?.data || []).filter((x: any) => x.status === "granted").map((x: any) => x.permission);
    const expiresAt = longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString() : null;

    const admin = getSupabaseAdmin();
    const { data: connection, error } = await admin
      .from("efimero_meta_connections")
      .upsert({
        owner_user_id: user.id,
        owner_email: user.email,
        facebook_user_id: String(facebookUser.id),
        facebook_user_name: String(facebookUser.name || "Facebook"),
        encrypted_user_token: encryptSecret(longLived.accessToken),
        user_token_expires_at: expiresAt,
        granted_scopes: grantedScopes,
        status: "connected",
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_user_id" })
      .select("id,active_page_id")
      .single();
    if (error) throw error;

    await syncMetaPages(user.id);

    const response = NextResponse.redirect(metaRedirect(request, "connected"));
    response.cookies.set("efimero_meta_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error: any) {
    const response = NextResponse.redirect(metaRedirect(request, "error", error?.message || "No fue posible conectar Facebook."));
    response.cookies.set("efimero_meta_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  }
}
