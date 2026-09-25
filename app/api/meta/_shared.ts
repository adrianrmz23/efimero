const version = (process.env.META_GRAPH_VERSION || "").trim();
export const graphBase = `https://graph.facebook.com/${version ? `${version}/` : ""}`;

export async function graphGet(path: string, params: Record<string,string|number|boolean|undefined>) {
  const url = new URL(path.replace(/^\//, ""), graphBase);
  Object.entries(params).forEach(([key,value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Meta Graph API respondió ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function resolvePageToken(pageId: string) {
  const fixedId = (process.env.META_PAGE_ID || "").trim();
  const fixedToken = (process.env.META_PAGE_ACCESS_TOKEN || "").trim();
  const userToken = (process.env.META_USER_ACCESS_TOKEN || "").trim();

  if (fixedToken && (!fixedId || fixedId === pageId)) return fixedToken;
  if (!userToken) throw new Error("No hay token de Meta configurado para esta página.");

  const accounts = await graphGet("me/accounts", {
    fields: "id,name,access_token",
    limit: 100,
    access_token: userToken,
  });
  const page = (accounts?.data || []).find((item: any) => String(item.id) === String(pageId));
  if (!page?.access_token) throw new Error("La página seleccionada no está disponible para el token configurado.");
  return page.access_token as string;
}
