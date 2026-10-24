import { decryptSecret } from "@/lib/tokenCrypto";
import { buildAppSecretProof, getMetaConnection, metaGraphBase, metaGraphGet } from "@/lib/metaServer";
import { ADS_SCOPES, toMinorUnits, type LikesCampaignInput } from "@/lib/metaAds";

// Token de usuario guardado al conectar Facebook. Los anuncios necesitan ads_management y ads_read.
export async function resolveAdsToken(ownerUserId: string) {
  const connection = await getMetaConnection(ownerUserId);
  if (!connection) throw Object.assign(new Error("Conecta Facebook desde la sección Meta."), { status: 404 });
  const scopes: string[] = Array.isArray(connection.granted_scopes) ? connection.granted_scopes : [];
  const hasScope = ADS_SCOPES.every(scope => scopes.includes(scope));
  return { token: decryptSecret(connection.encrypted_user_token), hasScope };
}

async function metaGraphPost(path: string, params: Record<string, string | number | boolean | object>, accessToken: string) {
  const url = new URL(path.replace(/^\//, ""), metaGraphBase);
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value)));
  body.set("access_token", accessToken);
  const proof = buildAppSecretProof(accessToken);
  if (proof) body.set("appsecret_proof", proof);
  const response = await fetch(url, { method: "POST", body, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.error_user_msg || data?.error?.message || `Meta respondió ${response.status}`;
    throw Object.assign(new Error(message), { code: data?.error?.code });
  }
  return data;
}

export async function listAdAccounts(token: string) {
  const data = await metaGraphGet("me/adaccounts", { fields: "id,name,account_status,currency,timezone_name,amount_spent", limit: 50, access_token: token });
  return (data?.data || []).map((account: any) => ({
    id: String(account.id),
    name: String(account.name || account.id),
    currency: String(account.currency || "USD"),
    timezone: String(account.timezone_name || ""),
    // 1 = activa; cualquier otro estado (deshabilitada, pago pendiente…) no permite anunciar.
    active: Number(account.account_status) === 1,
  }));
}

export async function getAdAccount(token: string, accountId: string) {
  const account = await metaGraphGet(accountId, { fields: "id,name,currency,account_status", access_token: token });
  return { id: String(account.id), currency: String(account.currency || "USD"), active: Number(account.account_status) === 1 };
}

// Crea campaña + conjunto + anuncio, todo en PAUSA. Si un paso falla, lo ya creado queda en pausa y no gasta.
export async function createPausedLikesCampaign(token: string, input: LikesCampaignInput, currency: string) {
  const created: { campaignId?: string; adSetId?: string; creativeId?: string; adId?: string } = {};
  const start = new Date(Date.now() + 10 * 60_000);
  const end = new Date(start.getTime() + input.days * 86_400_000);
  try {
    const campaign = await metaGraphPost(`${input.accountId}/campaigns`, {
      name: input.name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    }, token);
    created.campaignId = String(campaign.id);

    const adSet = await metaGraphPost(`${input.accountId}/adsets`, {
      name: `${input.name} · conjunto`,
      campaign_id: created.campaignId,
      status: "PAUSED",
      daily_budget: toMinorUnits(input.dailyBudget, currency),
      billing_event: "IMPRESSIONS",
      optimization_goal: "PAGE_LIKES",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      destination_type: "ON_PAGE",
      promoted_object: { page_id: input.pageId },
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      targeting: {
        geo_locations: { countries: input.countries },
        age_min: input.ageMin,
        age_max: input.ageMax,
        targeting_automation: { advantage_audience: 0 },
      },
    }, token);
    created.adSetId = String(adSet.id);

    const creative = await metaGraphPost(`${input.accountId}/adcreatives`, {
      name: `${input.name} · anuncio`,
      object_story_id: input.postId,
    }, token);
    created.creativeId = String(creative.id);

    const ad = await metaGraphPost(`${input.accountId}/ads`, {
      name: `${input.name} · anuncio`,
      adset_id: created.adSetId,
      creative: { creative_id: created.creativeId },
      status: "PAUSED",
    }, token);
    created.adId = String(ad.id);
    return created;
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || "Meta no aceptó la campaña."), { partial: created });
  }
}

export async function listCampaignResults(token: string, accountId: string, datePreset: string) {
  const [campaigns, insights] = await Promise.all([
    metaGraphGet(`${accountId}/campaigns`, { fields: "id,name,status,effective_status,objective,created_time,start_time,stop_time", limit: 50, access_token: token }),
    metaGraphGet(`${accountId}/insights`, { level: "campaign", fields: "campaign_id,spend,impressions,reach,actions", date_preset: datePreset, limit: 200, access_token: token }),
  ]);
  return { campaigns: campaigns?.data || [], insights: insights?.data || [] };
}
