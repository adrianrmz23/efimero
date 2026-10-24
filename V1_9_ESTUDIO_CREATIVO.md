# Efímero Content Engine v1.9 — Estudio Creativo Híbrido

**Base:** ZIP v1.8 enviado por el usuario. La v1.9 conserva el laboratorio de nichos, autenticación, integración Meta, reels, programación individual y masiva y los demás módulos existentes.

## Funcionalidades nuevas

1. **Principal → Estudio creativo**: dos tipos de plantilla:
   - **Oración de santo** (marco dorado, fondo pergamino, ilustración a la izquierda, título, intención, oración y marca de tu página).
   - **Texto minimalista** (fondo blanco, avatar de tu página, nombre, @usuario, título y texto exacto).
2. **Plantillas con branding propio por página**: el nombre, @usuario, avatar y logo se guardan en `localStorage`, indexados por `pageId`. Cada página de Facebook tiene su propia identidad, incluso si dos tienen exactamente el mismo nombre.
3. **Biblioteca local de arte religioso**: subir o generar una ilustración por santo. Se guarda en IndexedDB, indexada por `pageId` y nombre del santo, para reutilizarla sin volver a pagar por el mismo arte en el mismo navegador.
4. **Opcional IA para arte**: llama a la integración OpenAI ya existente (`/api/images/generate`, modo `saint-art`); pide únicamente ilustración sin texto, marcos o logos. Requiere `OPENAI_API_KEY`; usa `OPENAI_IMAGE_MODEL` (predeterminado `gpt-image-2.5-flare`). Hay confirmación explícita antes de incurrir en costos.
5. **Lotes de hasta 12 creatividades**: separar piezas con una línea `---`.
   - Oraciones: primera línea `Santo | Intención`, y debajo el texto completo.
   - Minimalista: `Título | Inicio del texto`, con continuación en las líneas siguientes, o texto sin título para reutilizar el título del formulario.
6. **Arte correcto para cada santo**: jamás reutiliza por accidente el retrato de San Benito para publicar una oración de San Judas. Opcionalmente solicita una ilustración por santo nuevo (confirmación previa). Las piezas con marcador de posición pueden servir para maquetar, pero se bloquea su envío a programación.
7. **Render exacto en Canvas**: ningún proveedor de IA escribe palabras, nombres ni @usuarios; se dibujan desde los campos. Formatos 1:1, 4:5, 9:16. Si el texto no cabe, se informa y se bloquea esa exportación.
8. **Exportación local**: JPG individual desde vista previa o ZIP con todas las imágenes del lote (sin instalar librerías de ZIP adicionales).
9. **Envío a programación masiva**: desde Estudio → "Revisar y llevar a Bulk imágenes". Hace revisión Meta del texto incorporado en la imagen (no solo del copy visible en la publicación), y Bulk vuelve a comprobarlo antes de cada programación.
10. **Aislamiento por página**: el lote lleva `pageId` de origen. Bulk imágenes lo selecciona automáticamente y bloquea publicar esas creatividades en otra página por error. Los horarios continúan usando la cola real de Meta.

## Instalación / actualización

1. Realiza respaldo de la v1.8, `env.local` y Supabase.
2. Sustituye el proyecto por esta versión **sin reemplazar tu `.env.local` actual**.
3. No hay migraciones SQL nuevas para la v1.9. Si vienes de una versión más antigua, aplica primero `supabase/NICHE_LAB_MIGRATION.sql` y `supabase/V1_8_FOLLOWERS_MIGRATION.sql` según corresponda.
4. Ejecuta `npm ci`, `npm run build` y `npm run dev`.
5. En la app: **Principal → Estudio creativo**. Selecciona la página, ajusta el nombre/@usuario, sube el avatar/logo que tienes autorización para utilizar y elige plantilla.
6. Para oraciones religiosas, sube la ilustración del santo o elige generar por IA. Las imágenes de muestra de otras cuentas **no se incluyen**: el usuario aporta su identidad propia y las ilustraciones que tenga derecho a publicar.
7. Crea una pieza o introduce un lote. Revisa la vista previa, pulsa **Generar lote**, revisa todas las piezas y elige **Descargar ZIP** o **Revisar y llevar a Bulk imágenes**.
8. En Bulk imágenes revisa horario/intervalo/página y confirma explícitamente para publicar en Meta. Nada se programa automáticamente por solo generar el lote.

## Ejemplo: dos santos en un lote

```
San Benito | Protección del hogar
Señor, acompaña a mi familia y llena de serenidad nuestra casa. Amén.
---
San Judas Tadeo | Fortaleza
Que encuentre paciencia para superar las dificultades del día. Amén.
```

## Ejemplo: dos posts minimalistas

```
Oración de la noche | Señor, ayúdame a descansar con paz.
Amén.
---
Reflexión del día | El tiempo también enseña a valorar lo sencillo.
```

## Aspectos a considerar

- Los estilos del navegador y la biblioteca local de artes **no se sincronizan entre dispositivos** ni se guardan en Supabase; exporta tus imágenes para respaldarlas. Los datos de programa se guardan mediante los mecanismos existentes.
- La generación artística utiliza **OpenAI API existente**. No incorpora aún FLUX, Recraft ni nano-banana, ni pago por paquetes. Si no hay clave, el editor funciona con fondos/arte que cargues tú, sin consumir API.
- La API de imágenes puede cobrar por petición y tiene sus propios límites. Las 12 imágenes del lote no implican 12 llamadas: la composición no usa IA, pero si marcas "generar ilustraciones faltantes", se hace una llamada **por santo nuevo**.
- La revisión de cumplimiento no garantiza monetización ni valida visualmente todos los componentes de una ilustración; se requiere revisión humana de la creatividad y derechos de uso.
- El editor impide enviar placeholders de santos a Meta. Para contenido minimalista permite generar y programar sin IA.
- En el Bulk imágenes preexistente los posts ya programados continúan referenciados por Meta; no se crea aún una galería permanente de imágenes finales en Supabase Storage. Conservar el ZIP exportado sirve como respaldo.
- Las vistas previas se ven mejor después de cargar una ilustración auténtica en el estilo deseado. La ornamentación está programada en Canvas y puede evolucionar estéticamente con nuevos templates.

## Verificaciones técnicas ejecutadas

- Compilación aislada de TypeScript en `lib/creativeStudio.ts`, `lib/creativeArtStore.ts` y `lib/browserZip.ts` usando `--strict`, resultado correcto.
- Análisis de sintaxis/transformación TypeScript de 100 archivos de app, components y lib, sin errores de sintaxis.
- Prueba de render JPEG local de plantillas Oración 1:1, Minimal 4:5 y Minimal 9:16: archivos generados correctamente.
- Prueba de parser de dos santos y de dos textos minimalistas.
- Prueba de ZIP de tres imágenes, comprobado con `unzip -t`.
- **Limitación de esta ejecución:** npm no pudo completar `npm ci` por falta de acceso a dependencias del registro en este entorno; por tanto no se afirma un build Next.js verificado. Ejecuta los comandos en tu equipo y comparte cualquier error de consola.
