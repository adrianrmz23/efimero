// Cliente mínimo de fal.ai (servidor). La clave FAL_KEY nunca sale del servidor.
// Video: cola (enviar → consultar estado → leer resultado). Imagen: llamada directa.

export const falVideoModel = () => (process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v3/pro/image-to-video").trim();
export const falImageEditModel = () => (process.env.FAL_IMAGE_EDIT_MODEL || "fal-ai/flux-pro/kontext").trim();
// Precio aproximado por segundo del modelo de video (USD), solo para mostrar un estimado antes de generar.
export const falVideoPricePerSecond = () => { const v = Number(process.env.FAL_VIDEO_PRICE_PER_SECOND || .112); return Number.isFinite(v) && v > 0 ? v : .112; };

function falKey() {
  const key = (process.env.FAL_KEY || "").trim();
  if (!key) throw Object.assign(new Error("Falta FAL_KEY. Crea tu clave en fal.ai (Dashboard → Keys) y agrégala a las variables de entorno."), { status: 501 });
  return key;
}

// Solo se consultan URLs de la cola de fal: evita que el navegador nos haga pedir otras direcciones.
export function isFalQueueUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "queue.fal.run"; } catch { return false; }
}

async function falFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail.map((d: any) => d?.msg).filter(Boolean).join("; ") : data?.detail || data?.message;
    throw Object.assign(new Error(String(detail || `fal.ai respondió ${response.status}.`)), { status: response.status === 401 || response.status === 403 ? 502 : response.status });
  }
  return data;
}

export async function submitVideo(input: Record<string, unknown>) {
  const data = await falFetch(`https://queue.fal.run/${falVideoModel()}`, { method: "POST", body: JSON.stringify(input) });
  return { requestId: String(data.request_id), statusUrl: String(data.status_url), responseUrl: String(data.response_url) };
}

export async function videoStatus(statusUrl: string, responseUrl: string) {
  if (!isFalQueueUrl(statusUrl) || !isFalQueueUrl(responseUrl)) throw Object.assign(new Error("Solicitud de video no válida."), { status: 400 });
  const status = await falFetch(statusUrl);
  const state = String(status.status || "");
  if (state !== "COMPLETED") return { done: false as const, state, position: typeof status.queue_position === "number" ? status.queue_position : null };
  const result = await falFetch(responseUrl);
  const videoUrl = String(result?.video?.url || "");
  if (!videoUrl) throw new Error("fal.ai terminó pero no devolvió el video.");
  return { done: true as const, state, videoUrl };
}

export async function editImage(input: Record<string, unknown>) {
  const data = await falFetch(`https://fal.run/${falImageEditModel()}`, { method: "POST", body: JSON.stringify(input) });
  const url = String(data?.images?.[0]?.url || data?.image?.url || "");
  if (!url) throw new Error("fal.ai no devolvió la imagen.");
  return url;
}
