import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { ciTranscribe } from "@/lib/cheaperInference";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Transcribe la voz en off y devuelve cada palabra con su tiempo, para sincronizar subtítulos y escenas.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  if (file.size > 4_400_000) return NextResponse.json({ error: "El audio es demasiado largo para transcribirlo." }, { status: 400 });
  try {
    return NextResponse.json(await ciTranscribe(file));
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo transcribir la voz.") }, { status: Number(error?.status || 502) });
  }
}
