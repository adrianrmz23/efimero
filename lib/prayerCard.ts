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

export const cardBackgroundPrompt = "Ornate vintage parchment prayer card background, aged cream paper texture, a glowing white dove with golden light rays at the top center, white lilies and soft gold ornaments framing the corners and sides, large empty plain parchment area in the center for text, soft warm light, highly detailed, vertical 9:16, absolutely no text, no letters, no words.";

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
export const cardMotionPrompt = "The white dove gently flaps its wings while hovering in place, golden light rays softly shimmer and pulse, white lilies sway slightly in a gentle breeze, a few soft sparkles drift. Static camera, no zoom, keep the parchment, ornaments and composition exactly the same, the center stays empty plain parchment, no text, no letters.";
