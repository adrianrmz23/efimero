import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciChat } from "@/lib/cheaperInference";
import { devotionalPrompt, parseDevotional } from "@/lib/devotional";
import { findSaint } from "@/lib/saints";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Escribe una oración o un salmo narrado con su imagen protagonista y las de apoyo.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const topic = String(body.topic || "").trim().slice(0, 400);
  const kind = body.kind === "psalm" ? "psalm" : "prayer";
  if (!topic) return NextResponse.json({ error: "Escribe el tema de la oración." }, { status: 400 });
  try {
    const known = findSaint(topic);
    const raw = await ciChat("Eres escritor de oraciones y contenido católico para shorts en español latino: reverente, cálido y fiel a la Biblia. Respondes solo JSON válido.", devotionalPrompt(topic, kind, known?.look || ""));
    return NextResponse.json({ ...parseDevotional(raw), kind });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo escribir la oración.") }, { status: Number(error?.status || 502) });
  }
}
