# Efímero Content Engine — Bloques 9 a 12

Esta entrega cierra el primer ciclo operativo de Efímero: **generar → revisar políticas → calendarizar → crear imagen → programar/publicar en Facebook**.

## Bloque 9 — Publicación + Compliance Meta

- Nuevo agente/revisor obligatorio de Compliance Meta.
- Revisión local + IA cuando existe `OPENAI_API_KEY`.
- Detecta y bloquea CTA/engagement bait como pedir likes, comentarios, compartidos, etiquetas, follows o reacciones.
- Revisa clickbait, incentivos artificiales y señales de spam.
- Puede proponer una corrección conservando el sentido del copy.
- Publicación real a Facebook desde el servidor usando el Page Access Token resuelto dinámicamente.
- Soporta texto e imagen.
- Antes de publicar hay confirmación explícita en UI.
- Un texto que no esté en estado `pass` no puede publicarse.

> El score de Compliance no garantiza monetización. Es un guardrail editorial interno y las políticas de Meta pueden cambiar.

## Bloque 10 — Calendario editorial avanzado

- Vista semanal.
- Drag & drop entre días.
- Edición de hora y texto.
- Filtros por estado y categoría.
- Estados: Borrador, Revisión, Aprobado, Programado, Publicado y Error.
- Selector multipágina.
- Revisión individual o masiva con Compliance.
- Programación y publicación real desde cada tarjeta.
- Publicación de imágenes generadas en el Bloque 12.

## Bloque 11 — Autopilot

- Configuración por página.
- Días, publicaciones por día, ventana horaria, categoría y objetivo.
- Modos Manual, Semi y Auto.
- Usa la memoria editorial de la página seleccionada.
- Máximo 30 piezas por ejecución para controlar coste/calidad.
- Todo el lote pasa por Compliance Meta antes de entrar al calendario.
- El modo Auto deja piezas aprobadas listas para programar; no elimina la confirmación del calendario para acciones externas.

## Bloque 12 — Motor de imágenes

- Plantillas locales para creatividad 1:1, 4:5 y 9:16.
- Texto exacto renderizado en Canvas para evitar errores tipográficos de la IA.
- Fondos opcionales generados con OpenAI Images.
- El fondo IA no contiene texto; el copy se sobrepone localmente.
- Exportación PNG.
- Revisión Compliance obligatoria antes de mandar la creatividad al calendario.
- El calendario puede enviar el PNG directamente a Meta como una publicación de foto.

## Flujo de Compliance

```text
Texto generado
    ↓
Reglas locales estrictas
    ↓
Revisor IA (si OPENAI_API_KEY existe)
    ↓
PASS / REVIEW / BLOCK
    ↓
Calendario
    ↓
Confirmación humana
    ↓
Meta / Facebook
```

Reglas centrales: no engagement bait, no CTA directo para interacción, no clickbait, no incentivos artificiales, no spam/repetición, y revisión conservadora de categorías sensibles.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_VISION_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare

META_APP_ID=
META_APP_SECRET=
META_USER_ACCESS_TOKEN=
META_GRAPH_VERSION=v26.0
META_POST_REACH_METRIC=

META_POLICY_RULESET_VERSION=2026-09
```

## Supabase

Ejecuta nuevamente `supabase/schema.sql`. El script es incremental y usa `if not exists`.

Añade metadatos de publicación a `efimero_scheduled_posts` y crea:

- `efimero_compliance_reviews`
- `efimero_autopilot_rules`
- `efimero_media_assets`

## Prueba recomendada

1. Abre **Fábrica** y genera 5 textos.
2. Comprueba el badge de Compliance.
3. Ve a **Calendario** y elige la página.
4. Revisa un borrador y déjalo como Aprobado.
5. Para la primera prueba real usa una publicación de bajo riesgo y pulsa **Publicar**; la app pedirá confirmación.
6. Abre **Autopilot**, genera un lote pequeño y verifica que cualquier pieza observada quede en Revisión.
7. Abre **Imágenes**, crea un PNG con plantilla local; después prueba un fondo IA.
8. Envía la creatividad al calendario y publícala solo después de revisarla.

## Nota importante

La plataforma aplica reglas conservadoras, pero no puede prometer elegibilidad o monetización: Meta puede actualizar sus políticas, evaluar señales fuera del texto y aplicar revisiones a nivel de cuenta/página. El agente debe mantenerse actualizado cuando cambien las políticas oficiales.

## Bloques 13–16 — Text-first Intelligence

Esta entrega mantiene el motor de imágenes, pero mueve el foco operativo a texto:

- **Bloque 13 · Aprendizaje por rendimiento:** convierte histórico + métricas en reglas de categoría, longitud y hooks. El perfil se guarda por página y alimenta a la Fábrica.
- **Bloque 14 · Experimentos de copy:** genera variantes controladas cambiando una sola dimensión (hook, longitud, tono o pregunta/afirmación), con Compliance Meta obligatorio.
- **Bloque 15 · Voz de audiencia:** lee comentarios autorizados de una publicación, detecta temas y lenguaje y propone textos nuevos sin copiar comentarios ni usar engagement bait.
- **Bloque 16 · Resumen ejecutivo:** concentra cobertura textual, métricas, compliance, salud de datos y un brief de producción para la página seleccionada.

### Supabase
Vuelve a ejecutar `supabase/schema.sql` para crear `efimero_learning_profiles`, `efimero_copy_experiments` y `efimero_audience_analyses`.

No se requieren nuevas variables de entorno respecto de los Bloques 9–12.

## Acceso privado
Esta versión incluye login privado con Supabase Auth. Lee `AUTH_SETUP.md` antes de desplegar.

## OAuth de Facebook dentro de Efímero

La versión de infraestructura OAuth permite conectar Facebook desde la propia plataforma y sustituye el flujo manual del Graph API Explorer. Consulta `META_OAUTH_SETUP.md` para configurar Supabase, Vercel y Meta Developers.

## Bloques 17–20 · Text Ops

Esta entrega mantiene el foco en texto y añade cuatro módulos operativos:

- **17 · Bandeja editorial:** revisión centralizada, Compliance y aprobación antes de calendario/publicación.
- **18 · Fatiga:** detecta saturación de categorías, hooks recurrentes y duplicados exactos.
- **19 · Compliance:** centro visible para probar textos, revalidar alertas y consultar auditoría reciente.
- **20 · Operaciones:** salud de sesión, Supabase, OpenAI, Meta OAuth y preparación de la cola.

También se rediseñaron las acciones del conector Meta para eliminar botones nativos del navegador y mantener la misma interfaz de Efímero.

Después de actualizar, ejecuta `supabase/schema.sql` de nuevo para crear `efimero_fatigue_snapshots` y su política RLS.
