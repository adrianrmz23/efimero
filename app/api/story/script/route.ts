import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciChat } from "@/lib/cheaperInference";
import { ensureFictionDisclosure, parseScript, scriptPrompt } from "@/lib/storyScript";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Escribe el guion de una historia narrada, dividido en escenas.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic || "").trim().slice(0, 500);
  const scenes = Math.max(5, Math.min(12, Math.round(Number(body.scenes || 8))));
  const kind = body.kind === "fiction" ? "fiction" : "real";
  if (!topic) return NextResponse.json({ error: "Escribe el tema de la historia." }, { status: 400 });
  try {
    const system = kind === "fiction"
      ? "Eres guionista de relatos cortos de fe en español latino. Escribes ficción inspiradora claramente identificada como relato, sin presentarla como caso real. Respondes solo JSON válido."
      : "Eres guionista de shorts virales de historias reales en español latino. Respondes solo JSON válido.";
    const script = parseScript(await ciChat(system, scriptPrompt(topic, scenes, kind)));
    return NextResponse.json({ ...(kind === "fiction" ? ensureFictionDisclosure(script) : script), kind });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo escribir el guion.") }, { status: Number(error?.status || 502) });
  }
}
