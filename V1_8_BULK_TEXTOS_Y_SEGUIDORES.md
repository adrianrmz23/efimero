# Efímero Content Engine v1.8 — Operación multipágina y programación masiva

## Implementado

1. **Selector de páginas sin confusiones**: cada opción indica nombre de la página, recuento y últimos seis dígitos del ID. Si Meta entrega `followers_count`, se muestra como **seguidores**. Si solo ofrece `fan_count`, la aplicación indica **Me gusta**, sin confundir ambos indicadores. Los datos ausentes se muestran explícitamente como no disponibles. Hay que sincronizar las páginas desde **Meta** para actualizar los números.
2. **Bulk textos** dentro de Principal: pega hasta 40 copys separados con líneas en blanco o `---`, ajusta intervalos de 30 a 180 minutos y define franjas horarias de publicación (por defecto 08:00–23:00).
3. **Evita colisiones con la cola de Meta**: usa `/api/meta/scheduled` para proponer el siguiente hueco, y lo consulta de nuevo en el momento de confirmar un lote. También acepta fecha/hora manual, previa validación de futuro.
4. **Revisión obligatoria de Compliance** para cada texto antes de habilitar programación. Las piezas en `review` o `block` no pasan el lote. Permite editar textos y aceptar una corrección propuesta; cualquier cambio reinicia las revisiones.
5. **Previsualización** por pieza con fecha y hora estimadas; detección de duplicados en el lote; indicador de éxitos/fallos; registro en Supabase y envío a la programación real de Meta solo tras confirmar expresamente.
6. **Sin reintentos automáticos** para evitar duplicados cuando hay respuestas ambiguas de red. Tras un envío, el lote se bloquea hasta pulsar **Preparar nuevo lote**. Las piezas confirmadas se muestran como programadas, y los problemas deben verificarse en **Cola Meta**.

## Instalar sobre la v1.7

1. Haz backup de tu Supabase y código existente.
2. Ejecuta `supabase/V1_8_FOLLOWERS_MIGRATION.sql` en el SQL Editor de Supabase **después de las migraciones v1.7**.
3. Reemplaza archivos por los de este ZIP, pero **conserva tu `.env.local` y cualquier secreto local**.
4. `npm ci` y `npm run build` en tu equipo; luego `npm run dev`.
5. En Meta, pulsa **Sincronizar páginas**. Verifica los nombres e ID antes de programar.
6. En menú Principal → **Bulk textos**, selecciona página, pega copys, revisa Compliance, comprueba horarios y confirma.

## Alcance y limitaciones

- Esta versión programa **posts de texto** a una página por lote. Las imágenes conservan su programador masivo independiente y los reels conservan el gestor anterior. No se implementó aún generación de imágenes con API externa.
- No añade una automatización que publique sin aprobación humana; sigue requiriendo sesión activa durante el envío del lote. Meta se encarga de publicar los posts ya confirmados en su cola.
- La revisión de Compliance es asistida y no garantiza aceptación, alcance ni monetización en Meta.
- El intervalo se aplica entre envíos salvo cambios de día; la franja horaria evita horas indeseadas. Si alguien programa en paralelo desde otra herramienta, Meta puede recibir horarios coincidentes, por lo que conviene comprobar Cola Meta.
- La ruta de publicación ahora exige una sesión y resuelve el token de página desde la sesión en el servidor (con compatibilidad del token manual anterior), en vez de escoger arbitrariamente el primer token asociado al ID. Queda pendiente una auditoría de todos los endpoints de autenticación para despliegues multiusuario.
- Para asegurar consistencia de las cifras, sigue siendo necesario que Facebook conceda campos/permisos y que la sincronización finalice. Si no los devuelve, la app no inventa el dato.
