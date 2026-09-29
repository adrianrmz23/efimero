# Efímero V1.6.6 · Prayer Reels

## Generador de oraciones para Reel

Nueva herramienta dentro de **Crear** enfocada exclusivamente en generar texto de oración para reels.

Características:
- temas predefinidos como fortaleza, gratitud, noche, familia, decisiones y esperanza;
- tres extensiones, incluida una equivalente al ejemplo de referencia (150–210 palabras);
- estructura estable: título + 5–7 párrafos breves + cierre Amén;
- Cheaper Inference como proveedor principal y OpenAI como respaldo a través de `/api/generate`;
- revisión obligatoria con `/api/compliance/review` antes de mostrar el texto como aprobado;
- si Compliance propone una corrección, Efímero la vuelve a revisar antes de usarla;
- sin llamadas a comentar, compartir, reaccionar, etiquetar o “escribe Amén”;
- botón Copiar texto; no publica ni crea imágenes, porque el flujo está pensado para que el usuario arme el reel por separado.
