// Cliente de Cheaper Inference para imágenes, video y voz (servidor). La clave nunca llega al navegador.
// Acepta los nombres de variables que ya usa el proyecto (CHEAPER*, CHEAPEST* y CHEAP*).

export const ciImageModel = () => (process.env.CI_IMAGE_MODEL || "flux-2-pro").trim();
export const ciVideoModel = () => (process.env.CI_VIDEO_MODEL || "kling-v2.5-turbo").trim();
export const ciSpeechModel = () => (process.env.CI_SPEECH_MODEL || "gemini-3.8-flash-tts").trim();
// Precio aproximado del clip de video por segundo (USD), solo para mostrar el estimado.
export const ciVideoPricePerSecond = () => { const v = Number(process.env.CI_VIDEO_PRICE_PER_SECOND || .042); return Number.isFinite(v) && v > 0 ? v : .042; };

function config() {
  const key = (process.env.CHEAPERINFERENCE_API_KEY || process.env.CHEAPESTINFERENCE_API_KEY || process.env.CHEAPINFERENCE_API_KEY || "").trim();
  if (!key) throw Object.assign(new Error("Falta CHEAPERINFERENCE_API_KEY en las variables de entorno."), { status: 501 });
  const configured = process.env.CHEAPERINFERENCE_BASE_URL || process.env.CHEAPESTINFERENCE_BASE_URL || process.env.CHEAPINFERENCE_BASE_URL || "https://api.cheaperinference.com/v1";
  // Versiones anteriores documentaron por error "cheapestinference".
  return { key, base: configured.replace("api.cheapestinference.com", "api.cheaperinference.com").replace(/\/$/, "") };
}

async function call(path: string, body: Record<string, unknown>, timeoutMs: number) {
  const { key, base } = config();
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(String(data?.error?.message || `Cheaper Inference respondió ${response.status}.`)), { status: response.status === 402 ? 402 : 502 });
  }
  return response;
}

export async function ciImage(prompt: string, size = "1088x1920") {
  const data = await (await call("/images/generations", { model: ciImageModel(), prompt, size, n: 1 }, 180_000)).json();
  const item = data?.data?.[0] || {};
  if (item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  if (item.url) {
    const image = await fetch(item.url, { cache: "no-store" });
    const type = (image.headers.get("content-type") || "image/jpeg").split(";")[0];
    return `data:${type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  }
  throw new Error("Cheaper Inference no devolvió la imagen.");
}

// La API espera hasta que el video termina (1 a 4 minutos). Devuelve los bytes del MP4.
export async function ciVideo(prompt: string, imageDataUrl: string, duration: number) {
  const response = await call("/videos/generations", { model: ciVideoModel(), prompt, image_url: imageDataUrl, duration, aspect_ratio: "9:16", audio: false }, 290_000);
  const data = await response.json();
  const video = data?.videos?.[0] || {};
  if (video.b64_video) return { bytes: Buffer.from(video.b64_video, "base64"), cost: Number(data?.billing?.billed_cost_usd || 0) };
  if (video.url) {
    const file = await fetch(video.url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (!file.ok) throw new Error("No se pudo descargar el video generado.");
    return { bytes: Buffer.from(await file.arrayBuffer()), cost: Number(data?.billing?.billed_cost_usd || 0) };
  }
  throw new Error("Cheaper Inference no devolvió el video.");
}

export const ciTextModel = () => (process.env.CI_TEXT_MODEL || process.env.CHEAPERINFERENCE_MODEL || process.env.CHEAPESTINFERENCE_MODEL || process.env.CHEAPINFERENCE_MODEL || "gpt-5.6-terra").trim();
export const ciImageRefModel = () => (process.env.CI_IMAGE_REF_MODEL || "nano-banana-2").trim();
export const ciTranscribeModel = () => (process.env.CI_TRANSCRIBE_MODEL || "whisper-1").trim();

export async function ciChat(system: string, user: string) {
  const data = await (await call("/chat/completions", { model: ciTextModel(), messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, temperature: .7 }, 110_000)).json();
  const text = String(data?.choices?.[0]?.message?.content || "");
  if (!text) throw new Error("El modelo no devolvió texto.");
  return text;
}

// Imagen manteniendo el personaje de una imagen de referencia. Si el modelo de edición no está disponible,
// vuelve a generar solo con texto (la descripción del personaje en el prompt mantiene buena parte del parecido).
export async function ciImageWithReference(prompt: string, reference: string) {
  try {
    const data = await (await call("/images/edits", { model: ciImageRefModel(), prompt, input_references: [reference], n: 1, size: "1024x1536" }, 180_000)).json();
    const item = data?.data?.[0] || {};
    if (item.b64_json) return { image: `data:image/jpeg;base64,${item.b64_json}`, usedReference: true };
    if (item.url) { const file = await fetch(item.url, { cache: "no-store" }); return { image: `data:${(file.headers.get("content-type") || "image/jpeg").split(";")[0]};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`, usedReference: true }; }
    throw new Error("Sin imagen");
  } catch {
    return { image: await ciImage(prompt), usedReference: false };
  }
}

// Devuelve cada palabra con su tiempo. Whisper entrega segmentos de una palabra; si un segmento trae varias,
// se reparte su tiempo entre ellas según su largo.
export async function ciTranscribe(file: Blob) {
  const { key, base } = config();
  const form = new FormData();
  form.set("model", ciTranscribeModel()); form.set("language", "es"); form.set("response_format", "verbose_json"); form.append("timestamp_granularities[]", "word");
  form.set("file", file, "voz.wav");
  const response = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, cache: "no-store", signal: AbortSignal.timeout(110_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(String(data?.error?.message || `Cheaper Inference respondió ${response.status}.`)), { status: 502 });
  type Piece = { text: string; start: number; end: number };
  const words: Piece[] = [];
  const source: any[] = Array.isArray(data.words) && data.words.length ? data.words.map((w: any) => ({ text: w.word ?? w.text, start: w.start, end: w.end })) : (Array.isArray(data.segments) ? data.segments : []);
  for (const piece of source) {
    const parts = String(piece.text || "").trim().split(/\s+/).filter(Boolean);
    const start = Number(piece.start || 0), end = Math.max(start, Number(piece.end || start));
    const total = parts.reduce((n, p) => n + p.length, 0) || 1;
    let cursor = start;
    for (const part of parts) { const span = (end - start) * part.length / total; words.push({ text: part, start: cursor, end: cursor + span }); cursor += span; }
  }
  return { words, duration: Number(data.duration || words[words.length - 1]?.end || 0), text: String(data.text || "") };
}

export async function ciSpeech(input: string, voice: string) {
  const response = await call("/audio/speech", { model: ciSpeechModel(), input, voice, response_format: "wav" }, 120_000);
  return { bytes: Buffer.from(await response.arrayBuffer()), type: (response.headers.get("content-type") || "audio/wav").split(";")[0] };
}
