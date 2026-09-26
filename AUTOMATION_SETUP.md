# Bloques 21–24 · Automatización

## 1) SQL
Ejecuta `supabase/schema.sql` completo. Agrega:
- `efimero_publish_jobs`
- `efimero_metric_snapshots`
- `efimero_editorial_dataset`
- extensión `vector`
- RPC `match_efimero_dataset`

## 2) Variables nuevas
```env
CRON_SECRET=una-cadena-larga-aleatoria
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```
Genera `CRON_SECRET` con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Añade las mismas variables en Vercel.

## 3) Scheduler
Endpoint protegido:
`GET /api/cron/automation`

Procesa únicamente publicaciones `Aprobado`, con Compliance `pass`, página definida y horario vencido. Usa locks y `efimero_publish_jobs` para reducir duplicados y aplica backoff en errores.

Puedes probarlo desde la UI: **Automatización → Scheduler → Ejecutar ahora**.

### Vercel Cron
Si tu plan permite frecuencia por minutos, crea un `vercel.json` similar a:
```json
{
  "crons": [
    {"path":"/api/cron/automation","schedule":"*/10 * * * *"},
    {"path":"/api/metrics/collect","schedule":"15 * * * *"}
  ]
}
```
En planes donde Cron sólo permite ejecución diaria, usa la programación nativa de Meta desde Calendario para horarios exactos y deja la recolección de métricas diaria o ejecútala manualmente.

## 4) Aprendizaje vivo
Endpoint:
`POST /api/metrics/collect`

Registra checkpoints 1h, 24h, 72h y 7d. Además actualiza/crea el registro correspondiente en Biblioteca para que `Aprendizaje` use el rendimiento nuevo.

## 5) Dataset editorial
En **Automatización → Dataset**, pulsa `Indexar 200 textos`.
Esto genera embeddings y permite búsqueda semántica. La Fábrica intenta recuperar automáticamente ejemplos relevantes del dataset al generar.

## 6) Páginas legales
Ya existen y son públicas:
- `/privacy`
- `/terms`
- `/data-deletion`

Puedes usarlas directamente en Meta Developers con el dominio de producción.
