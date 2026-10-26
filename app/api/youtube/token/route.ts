import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { youtubeAccessToken } from "@/lib/youtubeServer";

export const dynamic = "force-dynamic";

// El video pesa más de lo que Vercel deja pasar (4.5 MB), así que el navegador lo sube directo a YouTube
// con un token de acceso que dura una hora y solo sirve para el canal conectado de este usuario.
export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  try {
    const { accessToken, expiresIn } = await youtubeAccessToken(user.id);
    return NextResponse.json({ accessToken, expiresIn }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo conectar con YouTube.") }, { status: Number(error?.status || 502) });
  }
}
