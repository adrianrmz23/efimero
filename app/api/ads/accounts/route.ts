import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { maxDailyBudget } from "@/lib/metaAds";
import { listAdAccounts, resolveAdsToken } from "@/lib/metaAdsServer";

export const dynamic = "force-dynamic";

// Cuentas publicitarias del usuario y si ya dio permiso de anuncios.
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  try {
    const { token, hasScope } = await resolveAdsToken(user.id);
    if (!hasScope) return NextResponse.json({ hasScope: false, accounts: [], maxDailyBudget: maxDailyBudget() });
    const accounts = await listAdAccounts(token);
    return NextResponse.json({ hasScope: true, accounts, maxDailyBudget: maxDailyBudget() });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudieron leer las cuentas publicitarias.") }, { status: Number(error?.status || 502) });
  }
}
