import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { editImage } from "@/lib/falClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,/i;

// Crea la imagen de "antes" a partir del diseño terminado, con el mismo ángulo de cámara.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const image = String(body.image || "");
  const prompt = String(body.prompt || "").trim().slice(0, 1500);
  if (!IMAGE.test(image) || image.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Sube la imagen del diseño terminado (JPG, PNG o WebP)." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Falta describir cómo se ve antes." }, { status: 400 });
  try {
    const url = await editImage({ prompt, image_url: image, output_format: "jpeg" });
    // Se devuelve como data URL para dibujarla y enviarla al video sin depender de enlaces temporales.
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("No se pudo descargar la imagen generada.");
    const type = response.headers.get("content-type") || "image/jpeg";
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return NextResponse.json({ image: `data:${type.split(";")[0]};base64,${data}` });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo crear la imagen de antes.") }, { status: Number(error?.status || 502) });
  }
}
