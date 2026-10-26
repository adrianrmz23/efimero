// Portadas de reels (1080×1920): imagen de fondo, texto gigante con contorno y una palabra resaltada en color.
// Tres diseños pensados para llamar la atención en la cuadrícula de Reels sin depender de IA para el texto.
export type CoverLayout = "impacto" | "banda" | "titular" | "choque";
// `arrow` y `circle` señalan al personaje (zona central); `emoji` se pega junto al texto. `punch` sube contraste y color.
export type CoverOptions = { image: string; text: string; highlight?: string; badge?: string; layout: CoverLayout; accent?: string; arrow?: boolean; circle?: boolean; emoji?: string; punch?: boolean };
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

// Flecha curva roja con contorno blanco que apunta hacia (tx, ty).
function drawArrow(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
  const angle = Math.atan2(ty - fy, tx - fx);
  const cx = (fx + tx) / 2 + Math.cos(angle + Math.PI / 2) * 120, cy = (fy + ty) / 2 + Math.sin(angle + Math.PI / 2) * 120;
  const end = Math.atan2(ty - cy, tx - cx);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [color, width] of [["#ffffff", 46], ["#e11d2a", 30]] as const) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(cx, cy, tx - Math.cos(end) * 60, ty - Math.sin(end) * 60); ctx.stroke();
    const head = width === 46 ? 112 : 92;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(end - .5) * head, ty - Math.sin(end - .5) * head); ctx.lineTo(tx - Math.cos(end + .5) * head, ty - Math.sin(end + .5) * head); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Círculo rojo dibujado "a mano" alrededor de una zona.
function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.save(); ctx.lineCap = "round";
  for (const [color, width] of [["#ffffff", 30], ["#e11d2a", 18]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -.12, .15, Math.PI * 2 + .05); ctx.stroke();
  }
  ctx.restore();
}

const W = 1080, H = 1920;
const TITLE_FONT = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const BADGE_FONT = 'Inter, "Segoe UI", Arial, sans-serif';
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]/g, "");

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("No se pudo cargar la imagen de fondo.")); img.src = src; });
}

// Ajusta la imagen para cubrir un rectángulo (recortando lo que sobre), centrada un poco hacia arriba.
function coverRect(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.width, h / img.height);
  const sw = w / ratio, sh = h / ratio;
  ctx.drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) * .3), sw, sh, x, y, w, h);
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale = 1) {
  const ratio = Math.max(W / img.width, H / img.height) * scale;
  const w = img.width * ratio, h = img.height * ratio;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// Parte el texto en renglones y baja el tamaño hasta que quepa en el ancho y en el máximo de renglones.
export function fitLines(measure: (text: string, size: number) => number, text: string, maxWidth: number, maxLines: number, start: number, min: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let size = start; size >= min; size -= 4) {
    const lines: string[] = []; let line = "";
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && measure(next, size) > maxWidth) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every(l => measure(l, size) <= maxWidth)) return { size, lines };
  }
  return { size: min, lines: [text] };
}

// Dibuja un renglón palabra por palabra para poder pintar de otro color la palabra resaltada.
function drawLine(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, highlight: Set<string>, base: string, accent: string, stroke: string) {
  const space = ctx.measureText(" ").width;
  let cursor = x - ctx.measureText(line).width / 2;
  for (const word of line.split(" ")) {
    ctx.lineWidth = size * .14; ctx.strokeStyle = stroke; ctx.lineJoin = "round"; ctx.strokeText(word, cursor, y);
    ctx.fillStyle = highlight.has(plain(word)) ? accent : base; ctx.fillText(word, cursor, y);
    cursor += ctx.measureText(word).width + space;
  }
}

