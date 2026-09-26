import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { META_SCOPES, getMetaRedirectUri, metaVersion } from "@/lib/metaServer";

export async function GET(request: NextRequest) {
  const appId = (process.env.META_APP_ID || "").trim();
  if (!appId) return NextResponse.json({ error: "Falta META_APP_ID." }, { status: 500 });

  const state = crypto.randomBytes(24).toString("base64url");
  const redirectUri = getMetaRedirectUri(request.nextUrl.origin);
  const url = new URL(`https://www.facebook.com/${metaVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));

  const response = NextResponse.redirect(url);
  response.cookies.set("efimero_meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
