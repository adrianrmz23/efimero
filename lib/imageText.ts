// Lee con IA la frase escrita dentro de las imágenes de páginas externas.
// El resultado se guarda en raw.efimero_ocr para no pagar dos veces por la misma imagen.
export type ImageOcr = { text: string; imageUrl: string; at: string; error?: string };

const BATCH = 6;
const MAX_BYTES = 5 * 1024 * 1024;

// Bright Data entrega la imagen en post_image o en attachments[].url.
export function postImageUrl(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return "";
  if (typeof raw.post_image === "string" && raw.post_image.startsWith("http")) return raw.post_image;
  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  for (const item of attachments) {
    const url = item && typeof item === "object" ? (item as any).url || (item as any).image_url : "";
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return typeof raw.post_external_image === "string" && raw.post_external_image.startsWith("http") ? raw.post_external_image : "";
}

// Texto que representa la publicación: la frase de la imagen manda; si no hay, el texto del post.
export function effectivePostText(text: string, imageText?: string | null) {
  const fromImage = String(imageText || "").trim();
  return fromImage.length >= 8 ? fromImage : String(text || "").trim();
}

// Las URLs de Facebook caducan: se descargan aquí y se envían a la IA como data URL.
async function toDataUrl(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`La imagen ya no está disponible (${response.status}).`);
  const type = response.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/")) throw new Error("El enlace no es una imagen.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("La imagen es demasiado pesada.");
  return `data:${type};base64,${buffer.toString("base64")}`;
}

async function readBatch(images: Array<{ url: string; dataUrl: string }>, apiKey: string) {
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const prompt = `Transcribe el texto principal escrito dentro de cada imagen (${images.length} en orden). Es contenido de páginas de Facebook: frases, oraciones, reflexiones o capturas de tuits.\n- Copia la frase tal como aparece, conservando los saltos de línea.\n- Ignora nombres de usuario, @arrobas, marcas de agua, logos, botones, contadores y fechas.\n- Si la imagen no tiene una frase legible, devuelve texto vacío.`;
  const content: any[] = [{ type: "input_text", text: prompt }];
  images.forEach(image => content.push({ type: "input_image", image_url: image.dataUrl, detail: "low" }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "image_text", schema: { type: "object", additionalProperties: false, properties: { items: { type: "array", items: { type: "object", additionalProperties: false, properties: { index: { type: "integer" }, text: { type: "string" } }, required: ["index", "text"] } } }, required: ["items"] } } },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  const output = data?.output_text || data?.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text || "{}";
  const parsed = JSON.parse(output);
  const byIndex = new Map<number, string>((Array.isArray(parsed.items) ? parsed.items : []).map((x: any) => [Number(x.index), String(x.text || "").trim()]));
  return images.map((_, i) => byIndex.get(i + 1) ?? byIndex.get(i) ?? "");
}

// Devuelve un resultado por URL, en el mismo orden. Sin OPENAI_API_KEY no hace nada.
export async function readImageTexts(urls: string[]): Promise<Array<ImageOcr | null>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return urls.map(() => null);
  const at = () => new Date().toISOString();
  const results: Array<ImageOcr | null> = urls.map(() => null);
  for (let offset = 0; offset < urls.length; offset += BATCH) {
    const slice = urls.slice(offset, offset + BATCH).map((url, k) => ({ url, index: offset + k }));
    const ready: Array<{ url: string; dataUrl: string; index: number }> = [];
    await Promise.all(slice.map(async item => {
      try { ready.push({ ...item, dataUrl: await toDataUrl(item.url) }); }
      catch (error: any) { results[item.index] = { text: "", imageUrl: item.url, at: at(), error: String(error?.message || "No se pudo descargar.") }; }
    }));
    ready.sort((a, b) => a.index - b.index);
    if (!ready.length) continue;
    try {
      const texts = await readBatch(ready, apiKey);
      ready.forEach((item, k) => { results[item.index] = { text: texts[k] || "", imageUrl: item.url, at: at() }; });
    } catch (error) {
      // Un fallo de la IA no se guarda: se reintentará en la siguiente sincronización.
      console.error("No se pudo leer el texto de las imágenes:", error);
    }
  }
  return results;
}

// Lee las imágenes de posts ya guardados que aún no tienen frase leída.
export async function backfillImageTexts(db: any, ownerUserId: string, watchlistIds: string[], limit: number) {
  if (!process.env.OPENAI_API_KEY || !watchlistIds.length) return 0;
  const { data, error } = await db
    .from("efimero_inspiration_posts")
    .select("id,raw")
    .eq("owner_user_id", ownerUserId)
    .in("watchlist_id", watchlistIds)
    .is("raw->efimero_ocr", null)
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (error) return 0;
  type Row = { id: string; raw: Record<string, unknown>; url: string };
  const rows: Row[] = (data || []).map((row: any) => ({ id: String(row.id), raw: row.raw || {}, url: postImageUrl(row.raw || {}) }));
  // Los posts sin imagen se marcan para no volver a revisarlos en cada entrenamiento.
  await Promise.all(rows.filter(row => !row.url).map(row =>
    db.from("efimero_inspiration_posts").update({ raw: { ...row.raw, efimero_ocr: { text: "", imageUrl: "", at: new Date().toISOString() } } }).eq("id", row.id).eq("owner_user_id", ownerUserId),
  ));
  const pending = rows.filter(row => row.url);
  if (!pending.length) return 0;
  const results = await readImageTexts(pending.map(row => row.url));
  let read = 0;
  for (let i = 0; i < pending.length; i++) {
    const ocr = results[i];
    if (!ocr) continue;
    const { error: updateError } = await db.from("efimero_inspiration_posts").update({ raw: { ...pending[i].raw, efimero_ocr: ocr } }).eq("id", pending[i].id).eq("owner_user_id", ownerUserId);
    if (!updateError && ocr.text) read++;
  }
  return read;
}
