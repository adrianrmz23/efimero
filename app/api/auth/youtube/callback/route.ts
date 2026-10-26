import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { exchangeYoutubeCode, saveYoutubeConnection, youtubeGet, youtubeRedirectUri } from "@/lib/youtubeServer";

function back(request: NextRequest, status: string, detail?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("section", "reelStudio");
  url.searchParams.set("youtube", status);
  if (detail) url.searchParams.set("detail", detail.slice(0, 180));
  return url;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  const saved = request.cookies.get("efimero_youtube_oauth_state")?.value || "";
  const clear = (response: NextResponse) => { response.cookies.set("efimero_youtube_oauth_state", "", { path: "/", maxAge: 0 }); return response; };
  if (request.nextUrl.searchParams.get("error")) return clear(NextResponse.redirect(back(request, "cancelled")));
  if (!state || state !== saved || !code) return clear(NextResponse.redirect(back(request, "error", "La validación OAuth no coincidió.")));
  try {
    const user = await getServerUser();
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const tokens = await exchangeYoutubeCode(code, youtubeRedirectUri(request.nextUrl.origin));
    if (!tokens.refresh_token) throw new Error("Google no entregó permiso permanente. Quita el acceso de la app en tu cuenta de Google e intenta de nuevo.");
    const channels = await youtubeGet("channels", tokens.access_token, { part: "snippet", mine: "true" });
    const channel = channels?.items?.[0];
    if (!channel) throw new Error("Esa cuenta de Google no tiene canal de YouTube.");
    await saveYoutubeConnection(user.id, { refreshToken: tokens.refresh_token, channelId: channel.id, channelTitle: channel.snippet?.title || "YouTube", thumbnail: channel.snippet?.thumbnails?.default?.url, connectedAt: new Date().toISOString() });
    return clear(NextResponse.redirect(back(request, "connected")));
  } catch (error: any) {
    return clear(NextResponse.redirect(back(request, "error", error?.message || "No fue posible conectar YouTube.")));
  }
}
