import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { availableProviders, generateText, type TextProvider } from "@/lib/textProviders";
import { parseYoutubeMeta, youtubeMetaPrompt } from "@/lib/youtubeMeta";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Escribe título, descripción y etiquetas para YouTube. Por defecto usa la API de Claude (claudeapikey) si está configurada.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Falta el texto del video." }, { status: 400 });
  const ready = availableProviders().filter(p => p.ready);
  const provider: TextProvider | undefined = ready.find(p => p.id === body.provider)?.id || ready.find(p => p.id === "claudeapi")?.id || ready[0]?.id;
  if (!provider) return NextResponse.json({ error: "No hay proveedor de texto configurado." }, { status: 501 });
  try {
    const raw = await generateText(provider, "Eres experto en YouTube Shorts católicos en español latino: títulos que la gente busca, descripciones cálidas y respetuosas. Respondes solo JSON válido.", youtubeMetaPrompt({ kind: String(body.kind || "oración"), topic: String(body.topic || ""), title: String(body.title || ""), text }), 4000);
    return NextResponse.json({ ...parseYoutubeMeta(raw), provider, model: ready.find(p => p.id === provider)?.model });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo escribir la publicación.") }, { status: Number(error?.status || 502) });
  }
}
