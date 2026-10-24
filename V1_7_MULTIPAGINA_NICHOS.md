# Efímero Content Engine · V1.7 · Multipágina y laboratorio de nichos

## Qué se implementó

- Se conserva el sistema existente: Facebook OAuth / tokens cifrados, generación, revisión Meta, publicaciones individuales, cola, imágenes masivas y gestor de reels.
- Nueva entrada de menú **Principal → Laboratorio 30 días**, con los nichos **Fe, Nostalgia y Humor cotidiano**.
- Cada nicho puede asociarse **únicamente a una página de Facebook que la cuenta tenga conectada**, con validación en el servidor. No se crean páginas falsas.
- Inicia pruebas de 30 días, con fecha de inicio configurable. Muestra avance, días registrados y agregados por nicho.
- Captura diaria de **alcance, interacciones, qualified views, seguidores netos, costo de producción, posts y reels publicados**; si no existe el dato, se guarda NULL (no cero inventado). Datos **manuales**, explícitamente etiquetados como tales.
- Calcula engagement (%) con los días que tengan **ambos** datos de interacciones y alcance, sin mezclar días incompletos.
- Al concluir 30 días permite indicar manualmente **Ganadora / Prometedora / Pivotar-cerrar**; no declara resultados automáticamente sin evidencia.
- Fase 4: después de clasificar la primera ronda, permite registrar hasta dos nichos más.
- Segmentación por página de Biblioteca, Calendario, Bandeja y paneles que consumen estas listas: al cambiar la página activa se filtran los datos y los elementos nuevos se etiquetan con la página correspondiente.
- Preservación de datos legados: registros antiguos sin página asignada **no se reparten a todas las páginas**. Se puede asignarlos de forma explícita a la página elegida desde la banda superior. La acción no publica.
- Los perfiles editoriales que se creen ahora en Supabase se guardan por página.
- El generador rápido consulta el nicho vinculado a la página y adapta formato predeterminado y contexto del prompt de IA (Fe, Nostalgia o Humor cotidiano).

## Pasos para instalar

1. Haz copia de seguridad de la base Supabase y del ZIP anterior antes de reemplazar archivos.
2. En **Supabase SQL Editor**, ejecuta `supabase/NICHE_LAB_MIGRATION.sql` **una vez**. Alternativamente, si ya acostumbras ejecutar el esquema entero, las mismas migraciones idempotentes están incorporadas al final de `supabase/schema.sql`.
3. Descomprime este ZIP y reemplaza tu proyecto conservando las variables `.env.local` **del despliegue existente**, que el ZIP nunca incluye.
4. Usa `npm ci` y luego `npm run build` en tu equipo (con acceso al registro npm). Ejecuta `npm run dev` o despliega en Vercel.
5. Abre **Meta → Conexión / Sincronizar páginas** para revisar si Facebook devuelve las 3 páginas reales.
6. Abre **Laboratorio 30 días**, asigna cada nicho a una página y pulsa **Iniciar prueba**. Si aún no tienes alguna página, puedes iniciar el experimento sin vincularla y completar la vinculación después.
7. Captura los resultados verificados cada día. Los datos vacíos significan que el indicador todavía no está disponible.

## Integridad y limitaciones

- La migración de Supabase es **obligatoria antes de usar** las nuevas funciones que escriben `page_id`. De no ejecutarla, esas operaciones devolverán errores; no se han borrado datos previos.
- No se inicia ninguna campaña de Ads ni se publica contenido automáticamente desde el nuevo Laboratorio.
- Este bloque **no sincroniza todavía de forma automática los 7 KPIs desde Meta**. Algunos insights requieren permisos específicos y ciertas métricas, como *qualified views*, pueden no existir o variar según Meta y formato. El formulario es manual, con procedencia señalada.
- La segmentación aplicada en el módulo principal es por **página** y no es una auditoría integral de todos los módulos antiguos: otros componentes pueden mantener sus propios datos localmente o tablas históricas. Revisar esos módulos será una implementación posterior.
- Las tablas editoriales existentes de la versión anterior conservan su modelo de seguridad y la actual migración no lo modifica; para operar con varios usuarios se requiere auditar también las políticas RLS preexistentes. Las tablas nuevas del Laboratorio sólo se consultan vía rutas privadas que verifican sesión y pertenencia del usuario.
- **No se pudo ejecutar una compilación real `next build` en este entorno:** las dependencias no estaban incluidas en el ZIP y la reinstalación mediante npm no concluyó. Sí se validaron sintácticamente los nuevos archivos TypeScript/TSX mediante el parser de TypeScript. Ejecuta la compilación indicada en paso 4 para verificar el despliegue.

## Archivos clave

- `components/NicheLab.tsx`: interfaz del experimento.
- `app/api/niches/route.ts`: API privada de CRUD validado.
- `components/EfimeroApp.tsx`: navegación, separación por página, migración manual de datos heredados.
- `supabase/NICHE_LAB_MIGRATION.sql`: cambios incrementales.
- `app/globals.css`: estilos, diseño responsive.
