import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciChat } from "@/lib/cheaperInference";
import { parseScript, scriptPrompt } from "@/lib/storyScript";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Escribe el guion de una historia narrada, dividido en escenas.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic || "").trim().slice(0, 500);
  const scenes = Math.max(5, Math.min(12, Math.round(Number(body.scenes || 8))));
  if (!topic) return NextResponse.json({ error: "Escribe el tema de la historia." }, { status: 400 });
  try {
    const raw = await ciChat("Eres guionista de shorts virales de historias reales en español latino. Respondes solo JSON válido.", scriptPrompt(topic, scenes));
    return NextResponse.json(parseScript(raw));
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo escribir el guion.") }, { status: Number(error?.status || 502) });
  }
}
