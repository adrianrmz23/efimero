import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret, encryptSecret } from "@/lib/tokenCrypto";

export const META_SCOPES = [
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_manage_metadata",
  "read_insights",
];

export const metaVersion = (process.env.META_GRAPH_VERSION || "v26.0").trim() || "v26.0";
export const metaGraphBase = `https://graph.facebook.com/${metaVersion}/`;

export function getMetaRedirectUri(origin?: string) {
  const configured = (process.env.META_OAUTH_REDIRECT_URI || "").trim();
  if (configured) return configured;
  if (!origin) throw new Error("Falta META_OAUTH_REDIRECT_URI.");
  return new URL("/api/auth/meta/callback", origin).toString();
}

export function buildAppSecretProof(accessToken: string) {
  const secret = (process.env.META_APP_SECRET || "").trim();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(accessToken).digest("hex");
}

export async function metaGraphGet(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.replace(/^\//, ""), metaGraphBase);
  const token = String(params.access_token || "");
  const merged = { ...params };
  if (token && !merged.appsecret_proof) (merged as any).appsecret_proof = buildAppSecretProof(token);
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const err: any = new Error(data?.error?.message || `Meta Graph API respondió ${response.status}`);
    err.code = data?.error?.code;
    err.type = data?.error?.type;
    throw err;
  }
  return data;
}

export async function exchangeCodeForLongLivedToken(code: string, redirectUri: string) {
  const appId = (process.env.META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (!appId || !appSecret) throw new Error("Faltan META_APP_ID o META_APP_SECRET.");

  const shortUrl = new URL("oauth/access_token", metaGraphBase);
  shortUrl.searchParams.set("client_id", appId);
  shortUrl.searchParams.set("client_secret", appSecret);
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortResponse = await fetch(shortUrl, { cache: "no-store" });
  const shortData = await shortResponse.json().catch(() => ({}));
  if (!shortResponse.ok || !shortData?.access_token) {
    throw new Error(shortData?.error?.message || "Meta no devolvió el token inicial.");
  }

  const longUrl = new URL("oauth/access_token", metaGraphBase);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortData.access_token);
  const longResponse = await fetch(longUrl, { cache: "no-store" });
  const longData = await longResponse.json().catch(() => ({}));
  if (!longResponse.ok || !longData?.access_token) {
    throw new Error(longData?.error?.message || "No fue posible ampliar el token de Meta.");
  }

  return {
    accessToken: String(longData.access_token),
    expiresIn: Number(longData.expires_in || 0),
  };
}

export async function getMetaConnection(ownerUserId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("efimero_meta_connections")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function getMetaPages(ownerUserId: string) {
  const admin = getSupabaseAdmin();
  const connection = await getMetaConnection(ownerUserId);
  if (!connection) return { connection: null, pages: [] as any[] };
  const { data, error } = await admin
    .from("efimero_meta_pages")
    .select("id,page_id,page_name,category,picture_url,fan_count,tasks,is_active,updated_at")
    .eq("connection_id", connection.id)
    .order("page_name", { ascending: true });
  if (error) throw error;
  return { connection, pages: data || [] };
}

export async function syncMetaPages(ownerUserId: string, encryptedUserToken?: string) {
  const admin = getSupabaseAdmin();
  const connection = await getMetaConnection(ownerUserId);
  if (!connection) throw new Error("Facebook todavía no está conectado.");
  const userToken = decryptSecret(encryptedUserToken || connection.encrypted_user_token);

  const accounts = await metaGraphGet("me/accounts", {
    fields: "id,name,category,picture{url},access_token,tasks",
    limit: 100,
    access_token: userToken,
  });

  const previousActive = connection.active_page_id ? String(connection.active_page_id) : "";
  const pageRows: any[] = [];
  for (const item of accounts?.data || []) {
    let fanCount: number | null = null;
    try {
      const info = await metaGraphGet(String(item.id), {
        fields: "fan_count",
        access_token: item.access_token,
      });
      fanCount = typeof info?.fan_count === "number" ? info.fan_count : null;
    } catch {}
    pageRows.push({
      connection_id: connection.id,
      page_id: String(item.id),
      page_name: String(item.name || "Página de Facebook"),
      category: item.category || null,
      picture_url: item.picture?.data?.url || null,
      fan_count: fanCount,
      tasks: Array.isArray(item.tasks) ? item.tasks : [],
      encrypted_page_token: encryptSecret(String(item.access_token)),
      is_active: previousActive ? String(item.id) === previousActive : false,
      updated_at: new Date().toISOString(),
    });
  }

  if (pageRows.length) {
    const { error } = await admin
      .from("efimero_meta_pages")
      .upsert(pageRows, { onConflict: "connection_id,page_id" });
    if (error) throw error;
  }

  let activePageId = previousActive;
  if (!activePageId && pageRows.length) {
    activePageId = pageRows[0].page_id;
    await admin.from("efimero_meta_pages").update({ is_active: false }).eq("connection_id", connection.id);
    await admin.from("efimero_meta_pages").update({ is_active: true }).eq("connection_id", connection.id).eq("page_id", activePageId);
    await admin.from("efimero_meta_connections").update({ active_page_id: activePageId }).eq("id", connection.id);
  }

  return { count: pageRows.length, activePageId };
}

export async function resolveStoredPageToken(ownerUserId: string, pageId: string) {
  const admin = getSupabaseAdmin();
  const connection = await getMetaConnection(ownerUserId);
  if (!connection) throw new Error("Conecta Facebook desde la sección Meta.");
  const { data, error } = await admin
    .from("efimero_meta_pages")
    .select("encrypted_page_token,page_name")
    .eq("connection_id", connection.id)
    .eq("page_id", pageId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_page_token) throw new Error("La página seleccionada necesita sincronizarse de nuevo.");
  return { token: decryptSecret(data.encrypted_page_token), pageName: data.page_name as string };
}
