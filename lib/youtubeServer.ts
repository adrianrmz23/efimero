// Conexión con YouTube (servidor): OAuth de Google y el token de actualización cifrado.
// El token se guarda como archivo privado en Supabase Storage (no hace falta una tabla nueva).
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BUCKET, ensureBucket } from "@/lib/mediaStorage";
import { decryptSecret, encryptSecret } from "@/lib/tokenCrypto";

// youtube.upload sube videos; youtube.readonly lee el canal y busca shorts para las tendencias.
export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
export type YoutubeConnection = { refreshToken: string; channelId: string; channelTitle: string; thumbnail?: string; connectedAt: string };

export function googleConfig() {
  return { clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(), clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim() };
}
export function youtubeRedirectUri(origin: string) {
  return (process.env.YOUTUBE_OAUTH_REDIRECT_URI || "").trim() || new URL("/api/auth/youtube/callback", origin).toString();
}
const pathOf = (userId: string) => `private/connections/${userId}/youtube.json`;

async function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = googleConfig();
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }), cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Google respondió: ${d.error_description || d.error || r.status}`), { status: r.status === 400 ? 401 : 502 });
  return d as { access_token: string; refresh_token?: string; expires_in: number };
}

export const exchangeYoutubeCode = (code: string, redirectUri: string) => tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });

export async function youtubeGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`YouTube respondió: ${d?.error?.message || r.status}`), { status: 502 });
  return d;
}

export async function saveYoutubeConnection(userId: string, connection: YoutubeConnection) {
  await ensureBucket();
  const body = Buffer.from(JSON.stringify({ ...connection, refreshToken: encryptSecret(connection.refreshToken) }));
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(pathOf(userId), body, { contentType: "application/json", upsert: true });
  if (error) throw error;
}

export async function loadYoutubeConnection(userId: string): Promise<YoutubeConnection | null> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(pathOf(userId));
  if (error || !data) return null;
  const saved = JSON.parse(await data.text());
  return { ...saved, refreshToken: decryptSecret(saved.refreshToken) };
}

export async function removeYoutubeConnection(userId: string) {
  const saved = await loadYoutubeConnection(userId).catch(() => null);
  if (saved) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(saved.refreshToken)}`, { method: "POST" }).catch(() => {});
  await getSupabaseAdmin().storage.from(BUCKET).remove([pathOf(userId)]);
}

// Token de acceso de corta duración (1 hora) a partir del token de actualización guardado.
export async function youtubeAccessToken(userId: string) {
  const saved = await loadYoutubeConnection(userId);
  if (!saved) throw Object.assign(new Error("Conecta tu canal de YouTube primero."), { status: 409 });
  const d = await tokenRequest({ refresh_token: saved.refreshToken, grant_type: "refresh_token" });
  return { accessToken: d.access_token, expiresIn: d.expires_in, connection: saved };
}
