# Cheaper Inference · V1.4

Efímero usa el endpoint compatible con OpenAI Chat Completions:

`https://api.cheaperinference.com/v1/chat/completions`

Configuración recomendada:

```env
CHEAPERINFERENCE_API_KEY=...
CHEAPERINFERENCE_MODEL=gpt-5.6-terra
CHEAPERINFERENCE_BASE_URL=https://api.cheaperinference.com/v1
```

## Modelo elegido

`gpt-5.6-terra` es el predeterminado para generación de publicaciones porque prioriza calidad sobre el tier más barato sin llegar al costo de Sol. Para máxima economía puedes cambiar únicamente la variable a `gpt-5.6-luna`.

## Guardrails

La generación busca interacción natural mediante preguntas concretas, humor identificable, nostalgia, dilemas y retos ligeros. El prompt prohíbe CTAs artificiales como “comenta”, “comparte”, “etiqueta”, “reacciona”, “dale like”, “dinos” o “escribe AMÉN”. Después, el texto vuelve a pasar por el guardrail de Compliance de Efímero.


## Corrección V1.6.2

Versiones anteriores del proyecto documentaron por error `api.cheapestinference.com`. El proveedor usado por la cuenta mostrada en las capturas es **Cheaper Inference** y su endpoint OpenAI-compatible es `https://api.cheaperinference.com/v1`.

Efímero conserva compatibilidad con las variables legacy y corrige automáticamente ese dominio antiguo si todavía existe en Vercel. Si Cheaper Inference falla, `/api/generate` intenta OpenAI; si ninguno responde, ya no oculta el fallo con un texto local salvo que se active explícitamente `ALLOW_LOCAL_GENERATION_FALLBACK=true`.
