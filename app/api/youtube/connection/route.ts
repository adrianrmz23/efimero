import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { googleConfig, loadYoutubeConnection, removeYoutubeConnection } from "@/lib/youtubeServer";

export const dynamic = "force-dynamic";

// Estado de la conexión con YouTube (sin exponer el token).
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const { clientId, clientSecret } = googleConfig();
  const configured = Boolean(clientId && clientSecret);
  const saved = configured ? await loadYoutubeConnection(user.id).catch(() => null) : null;
  return NextResponse.json({ configured, connected: Boolean(saved), channelTitle: saved?.channelTitle, channelId: saved?.channelId, thumbnail: saved?.thumbnail });
}

export async function DELETE() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  await removeYoutubeConnection(user.id);
  return NextResponse.json({ ok: true });
}
