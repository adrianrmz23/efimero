// Campañas de "Me gusta de la página" con la API de Marketing de Meta.
// Regla de la casa: todo se crea en PAUSA y con un tope de presupuesto diario; activar es decisión del usuario.

export const ADS_SCOPES = ["ads_management", "ads_read"];

// Monedas en las que Meta no usa centavos (el presupuesto va en unidades enteras).
const NO_CENTS = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);
export const currencyOffset = (currency: string) => (NO_CENTS.has(String(currency || "").toUpperCase()) ? 1 : 100);
export const toMinorUnits = (amount: number, currency: string) => Math.round(amount * currencyOffset(currency));
export const fromMinorUnits = (amount: number, currency: string) => Number(amount || 0) / currencyOffset(currency);

// Tope diario por campaña, en la moneda de la cuenta (unidades normales, no centavos).
export function maxDailyBudget() {
  const value = Number(process.env.ADS_MAX_DAILY_BUDGET || 200);
  return Number.isFinite(value) && value > 0 ? value : 200;
}

export type LikesCampaignInput = {
  accountId: string;
  pageId: string;
  postId: string;
  name: string;
  dailyBudget: number;
  days: number;
  countries: string[];
  ageMin: number;
  ageMax: number;
};

// Valida y normaliza lo que llega del navegador antes de tocar la API.
export function validateLikesCampaign(input: Partial<LikesCampaignInput>, cap: number) {
  const accountId = String(input.accountId || "").trim();
  const pageId = String(input.pageId || "").trim();
  const postId = String(input.postId || "").trim();
  const dailyBudget = Number(input.dailyBudget || 0);
  const days = Math.round(Number(input.days || 0));
  const countries = (Array.isArray(input.countries) ? input.countries : []).map(c => String(c).trim().toUpperCase()).filter(c => /^[A-Z]{2}$/.test(c));
  const ageMin = Math.round(Number(input.ageMin || 18));
  const ageMax = Math.round(Number(input.ageMax || 65));
  if (!/^act_\d+$/.test(accountId)) throw new Error("Elige una cuenta publicitaria válida.");
  if (!/^\d+$/.test(pageId)) throw new Error("Elige una página.");
  if (!new RegExp(`^${pageId}_\\d+$`).test(postId)) throw new Error("Elige una publicación de esa página para el anuncio.");
  if (!(dailyBudget > 0)) throw new Error("Escribe un presupuesto diario.");
  if (dailyBudget > cap) throw new Error(`El presupuesto diario no puede pasar de ${cap}.`);
  if (days < 1 || days > 30) throw new Error("La campaña debe durar entre 1 y 30 días.");
  if (!countries.length || countries.length > 25) throw new Error("Elige entre 1 y 25 países.");
  if (ageMin < 18 || ageMax > 65 || ageMin > ageMax) throw new Error("Revisa el rango de edad (18 a 65).");
  const name = String(input.name || "").trim().slice(0, 120) || "Me gusta de la página";
  return { accountId, pageId, postId, name, dailyBudget, days, countries, ageMin, ageMax };
}

export type InsightRow = { campaign_id?: string; spend?: string; impressions?: string; reach?: string; actions?: Array<{ action_type: string; value: string }> };

// "like" es el Me gusta de la página en las métricas de Meta.
export function summarizeInsights(row: InsightRow | undefined) {
  const spend = Number(row?.spend || 0);
  const likes = Number((row?.actions || []).find(a => a.action_type === "like")?.value || 0);
  return {
    spend,
    likes,
    impressions: Number(row?.impressions || 0),
    reach: Number(row?.reach || 0),
    costPerLike: likes > 0 ? spend / likes : null,
  };
}

export function adsManagerUrl(accountId: string, campaignId?: string) {
  const url = new URL("https://adsmanager.facebook.com/adsmanager/manage/campaigns");
  url.searchParams.set("act", accountId.replace(/^act_/, ""));
  if (campaignId) url.searchParams.set("selected_campaign_ids", campaignId);
  return url.toString();
}
