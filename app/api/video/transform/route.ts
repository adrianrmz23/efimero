import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { falVideoModel, falVideoPricePerSecond, submitVideo, videoStatus } from "@/lib/falClient";
import { estimateCost } from "@/lib/transformPresets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,/i;
const MAX_IMAGE = 8 * 1024 * 1024;

// Envía un video de transformación (imagen inicial → imagen final) a la cola de fal.ai.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const start = String(body.startImage || ""), end = String(body.endImage || "");
  const prompt = String(body.prompt || "").trim().slice(0, 1500);
  const duration = Math.round(Number(body.duration || 5));
  if (!IMAGE.test(start) || !IMAGE.test(end)) return NextResponse.json({ error: "Faltan la imagen de antes y la de después." }, { status: 400 });
  if (start.length > MAX_IMAGE || end.length > MAX_IMAGE) return NextResponse.json({ error: "Las imágenes son demasiado pesadas." }, { status: 400 });
  if (![5, 10].includes(duration)) return NextResponse.json({ error: "La duración debe ser de 5 o 10 segundos." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Describe la transformación." }, { status: 400 });
  try {
    const job = await submitVideo({ prompt, start_image_url: start, end_image_url: end, duration: String(duration), generate_audio: false, negative_prompt: "blur, distortion, warped walls, low quality, text, watermark" });
    return NextResponse.json({ ...job, model: falVideoModel(), estimatedCost: estimateCost(duration, falVideoPricePerSecond()) });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo enviar el video.") }, { status: Number(error?.status || 502) });
  }
}

// Consulta si el video ya está listo.
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const statusUrl = String(request.nextUrl.searchParams.get("statusUrl") || "");
  const responseUrl = String(request.nextUrl.searchParams.get("responseUrl") || "");
  try {
    return NextResponse.json(await videoStatus(statusUrl, responseUrl));
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo consultar el video.") }, { status: Number(error?.status || 502) });
  }
}
