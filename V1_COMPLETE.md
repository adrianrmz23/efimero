# Efímero Content Engine · V1 completa

La V1 llega hasta el Bloque 28. A partir de aquí conviene usar la plataforma con datos reales antes de añadir más módulos.

## Validación recomendada
1. Ejecuta `supabase/schema.sql`.
2. Indexa Dataset.
3. Ejecuta QA final y corrige cualquier check crítico.
4. Prueba Agente editorial con 3 días / 2 textos diarios.
5. Revisa Scoring + Compliance antes de mandar propuestas a Bandeja.
6. Publica una pieza controlada y verifica snapshots de métricas.
7. Genera el primer Reporte semanal.
8. Cuando QA esté estable, elimina `META_USER_ACCESS_TOKEN` de Vercel si todavía existe.

## Principio de la V1
La plataforma informa y automatiza tareas repetitivas, pero no presenta scores como garantía de viralidad o monetización. Compliance Meta permanece obligatorio antes de publicación.
