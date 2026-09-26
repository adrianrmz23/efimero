# Learning Agent · configuración y prueba

## Qué hace

El Learning Agent NO realiza fine-tuning. Construye una memoria editorial actualizable a partir de páginas públicas vigiladas y la mezcla con el Dataset propio de Efímero.

## Requisitos existentes

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

BRIGHTDATA_API_KEY=
BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID=gd_lkaxegm826bjpoo9m5

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

No se añade ninguna variable nueva.

## 1. Supabase

Ejecuta completo:

```text
supabase/schema.sql
```

El script crea las tablas de Learning Agent y las funciones de similitud pgvector.

## 2. Recolectar páginas

1. Ve a **Radar inspiración**.
2. Agrega varias páginas públicas a Watchlist.
3. Puedes sincronizarlas individualmente o ir a **Centro de control → Learning Agent**.
4. En Learning Agent elige 10, 25 o 50 posts por página.
5. Pulsa **Recolectar + aprender**.

La UI muestra el máximo de registros externos que solicitará el ciclo para que el coste de Bright Data sea visible antes de ejecutarlo.

## 3. Aprendizaje

Cada post se transforma en señales abstractas:

- categoría
- tono
- tipo de hook
- estructura
- tema
- mecanismo editorial
- longitud
- conceptos generales

Después se crean embeddings y clusters. Los patrones guardados NO son copias de los textos originales.

## 4. Generar

En **Generar con aprendizaje** define:

- objetivo
- categoría opcional
- cantidad
- nivel de exploración

El generador consulta:

1. patrones externos relevantes;
2. Dataset editorial propio;
3. reglas de originalidad y Compliance.

Cada propuesta muestra novedad, score editorial, similitud externa y similitud con contenido propio.

## 5. Guardrails

Una propuesta no puede seleccionarse si:

- Compliance no está en PASS;
- existe riesgo alto de similitud con una fuente externa;
- se parece excesivamente a un copy propio ya existente.

Enviar a Bandeja crea borradores; no publica automáticamente.
