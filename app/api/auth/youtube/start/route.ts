import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { YOUTUBE_SCOPES, googleConfig, youtubeRedirectUri } from "@/lib/youtubeServer";

export async function GET(request: NextRequest) {
  const { clientId } = googleConfig();
  if (!clientId) return NextResponse.json({ error: "Falta GOOGLE_CLIENT_ID." }, { status: 500 });
  const state = crypto.randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", youtubeRedirectUri(request.nextUrl.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // offline + consent: Google entrega el token de actualización para subir sin volver a iniciar sesión.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  const response = NextResponse.redirect(url);
  response.cookies.set("efimero_youtube_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 });
  return response;
}
