import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";

type StockPhoto = { id: string; thumb: string; full: string; alt: string; color: string };

// Busca fotos verticales gratuitas para la plantilla "Oración con fondo".
// Usa Pixabay (PIXABAY_API_KEY) y, si no hay clave, Pexels (PEXELS_API_KEY).
// La clave queda en el servidor; el navegador solo recibe miniaturas y la URL de descarga.
async function searchPixabay(apiKey: string, query: string, page: number) {
  const params = new URLSearchParams({ key: apiKey, q: query, lang: "es", image_type: "photo", orientation: "vertical", safesearch: "true", per_page: "24", page: String(page) });
  const response = await fetch(`https://pixabay.com/api/?${params}`, { cache: "no-store" });
  if (response.status === 429) throw Object.assign(new Error("Llegaste al límite de búsquedas de Pixabay por ahora. Intenta en un minuto."), { status: 429 });
  if (!response.ok) throw new Error(`Pixabay respondió ${response.status}.`);
  const data = await response.json();
  const photos: StockPhoto[] = (Array.isArray(data.hits) ? data.hits : []).map((hit: any) => ({
    id: `pixabay-${hit.id}`,
    thumb: String(hit.webformatURL || hit.previewURL || ""),
    full: String(hit.largeImageURL || hit.webformatURL || ""),
    alt: String(hit.tags || ""),
    color: "#222",
  }));
  return { photos, hasMore: page * 24 < Math.min(Number(data.totalHits || 0), 500), source: "Pixabay" };
}

async function searchPexels(apiKey: string, query: string, page: number) {
  const params = new URLSearchParams({ query, orientation: "portrait", per_page: "24", page: String(page), locale: "es-ES" });
  const response = await fetch(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: apiKey }, cache: "no-store" });
  if (response.status === 429) throw Object.assign(new Error("Llegaste al límite de búsquedas de Pexels por ahora. Intenta en un rato."), { status: 429 });
  if (!response.ok) throw new Error(`Pexels respondió ${response.status}.`);
  const data = await response.json();
  const photos: StockPhoto[] = (Array.isArray(data.photos) ? data.photos : []).map((photo: any) => ({
    id: `pexels-${photo.id}`,
    thumb: String(photo.src?.medium || photo.src?.small || ""),
    full: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ""),
    alt: String(photo.alt || ""),
    color: String(photo.avg_color || "#222"),
  }));
  return { photos, hasMore: Boolean(data.next_page), source: "Pexels" };
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const pixabayKey = process.env.PIXABAY_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pixabayKey && !pexelsKey) return NextResponse.json({ error: "Falta PIXABAY_API_KEY. Crea tu clave gratis en pixabay.com/api/docs y agrégala a las variables de entorno." }, { status: 501 });
  const query = String(request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(20, Number(request.nextUrl.searchParams.get("page") || 1)));
  if (!query) return NextResponse.json({ error: "Escribe qué fondo buscas." }, { status: 400 });
  try {
    const result = pixabayKey ? await searchPixabay(pixabayKey, query, page) : await searchPexels(pexelsKey!, query, page);
    return NextResponse.json({ ...result, photos: result.photos.filter(photo => photo.thumb && photo.full), page });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "No se pudo buscar fondos.") }, { status: Number(error?.status || 502) });
  }
}
