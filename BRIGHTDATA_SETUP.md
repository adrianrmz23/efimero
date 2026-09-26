# Efímero · Bright Data Radar

Efímero V1.2 usa el scraper **Facebook - Pages Posts by Profile URL** de Bright Data para sincronizar publicaciones públicas de páginas externas guardadas en la Watchlist.

## 1. Variables server-only

Agrega en `.env.local` y en Vercel:

```env
BRIGHTDATA_API_KEY=tu_api_key
BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID=gd_lkaxegm826bjpoo9m5
```

No uses `NEXT_PUBLIC_` para la API key.

## 2. Supabase

Ejecuta nuevamente `supabase/schema.sql`. Se agregan:

- columnas de estado de sincronización a `efimero_inspiration_watchlist`
- `efimero_inspiration_posts`

## 3. Flujo

1. Radar inspiración → agrega nombre + URL pública de Facebook.
2. Elige 10, 25, 50 o 100 posts.
3. Pulsa **Sincronizar**.
4. Efímero llama Bright Data desde el servidor y nunca expone la API key al navegador.
5. Los posts quedan persistidos en Supabase para evitar depender de una extracción nueva cada vez.
6. Pulsa **Analizar este patrón** en un post.
7. La IA abstrae hook, estructura, tema y mecanismo.
8. Las variaciones pasan por similitud y Compliance antes de poder guardarse.

## 4. Extracciones lentas

La integración usa la API síncrona de Bright Data. Si Bright Data responde con un `snapshot_id`, Efímero consulta el progreso automáticamente durante unos segundos. Si sigue procesándose, vuelve a pulsar **Sincronizar** más tarde; el `snapshot_id` queda asociado a la página.

## 5. Uso responsable

Usa únicamente páginas y publicaciones públicas. Efímero no intenta saltar autenticación, privacidad, bloqueos de acceso ni otras restricciones. Las referencias externas sirven para estudiar patrones y generar contenido nuevo, no para publicar copias literales.
