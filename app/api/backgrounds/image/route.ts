import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["pixabay.com", "cdn.pixabay.com", "images.pexels.com"]);

// Descarga una foto de Pixabay o Pexels para que el navegador pueda dibujarla en el canvas sin problemas de CORS.
// Solo acepta imágenes de esos dominios.
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  let url: URL;
  try { url = new URL(String(request.nextUrl.searchParams.get("url") || "")); }
  catch { return NextResponse.json({ error: "URL no válida." }, { status: 400 }); }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return NextResponse.json({ error: "Solo se aceptan imágenes de Pixabay o Pexels." }, { status: 400 });
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`La imagen respondió ${response.status}.`);
    const type = response.headers.get("content-type") || "";
    if (!/^image\/(jpeg|png|webp)\b/i.test(type)) throw new Error("El archivo no es una imagen compatible.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error("La imagen es demasiado pesada.");
    return new NextResponse(buffer, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo descargar la imagen.") }, { status: 502 });
  }
}
