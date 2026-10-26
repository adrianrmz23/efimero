import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { availableProviders, generateText, type TextProvider } from "@/lib/textProviders";
import { BATCH_PRESETS, batchPrompt, parseBatch, screenRows, type BatchRow } from "@/lib/contentBatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Proveedores configurados (para que la pantalla muestre cuáles se pueden usar).
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  return NextResponse.json({ providers: availableProviders(), presets: BATCH_PRESETS.map(({ id, label, page, template, max }) => ({ id, label, page, template, max })) });
}

// Genera un lote en tandas (3 a la vez), quita repetidas y lo que no pasa Compliance.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const preset = BATCH_PRESETS.find(p => p.id === body.preset);
  if (!preset) return NextResponse.json({ error: "Elige el tipo de contenido." }, { status: 400 });
  const provider: TextProvider = body.provider === "claudeapi" ? "claudeapi" : "cheaperinference";
  const count = Math.max(5, Math.min(preset.max, Math.round(Number(body.count || 20))));
  const themes = String(body.themes || "").slice(0, 400);
  const existing: string[] = (Array.isArray(body.existing) ? body.existing : []).map((x: unknown) => String(x || "")).filter(Boolean).slice(0, 3000);
  const system = "Eres el editor de contenido de páginas de Facebook de fe y frases en español latino. Escribes contenido original, cálido y fácil de compartir, sin engagement bait. Respondes solo JSON válido.";

  const calls = Math.ceil(count / preset.perCall);
  const batches: BatchRow[][] = Array.from({ length: calls }, () => []);
  const errors: string[] = [];
  const queue = Array.from({ length: calls }, (_, i) => i);
  // Cada tanda recibe ejemplos de lo ya existente para no repetirlo.
  const avoidSample = existing.slice(-40).map(t => t.replace(/\s+/g, " ").slice(0, 90));
  await Promise.all(Array.from({ length: Math.min(3, calls) }, async () => {
    while (queue.length) {
      const i = queue.shift() as number;
      const size = Math.min(preset.perCall, count - i * preset.perCall);
      try { batches[i] = parseBatch(await generateText(provider, system, batchPrompt(preset, size, themes, avoidSample))); }
      catch (error: any) { errors.push(String(error?.message || "Falló una tanda.")); }
    }
  }));
  const generated = batches.flat();
  if (!generated.length) return NextResponse.json({ error: errors[0] || "El modelo no devolvió contenido. Intenta de nuevo." }, { status: 502 });
  const { accepted, rejected } = screenRows(preset, generated, existing, themes);
  return NextResponse.json({ rows: accepted.slice(0, count), rejected, errors, provider, template: preset.template });
}
