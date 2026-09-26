# Efímero V1.6.1 · Safe Queue

## Problema corregido
Antes, eliminar una tarjeta del Calendario solo la quitaba del estado local. Si Facebook ya había recibido la programación, Meta seguía publicándola a la hora indicada.

## Nueva fuente de verdad
`Principal → Cola Meta` consulta directamente la cola de Facebook para la página activa.

Puedes:
- actualizar la cola;
- seleccionar una o todas las programadas;
- cancelar una individual;
- cancelar varias en lote.

## Eliminación segura desde Calendario
- `Borrador/Revisión/Aprobado/Error`: se elimina de Efímero/Supabase.
- `Programado`: Efímero exige `meta_post_id`, envía la cancelación a Meta y solo si Meta confirma elimina la pieza local.
- Si no existe `meta_post_id`, se bloquea el borrado y debes cancelar desde `Cola Meta`.

## Supabase
No requiere cambios de schema.

## API nueva
- `GET /api/meta/scheduled?pageId=...`
- `DELETE /api/meta/scheduled` con `{ pageId, postIds: [...] }`
