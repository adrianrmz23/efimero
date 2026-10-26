// Texto dañado: letras chinas, coreanas, cirílicas, etc. dentro de contenido en español, o palabras pegadas
// con mayúsculas a mitad ("losDeque", "paraIKI"). Lo hemos visto en respuestas de revendedores de la API de Claude.
export function looksCorrupted(text: string) {
  if (/[\u0400-\u04FF\u0590-\u06FF\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(text)) return true;
  return /(^|[^#@\w])[a-záéíóúñ]{3,}[A-Z][A-Za-z]*/.test(text);
}
