import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciVideo } from "@/lib/cheaperInference";
import { storeMedia } from "@/lib/mediaStorage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,/i;

// Anima una imagen (recorrido con cámara en movimiento). Tarda de 1 a 4 minutos.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const image = String(body.image || "");
  const prompt = String(body.prompt || "").trim().slice(0, 1500);
  const duration = Math.round(Number(body.duration || 5));
  if (!IMAGE.test(image)) return NextResponse.json({ error: "Falta la imagen de la escena." }, { status: 400 });
  // La API rechaza peticiones de más de 300 KB: el navegador reduce la imagen antes de enviarla.
  if (image.length > 290_000) return NextResponse.json({ error: "La imagen de la escena es demasiado pesada." }, { status: 400 });
  if (![5, 10].includes(duration)) return NextResponse.json({ error: "La duración debe ser de 5 o 10 segundos." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Describe el movimiento de la cámara." }, { status: 400 });
  try {
    const { bytes, cost } = await ciVideo(prompt, image, duration);
    const url = await storeMedia(user.id, bytes, "mp4", "video/mp4");
    return NextResponse.json({ url, cost });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo generar el clip.") }, { status: Number(error?.status || 502) });
  }
}
