import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { adsManagerUrl, maxDailyBudget, summarizeInsights, validateLikesCampaign, type InsightRow } from "@/lib/metaAds";
import { createPausedLikesCampaign, getAdAccount, listCampaignResults, resolveAdsToken } from "@/lib/metaAdsServer";

export const dynamic = "force-dynamic";
const PRESETS = new Set(["last_7d", "last_30d", "last_90d", "maximum"]);

// Resultados por campaña: gasto, Me gusta y costo por Me gusta.
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const accountId = String(request.nextUrl.searchParams.get("accountId") || "");
  const preset = String(request.nextUrl.searchParams.get("datePreset") || "last_30d");
  if (!/^act_\d+$/.test(accountId)) return NextResponse.json({ error: "Elige una cuenta publicitaria." }, { status: 400 });
  try {
    const { token, hasScope } = await resolveAdsToken(user.id);
    if (!hasScope) return NextResponse.json({ error: "Falta dar permiso de anuncios." }, { status: 403 });
    const { campaigns, insights } = await listCampaignResults(token, accountId, PRESETS.has(preset) ? preset : "last_30d");
    const byCampaign = new Map((insights as InsightRow[]).map(row => [String(row.campaign_id), row]));
    const items = campaigns.map((c: any) => ({
      id: String(c.id),
      name: String(c.name || "Campaña"),
      status: String(c.effective_status || c.status || ""),
      objective: String(c.objective || ""),
      createdTime: c.created_time || null,
      url: adsManagerUrl(accountId, String(c.id)),
      ...summarizeInsights(byCampaign.get(String(c.id))),
    }));
    const totals = items.reduce((acc: { spend: number; likes: number }, item: any) => ({ spend: acc.spend + item.spend, likes: acc.likes + item.likes }), { spend: 0, likes: 0 });
    return NextResponse.json({ items, totals: { ...totals, costPerLike: totals.likes ? totals.spend / totals.likes : null } });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudieron leer los resultados.") }, { status: Number(error?.status || 502) });
  }
}

// Crea una campaña de Me gusta EN PAUSA. Nunca la activa.
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const input = validateLikesCampaign(body, maxDailyBudget());
    const { token, hasScope } = await resolveAdsToken(user.id);
    if (!hasScope) return NextResponse.json({ error: "Falta dar permiso de anuncios." }, { status: 403 });
    const account = await getAdAccount(token, input.accountId);
    if (!account.active) return NextResponse.json({ error: "La cuenta publicitaria no está activa. Revisa su estado y método de pago en Meta." }, { status: 400 });
    const created = await createPausedLikesCampaign(token, input, account.currency);
    return NextResponse.json({ ok: true, ...created, currency: account.currency, totalMax: input.dailyBudget * input.days, url: adsManagerUrl(input.accountId, created.campaignId) });
  } catch (error: any) {
    const partial = error?.partial;
    const accountId = String(body?.accountId || "");
    return NextResponse.json({
      error: String(error?.message || "No se pudo crear la campaña."),
      partial,
      // Lo que alcanzó a crearse queda en pausa; el enlace permite terminarlo o borrarlo en el Administrador de anuncios.
      url: partial?.campaignId && /^act_\d+$/.test(accountId) ? adsManagerUrl(accountId, partial.campaignId) : undefined,
    }, { status: 400 });
  }
}
