import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciChat } from "@/lib/cheaperInference";
import { STORY_KINDS, ensureFictionDisclosure, parseScript, scriptPrompt, type StoryKind } from "@/lib/storyScript";
import { findSaint } from "@/lib/saints";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Escribe el guion de una historia narrada, dividido en escenas.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic || "").trim().slice(0, 500);
  const scenes = Math.max(5, Math.min(12, Math.round(Number(body.scenes || 8))));
  const kind: StoryKind = STORY_KINDS.some(k => k.id === body.kind) ? body.kind : "real";
  if (!topic) return NextResponse.json({ error: "Escribe el tema de la historia." }, { status: 400 });
  try {
    const system = kind === "fiction"
      ? "Eres guionista de relatos cortos de fe en español latino. Escribes ficción inspiradora claramente identificada como relato, sin presentarla como caso real. Respondes solo JSON válido."
      : kind === "real" ? "Eres guionista de shorts virales de historias reales en español latino. Respondes solo JSON válido."
      : "Eres guionista de contenido católico y cristiano para shorts en español latino: reverente, fiel a la Biblia y emotivo. Respondes solo JSON válido.";
    // Si el tema menciona un santo conocido, se fija su iconografía para que salga reconocible.
    const known = findSaint(topic);
    const isSaintStory = Boolean(known) || /\b(san|santa|santo|virgen|beato|beata)\s/i.test(topic);
    const parsed = parseScript(await ciChat(system, scriptPrompt(topic, scenes, kind, known?.look || "", isSaintStory)));
    const script = known ? { ...parsed, saint: known.look } : parsed;
    // Si el modelo no marcó ninguna escena con el santo, se marcan la del medio y la última.
    if (isSaintStory && script.saint && !script.scenes.some(s => s.showsSaint)) {
      const mid = Math.floor(script.scenes.length / 2);
      script.scenes = script.scenes.map((s, i) => i === mid || i === script.scenes.length - 1 ? { ...s, showsSaint: true } : s);
    }
    return NextResponse.json({ ...(kind === "fiction" ? ensureFictionDisclosure(script) : script), kind });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo escribir el guion.") }, { status: Number(error?.status || 502) });
  }
}
