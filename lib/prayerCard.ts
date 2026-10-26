// Tarjeta de oración (1080×1920): fondo de pergamino con adornos (generado sin texto) y la oración escrita encima.
// El texto lo dibuja la app, así que sale exacto y legible (la IA no escribe letras bien).
const W = 1080, H = 1920;
const SERIF = 'Georgia, "Times New Roman", serif';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("No se pudo cargar el fondo de la tarjeta.")); img.src = src; });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) { const next = line ? `${line} ${word}` : word; if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line);
  }
  return lines;
}

// Fondos de tarjeta: cada tema cambia los adornos (y cómo se mueven al animarlos); el centro siempre queda libre para el texto.
export const CARD_THEMES: Record<string, { label: string; motif: string; motion: string }> = {
  dove: { label: "Paloma y lirios", motif: "a glowing white dove with golden light rays at the top center, white lilies and soft gold ornaments framing the corners and sides", motion: "the white dove gently flaps its wings while hovering in place, light rays softly shimmer, lilies sway slightly" },
  marian: { label: "Mariano (azul y flores)", motif: "a delicate golden crown with twelve small shining stars at the top center, soft blue and white flowers (hydrangeas, white roses, lilies) framing the sides, light blue silk ribbon details", motion: "the twelve stars twinkle softly, the flowers sway slightly, the silk ribbon moves gently" },
  sacredHeart: { label: "Sagrado Corazón", motif: "a glowing Sacred Heart with a small cross and golden flames radiating soft light at the top center, deep red roses and gold filigree framing the corners", motion: "the Sacred Heart glows and pulses softly, the small flames flicker gently, rose petals sway slightly" },
  roses: { label: "Rosas y cruz dorada", motif: "a radiant golden cross with soft light at the top center, blush pink and white roses with green leaves framing the edges, delicate gold filigree", motion: "the light of the golden cross shimmers softly, the roses sway slightly, a few petals drift down slowly" },
  angels: { label: "Ángeles y nubes", motif: "two small praying angels with white wings on soft clouds in the upper corners, heavenly golden light rays from the top center, gold ornaments along the sides", motion: "the angels' wings move softly, the clouds drift slowly, the light rays shimmer" },
  rosary: { label: "Rosario y velas", motif: "a wooden rosary with a small crucifix draped along the top, lit candles glowing in the lower corners, olive branches and gold ornaments along the sides", motion: "the candle flames flicker gently, warm light pulses softly, olive leaves move slightly" },
  sunrise: { label: "Amanecer celestial", motif: "a soft sunrise sky with golden clouds and light rays at the top, wheat and olive branches framing the sides, a small shining cross in the sky", motion: "the clouds drift slowly, the sunrise light shimmers, wheat and olive branches sway gently" },
  stainedGlass: { label: "Vitral", motif: "an arched stained glass window frame in soft jewel tones with a dove and a chalice in the glass at the top, ornate gold border", motion: "colored light from the stained glass shimmers and shifts softly, sparkles of light drift" },
};
const CARD_KEYWORDS: Array<[RegExp, string]> = [[/virgen|mar[ií]a|guadalupe|carmen|f[aá]tima|lourdes|inmaculada|rosa m[ií]stica/i, "marian"], [/sagrado coraz[oó]n|coraz[oó]n de jes[uú]s|divina misericordia/i, "sacredHeart"], [/esp[ií]ritu santo|pentecost/i, "dove"], [/[aá]ngel|arc[aá]ngel|miguel|rafael|gabriel/i, "angels"], [/rosario|difuntos|almas|duelo|luto/i, "rosary"], [/ma[nñ]ana|amanecer|d[ií]a|gratitud|gracias/i, "sunrise"]];

// Tema automático: el que pide el tema de la oración; si no hay pista, uno al azar distinto del anterior.
export function pickCardTheme(topic: string, previous = "") {
  const hit = CARD_KEYWORDS.find(([re]) => re.test(topic))?.[1];
  if (hit && hit !== previous) return hit;
  const options = Object.keys(CARD_THEMES).filter(k => k !== previous);
  return options[Math.floor(Math.random() * options.length)];
}
export const cardBackgroundPrompt = (theme: string) => `Ornate vintage parchment prayer card background, aged cream paper texture, ${(CARD_THEMES[theme] || CARD_THEMES.dove).motif}, large empty plain parchment area in the center for text, soft warm light, highly detailed, vertical 9:16, absolutely no text, no letters, no words.`;

