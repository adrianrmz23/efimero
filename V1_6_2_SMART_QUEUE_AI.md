# Efímero V1.6.2 · Smart Queue + AI Fix

## Cola automática de Meta

- Programador individual: si Fecha y Hora quedan vacías, consulta la cola real de Meta y programa 30 minutos después de la última publicación pendiente.
- Bulk imágenes: si Inicio opcional queda vacío, consulta la cola real de Meta y coloca la primera imagen `intervalo` minutos después del último post pendiente.
- Si Meta no tiene publicaciones programadas, se usa el siguiente horario válido desde la hora actual.
- La cola se vuelve a consultar justo antes de programar para evitar colisiones con posts creados mientras se estaba preparando el contenido.
- Una fecha/hora manual siempre tiene prioridad.

## Generador IA

- Se corrigió el endpoint de Cheaper Inference a `https://api.cheaperinference.com/v1`.
- Modelo por defecto: `gpt-5.6-terra`.
- Se aceptan variables nuevas `CHEAPERINFERENCE_*` y las variables legacy del proyecto.
- Si Cheaper Inference falla, se intenta OpenAI.
- Si ninguna IA responde, la UI muestra el error; no aparenta una generación IA usando el fallback local.
