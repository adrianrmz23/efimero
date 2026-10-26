import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciImage, ciImageWithReference } from "@/lib/cheaperInference";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Genera una imagen vertical para un reel con Cheaper Inference.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim().slice(0, 3000);
  if (!prompt) return NextResponse.json({ error: "Describe la imagen." }, { status: 400 });
  try {
    // Con imagen de referencia (personaje de una historia) se intenta mantener el mismo personaje.
    const reference = String(body.reference || "");
    if (/^data:image\/(jpeg|png|webp);base64,/i.test(reference) && reference.length < 1_500_000) return NextResponse.json(await ciImageWithReference(prompt, reference));
    return NextResponse.json({ image: await ciImage(prompt) });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo generar la imagen.") }, { status: Number(error?.status || 502) });
  }
}