function drawBadge(ctx: CanvasRenderingContext2D, badge: string, color: string) {
  if (!badge.trim()) return;
  ctx.save(); ctx.font = `800 40px ${BADGE_FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const label = badge.toUpperCase(); const w = ctx.measureText(label).width + 56;
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(60, 96, w, 76, 38); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.fillText(label, 88, 136); ctx.restore();
}

export async function renderCover(canvas: HTMLCanvasElement, options: CoverOptions) {
  if (typeof document !== "undefined" && document.fonts) { try { await Promise.all([document.fonts.load(`400 120px "Bebas Neue"`), document.fonts.load(`800 40px Inter`)]); } catch { /* Fuente de respaldo. */ } }
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo iniciar el lienzo.");
  const img = await loadImage(options.image);
  const accent = options.accent || "#ffd400";
  const text = options.text.trim().toUpperCase();
  const highlight = new Set((options.highlight || "").split(/\s+/).map(plain).filter(Boolean));
  const measure = (t: string, size: number) => { ctx.font = `400 ${size}px ${TITLE_FONT}`; return ctx.measureText(t).width; };
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // Más contraste y saturación en la imagen: las portadas apagadas se pierden en la cuadrícula de Reels.
  if (options.punch !== false) ctx.filter = "contrast(1.15) saturate(1.35) brightness(1.04)";
  let textTop = H * .6;

  if (options.layout === "choque") {
    // Choque: texto enorme ARRIBA en dos colores sobre fondo oscuro y la foto debajo, para no taparle la cara a nadie.
    const { size, lines } = fitLines(measure, text, W * .9, 3, 250, 110);
    textTop = 230 + lines.length * size * .9;
    const imageTop = Math.min(H * .5, textTop + 10);
    ctx.fillStyle = "#0b0b0b"; ctx.fillRect(0, 0, W, H);
    coverRect(ctx, img, 0, imageTop - 140, W, H - imageTop + 140); ctx.filter = "none";
    const seam = ctx.createLinearGradient(0, imageTop - 140, 0, imageTop + 160); seam.addColorStop(0, "rgba(11,11,11,1)"); seam.addColorStop(1, "rgba(11,11,11,0)");
    ctx.fillStyle = seam; ctx.fillRect(0, imageTop - 140, W, 300);
    const bottom = ctx.createLinearGradient(0, H * .82, 0, H); bottom.addColorStop(0, "rgba(0,0,0,0)"); bottom.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = bottom; ctx.fillRect(0, 0, W, H);
    ctx.font = `400 ${size}px ${TITLE_FONT}`;
    ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    lines.forEach((line, i) => drawLine(ctx, line, W / 2, 230 + (i + 1) * size * .9, size, highlight, i % 2 === 0 ? "#ffffff" : accent, accent, "#000000"));
    ctx.shadowColor = "transparent";
  } else if (options.layout === "banda") {
    // Imagen completa y una franja inclinada de color con el texto en negro: se ve desde lejos.
    cover(ctx, img, 1.04); ctx.filter = "none";
    const shade = ctx.createLinearGradient(0, 0, 0, H); shade.addColorStop(0, "rgba(0,0,0,.25)"); shade.addColorStop(.5, "rgba(0,0,0,.05)"); shade.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    const { size, lines } = fitLines(measure, text, W * .8, 3, 210, 90);
    const bandH = lines.length * size * .92 + size * .55;
    ctx.save(); ctx.translate(W / 2, H * .62); ctx.rotate(-.05);
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 40; ctx.fillStyle = accent; ctx.fillRect(-W * .62, -bandH / 2, W * 1.24, bandH); ctx.shadowColor = "transparent";
    ctx.font = `400 ${size}px ${TITLE_FONT}`;
    lines.forEach((line, i) => drawLine(ctx, line, 0, -bandH / 2 + size * .3 + (i + 1) * size * .92 - size * .12, size, new Set(), "#111111", "#111111", "rgba(0,0,0,0)"));
    ctx.restore();
  } else if (options.layout === "titular") {
    // Recuadro blanco arriba con el titular y la imagen enmarcada debajo, como portada de noticia.
    const { size, lines } = fitLines(measure, text, W * .84, 3, 170, 80);
    const boxH = lines.length * size * .95 + 120;
    // Fondo oscuro arriba y la imagen completa debajo del titular, para que el recuadro no tape al personaje.
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, W, H);
    coverRect(ctx, img, 0, 230 + boxH + 18, W, H - (230 + boxH + 18)); ctx.filter = "none";
    textTop = 230 + boxH;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 230, W, boxH);
    ctx.fillStyle = accent; ctx.fillRect(0, 230 + boxH, W, 18);
    ctx.font = `400 ${size}px ${TITLE_FONT}`;
    lines.forEach((line, i) => drawLine(ctx, line, W / 2, 230 + 60 + (i + 1) * size * .95 - size * .1, size, highlight, "#111111", "#d81f26", "rgba(0,0,0,0)"));
  } else {
    // Impacto: texto gigante abajo con contorno negro y la palabra clave en amarillo sobre un degradado oscuro.
    cover(ctx, img, 1.06); ctx.filter = "none";
    const shade = ctx.createLinearGradient(0, H * .38, 0, H); shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(.55, "rgba(0,0,0,.6)"); shade.addColorStop(1, "rgba(0,0,0,.88)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .8); vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    const { size, lines } = fitLines(measure, text, W * .9, 4, 230, 100);
    ctx.font = `400 ${size}px ${TITLE_FONT}`;
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    const bottom = H * .86;
    lines.forEach((line, i) => drawLine(ctx, line, W / 2, bottom - (lines.length - 1 - i) * size * .92, size, highlight, "#ffffff", accent, "#000000"));
    ctx.shadowColor = "transparent";
  }
  ctx.filter = "none";
  // Elementos de impacto: apuntan al centro de la imagen, donde suele estar el personaje.
  const focusY = options.layout === "choque" || options.layout === "titular" ? Math.max(textTop + 260, H * .62) : H * .36;
  if (options.circle) drawCircle(ctx, W * .5, focusY, 300, 360);
  if (options.arrow) {
    const fromLeft = options.layout !== "banda";
    drawArrow(ctx, fromLeft ? W * .1 : W * .9, options.layout === "impacto" ? H * .58 : focusY + 520, W * (fromLeft ? .34 : .66), focusY + 120);
  }
  if (options.emoji?.trim()) {
    ctx.save(); ctx.font = `150px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 20;
    ctx.fillText(options.emoji.trim(), W * .84, options.layout === "impacto" ? H * .58 : options.layout === "banda" ? H * .44 : Math.min(H * .9, textTop + 110));
    ctx.restore();
  }
  drawBadge(ctx, options.badge || "", options.layout === "titular" ? "#d81f26" : "rgba(216,31,38,.92)");
  return canvas.toDataURL("image/jpeg", .92);
}
