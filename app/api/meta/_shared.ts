import { getServerUser } from "@/lib/serverAuth";
import { metaGraphBase, metaGraphGet, resolveStoredPageToken } from "@/lib/metaServer";

export const graphBase = metaGraphBase;
export const graphGet = metaGraphGet;

export async function resolvePageToken(pageId: string) {
  const user = await getServerUser();
  if (user) {
    try {
      const stored = await resolveStoredPageToken(user.id, pageId);
      return stored.token;
    } catch {}
  }

  // Compatibilidad temporal con la configuración antigua mientras completas OAuth.
  const fixedId = (process.env.META_PAGE_ID || "").trim();
  const fixedToken = (process.env.META_PAGE_ACCESS_TOKEN || "").trim();
  const userToken = (process.env.META_USER_ACCESS_TOKEN || "").trim();
  if (fixedToken && (!fixedId || fixedId === pageId)) return fixedToken;
  if (!userToken) throw new Error("Conecta Facebook desde la sección Meta.");

  const accounts = await graphGet("me/accounts", {
    fields: "id,name,access_token",
    limit: 100,
    access_token: userToken,
  });
  const page = (accounts?.data || []).find((item: any) => String(item.id) === String(pageId));
  if (!page?.access_token) throw new Error("La página seleccionada no está disponible.");
  return String(page.access_token);
}
