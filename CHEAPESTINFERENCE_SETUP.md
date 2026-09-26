# CheapestInference · V1.4

Efímero usa el endpoint compatible con OpenAI Chat Completions:

`https://api.cheapestinference.com/v1/chat/completions`

Configuración recomendada:

```env
CHEAPESTINFERENCE_API_KEY=...
CHEAPESTINFERENCE_MODEL=gpt-5.6-terra
CHEAPESTINFERENCE_BASE_URL=https://api.cheapestinference.com/v1
```

## Modelo elegido

`gpt-5.6-terra` es el predeterminado para generación de publicaciones porque prioriza calidad sobre el tier más barato sin llegar al costo de Sol. Para máxima economía puedes cambiar únicamente la variable a `gpt-5.6-luna`.

## Guardrails

La generación busca interacción natural mediante preguntas concretas, humor identificable, nostalgia, dilemas y retos ligeros. El prompt prohíbe CTAs artificiales como “comenta”, “comparte”, “etiqueta”, “reacciona”, “dale like”, “dinos” o “escribe AMÉN”. Después, el texto vuelve a pasar por el guardrail de Compliance de Efímero.
