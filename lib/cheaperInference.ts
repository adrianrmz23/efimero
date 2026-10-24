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

export async function ciSpeech(input: string, voice: string) {
  const response = await call("/audio/speech", { model: ciSpeechModel(), input, voice, response_format: "wav" }, 120_000);
  return { bytes: Buffer.from(await response.arrayBuffer()), type: (response.headers.get("content-type") || "audio/wav").split(";")[0] };
}
