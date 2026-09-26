# Efímero V1.5 · New Interface

## Rediseño visual

La V1.5 reemplaza la estética violeta anterior por un sistema editorial oscuro más sobrio:

- fondos grafito / petróleo;
- acento principal turquesa;
- acento secundario azul;
- detalles cálidos ámbar;
- tipografía y controles más grandes;
- tarjetas con menor ruido visual;
- jerarquía más clara en navegación, formularios y acciones.

La estructura funcional no cambia: el objetivo es conservar toda la lógica construida y mejorar su experiencia de uso.

## Página de trabajo persistente

El encabezado global incorpora `Página activa`.

La selección se conserva con:

- `localStorage` mediante `efimero-working-page-id`;
- `activePageId` de la conexión Meta.

Por ello la página seleccionada se reutiliza en el Generador rápido, Programador individual y Calendario. Cambiarla en uno de esos puntos actualiza el contexto global.

## Formularios

Inputs, selects y textareas comparten ahora:

- altura mínima de 46 px;
- tipografía de 14 px o superior;
- estados hover/focus visibles;
- bordes y superficies consistentes;
- flecha personalizada en selects;
- placeholders de mayor contraste;
- outline accesible para teclado.

## Instalación

No hay cambios de Supabase ni variables de entorno nuevas.

1. Copiar esta versión sobre el proyecto existente sin borrar `.env.local`.
2. Ejecutar `npm run build`.
3. Si pasa, hacer commit y push a `main`.