// Escribe el velo, el título y la oración. Se usa sobre el fondo (tarjeta fija) o sobre un lienzo vacío
// (capa transparente que va encima del fondo animado, para que las letras no se deformen).
function drawText(ctx: CanvasRenderingContext2D, title: string, body: string) {
  // Velo cálido en el centro para que el texto siempre se lea, aunque el fondo tenga detalles.
  const veil = ctx.createRadialGradient(W / 2, H * .55, 80, W / 2, H * .55, W * .62);
  veil.addColorStop(0, "rgba(250,240,218,.82)"); veil.addColorStop(1, "rgba(250,240,218,0)");
  ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);
  const textW = W * .68, top = H * .2, bottomLimit = H * .88;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  // Título grande en dos líneas como máximo.
  let titleSize = 104, titleLines: string[] = [];
  for (; titleSize >= 64; titleSize -= 4) { ctx.font = `700 ${titleSize}px ${SERIF}`; titleLines = wrap(ctx, title, textW); if (titleLines.length <= 2) break; }
  ctx.fillStyle = "#2b1d10";
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * titleSize * 1.08));
  const bodyTop = top + titleLines.length * titleSize * 1.08 + 40;
  // Cuerpo: baja de tamaño hasta que quepa.
  let size = 50, lines: string[] = [];
  for (; size >= 28; size -= 2) { ctx.font = `400 ${size}px ${SERIF}`; lines = wrap(ctx, body, textW); if (bodyTop + lines.length * size * 1.32 <= bottomLimit) break; }
  lines.forEach((l, i) => {
    const y = bodyTop + i * size * 1.32;
    const isAmen = /^am[eé]n[.!]*$/i.test(l.trim());
    ctx.font = `${isAmen ? 700 : 400} ${size}px ${SERIF}`;
    // "Señor", "Dios" y "Jesús" en rojo oscuro, como en las estampas.
    if (!isAmen && /(Señor|Dios|Jesús|Padre|María)/.test(l)) {
      const parts = l.split(/(Señor|Dios|Jesús|Padre|María)/);
      let x = W / 2 - ctx.measureText(l).width / 2; ctx.textAlign = "left";
      parts.forEach(p => { if (!p) return; ctx.fillStyle = /^(Señor|Dios|Jesús|Padre|María)$/.test(p) ? "#8b1a1a" : "#2b1d10"; ctx.fillText(p, x, y); x += ctx.measureText(p).width; });
      ctx.textAlign = "center";
    } else { ctx.fillStyle = isAmen ? "#8b1a1a" : "#2b1d10"; ctx.fillText(l, W / 2, y); }
  });
}

// Devuelve la tarjeta completa (JPG) y la capa de texto sola (PNG transparente).
export async function renderPrayerCardLayers(background: string, title: string, body: string) {
  if (typeof document !== "undefined" && document.fonts) { try { await document.fonts.load(`700 80px ${SERIF}`); } catch { /* Fuente del sistema. */ } }
  const img = await loadImage(background);
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo iniciar el lienzo.");
  const ratio = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * ratio) / 2, (H - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  drawText(ctx, title, body);
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H;
  const lctx = layer.getContext("2d"); if (!lctx) throw new Error("No se pudo iniciar el lienzo.");
  drawText(lctx, title, body);
  return { image: canvas.toDataURL("image/jpeg", .92), overlay: layer.toDataURL("image/png") };
}

export async function renderPrayerCard(background: string, title: string, body: string) {
  return (await renderPrayerCardLayers(background, title, body)).image;
}

// Movimiento del fondo de la tarjeta: cámara fija para que la capa de texto siga alineada.
export const cardMotionPrompt = (theme: string) => `${(CARD_THEMES[theme] || CARD_THEMES.dove).motion}, a few soft sparkles drift. Static camera, no zoom, keep the parchment, ornaments and composition exactly the same, the center stays empty plain parchment, no text, no letters.`;
