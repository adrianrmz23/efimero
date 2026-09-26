# Efímero V1.6 · Visual Queue

## Programación masiva de imágenes

Nueva sección **Principal → Bulk imágenes**.

Permite:
- subir múltiples JPG, PNG o WebP en un solo lote;
- comprimir las imágenes antes de enviarlas;
- usar la página activa del workspace automáticamente;
- definir intervalos de 30, 45, 60, 90 o 120 minutos;
- definir una ventana diaria, por ejemplo 08:00–23:30;
- iniciar automáticamente a partir de la hora actual o elegir una fecha/hora de inicio;
- continuar al siguiente día cuando ya no cabe otro slot dentro de la ventana;
- previsualizar toda la cola antes de confirmar;
- programar secuencialmente para reducir errores y presión sobre la API;
- ver progreso por imagen;
- reintentar únicamente las imágenes fallidas;
- incorporar las publicaciones exitosas al Calendario.

### Protección temporal

El primer slot siempre respeta `META_MIN_SCHEDULE_MINUTES`. Si una hora ya pasó, no se utiliza. Cuando termina la ventana diaria, el siguiente slot se coloca al día siguiente en la hora configurada de inicio.

### Persistencia

Las publicaciones programadas se guardan en `efimero_scheduled_posts` con formato `Imagen` y se reflejan en el Calendario. No se requiere una migración nueva de Supabase.

### Imágenes

La imagen se comprime en el navegador y se envía directamente a Meta al crear la publicación programada. Efímero no almacena las imágenes originales en Supabase Storage en esta versión, evitando duplicar almacenamiento innecesariamente.
