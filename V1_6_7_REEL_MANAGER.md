# Efímero V1.6.7 · Reel Manager

## Objetivo
Centralizar la revisión y eliminación de Reels publicados en una página administrada de Facebook.

## Flujo
1. Selecciona la página activa.
2. Efímero consulta `/{page-id}/published_posts` y busca publicaciones cuyo permalink/adjunto confirma formato Reel.
3. Puedes filtrar por 30, 90, 365 días o todo lo disponible.
4. Exporta CSV antes de borrar.
5. Selecciona Reels confirmados y escribe `ELIMINAR` para confirmar el borrado masivo.
6. El servidor vuelve a validar cada elemento como Reel antes de ejecutar DELETE en Graph API.

## Seguridad
- Los videos ambiguos no entran al borrado masivo.
- La eliminación se procesa en lotes pequeños.
- La acción es irreversible.
- Borrar contenido no garantiza recuperar monetización; revisa primero las infracciones de Meta.

## Permisos
Usa la conexión Meta ya existente y requiere acceso de lectura de la página y `pages_manage_posts` para eliminar contenido administrado.
