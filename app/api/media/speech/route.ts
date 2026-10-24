import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciSpeech } from "@/lib/cheaperInference";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const VOICES = new Set(["Kore", "Charon", "Puck", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr"]);

// Voz en off para el reel (Gemini TTS a través de Cheaper Inference).
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const voice = VOICES.has(String(body.voice)) ? String(body.voice) : "Kore";
  if (!text || text.length > 1500) return NextResponse.json({ error: "Escribe la narración (hasta 1500 caracteres)." }, { status: 400 });
  try {
    const { bytes, type } = await ciSpeech(text, voice);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo generar la voz.") }, { status: Number(error?.status || 502) });
  }
}
