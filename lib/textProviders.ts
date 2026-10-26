// Proveedores de texto para generar contenido (servidor). El usuario elige cuál usar en cada lote.
// - "cheaperinference": la cuenta de Cheaper Inference (por defecto con un modelo de Claude).
// - "claudeapi": un proveedor externo compatible con la API de Claude (por ejemplo, un revendedor con saldo propio).
//   Se configura con CLAUDE_API_BASE_URL, CLAUDE_API_KEY y CLAUDE_API_MODEL; CLAUDE_API_FORMAT elige el formato
//   ("anthropic" = /v1/messages, "openai" = /v1/chat/completions).
import { ciTextModel } from "@/lib/cheaperInference";
import { looksCorrupted } from "@/lib/textQuality";

export type TextProvider = "cheaperinference" | "claudeapi";

const ciKey = () => (process.env.CHEAPERINFERENCE_API_KEY || process.env.CHEAPESTINFERENCE_API_KEY || process.env.CHEAPINFERENCE_API_KEY || "").trim();
const ciBase = () => (process.env.CHEAPERINFERENCE_BASE_URL || process.env.CHEAPESTINFERENCE_BASE_URL || process.env.CHEAPINFERENCE_BASE_URL || "https://api.cheaperinference.com/v1").replace("api.cheapestinference.com", "api.cheaperinference.com").replace(/\/$/, "");
// Para lotes se prefiere Claude en Cheaper Inference (más cálido en español); se puede cambiar con CI_BATCH_MODEL.
const ciBatchModel = () => (process.env.CI_BATCH_MODEL || process.env.CI_TEXT_MODEL || "claude-sonnet-5.5").trim() || ciTextModel();

const claudeConfig = () => ({
  key: (process.env.CLAUDE_API_KEY || "").trim(),
  base: (process.env.CLAUDE_API_BASE_URL || "").trim().replace(/\/$/, "").replace(/\/v1$/, ""),
  model: (process.env.CLAUDE_API_MODEL || "claude-sonnet-4-5").trim(),
  format: (process.env.CLAUDE_API_FORMAT || "anthropic").trim().toLowerCase() === "openai" ? "openai" : "anthropic",
});

export function availableProviders() {
  const claude = claudeConfig();
  return [
    { id: "cheaperinference" as const, label: "Cheaper Inference", model: ciBatchModel(), ready: Boolean(ciKey()) },
    { id: "claudeapi" as const, label: "Claude API (claudeapikey)", model: claude.model, ready: Boolean(claude.key && claude.base) },
  ];
}

async function readError(response: Response, name: string) {
  const data = await response.json().catch(() => ({}));
  const message = data?.error?.message || data?.message || (typeof data?.error === "string" ? data.error : "");
  return Object.assign(new Error(`${name} respondió ${response.status}${message ? `: ${String(message).slice(0, 240)}` : "."}`), { status: 502 });
}

// El límite es alto porque algunos modelos gastan buena parte en razonar antes de responder.
export async function generateText(provider: TextProvider, system: string, user: string, maxTokens = 16000) {
  if (provider === "claudeapi") {
    const c = claudeConfig();
    if (!c.key || !c.base) throw Object.assign(new Error("Falta configurar CLAUDE_API_BASE_URL y CLAUDE_API_KEY para usar Claude API."), { status: 501 });
    if (c.format === "openai") {
      const r = await fetch(`${c.base}/v1/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: c.model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }), cache: "no-store", signal: AbortSignal.timeout(170_000) });
      if (!r.ok) throw await readError(r, "Claude API");
      const d = await r.json(); return String(d?.choices?.[0]?.message?.content || "");
    }
    const r = await fetch(`${c.base}/v1/messages`, { method: "POST", headers: { "x-api-key": c.key, Authorization: `Bearer ${c.key}`, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }), cache: "no-store", signal: AbortSignal.timeout(170_000) });
    if (!r.ok) throw await readError(r, "Claude API");
    const d = await r.json();
    return (Array.isArray(d?.content) ? d.content : []).filter((b: any) => b?.type === "text").map((b: any) => String(b.text || "")).join("");
  }
  const key = ciKey();
  if (!key) throw Object.assign(new Error("Falta CHEAPERINFERENCE_API_KEY en las variables de entorno."), { status: 501 });
  const r = await fetch(`${ciBase()}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: ciBatchModel(), max_tokens: maxTokens, temperature: .8, reasoning_effort: "low", messages: [{ role: "system", content: system }, { role: "user", content: user }] }), cache: "no-store", signal: AbortSignal.timeout(170_000) });
  if (!r.ok) throw await readError(r, "Cheaper Inference");
  const d = await r.json(); return String(d?.choices?.[0]?.message?.content || "");
}

// Pide JSON y lo valida. Si el proveedor elegido responde con texto dañado o fuera de formato, reintenta una vez
// y luego usa el otro proveedor configurado. Devuelve cuál respondió para mostrarlo.
export async function generateChecked<T>(preferred: TextProvider, system: string, user: string, parse: (raw: string) => T, maxTokens = 4000) {
  const ready = availableProviders().filter(p => p.ready);
  const first = ready.find(p => p.id === preferred) || ready[0];
  if (!first) throw Object.assign(new Error("No hay proveedor de texto configurado."), { status: 501 });
  const other = ready.find(p => p.id !== first.id);
  const attempts = [first, first, ...(other ? [other] : [])];
  const startedAt = Date.now(); let lastError: unknown = null;
  for (const [i, provider] of attempts.entries()) {
    // El reintento con el mismo proveedor solo si queda tiempo (las funciones de Vercel tienen límite).
    if (i === 1 && Date.now() - startedAt > 70_000) continue;
    try {
      const raw = await generateText(provider.id, system, user, maxTokens);
      if (looksCorrupted(raw)) throw new Error(`${provider.label} devolvió texto dañado.`);
      return { value: parse(raw), provider: provider.id, model: provider.model, fallback: provider.id !== first.id ? `${first.label} falló (${String((lastError as Error)?.message || "error").slice(0, 120)}); se usó ${provider.label}.` : "" };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
