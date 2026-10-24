// Renderiza en el navegador un reel vertical (1080×1920) a partir de imágenes, con texto y música opcional.
// Se graba en tiempo real con MediaRecorder: la pestaña debe quedarse visible mientras se genera.
import { kenBurns, sceneAt, totalDuration } from "@/lib/reelTimeline";

export type ReelScene = { image: string; caption: string; duration: number };
export type ReelOptions = { title: string; music?: File | null; fade?: number; fps?: number };

const W = 1080, H = 1920;
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("No se pudo cargar una imagen.")); img.src = src; });
}

export function pickRecorderType() {
  const options = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return options.find(type => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "video/webm";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) { const next = line ? `${line} ${word}` : word; if (line && ctx.measureText(next).width > width) { lines.push(line); line = word } else line = next; }
    if (line) lines.push(line);
  }
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale: number, dx: number, dy: number, alpha: number) {
  const ratio = Math.max(W / img.width, H / img.height) * scale;
  const w = img.width * ratio, h = img.height * ratio;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2 + dx * W, (H - h) / 2 + dy * H, w, h);
  ctx.globalAlpha = 1;
}

// Texto estilo reel: blanco, grueso, con sombra, en la parte superior para no chocar con los botones de Facebook.
function drawCaption(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, alpha: number) {
  if (!text.trim() || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = size * .35; ctx.shadowOffsetY = size * .06;
  ctx.fillStyle = "#ffffff";
  wrap(ctx, text, W * .84).forEach((line, i) => ctx.fillText(line, W / 2, y + i * size * 1.22));
  ctx.restore();
}

export async function renderReel(scenes: ReelScene[], options: ReelOptions, onProgress?: (ratio: number) => void): Promise<{ blob: Blob; type: string }> {
  if (!scenes.length) throw new Error("Agrega al menos una imagen.");
  if (typeof document !== "undefined" && document.fonts) { try { await document.fonts.load(`700 64px Inter`); } catch { /* Fuente de respaldo. */ } }
  const images = await Promise.all(scenes.map(scene => loadImage(scene.image)));
  const durations = scenes.map(scene => Math.max(1.5, scene.duration));
  const fade = options.fade ?? .6, fps = options.fps ?? 30;
  const total = totalDuration(durations);
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo iniciar el lienzo.");

  const stream = canvas.captureStream(fps);
  let audio: AudioContext | null = null;
  if (options.music) {
    audio = new AudioContext();
    const buffer = await audio.decodeAudioData(await options.music.arrayBuffer());
    const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(.9, audio.currentTime);
    gain.gain.setValueAtTime(.9, audio.currentTime + Math.max(0, total - 1.5));
    gain.gain.linearRampToValueAtTime(0, audio.currentTime + total);
    const destination = audio.createMediaStreamDestination();
    source.connect(gain).connect(destination); source.start();
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
  }
  const type = pickRecorderType();
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const finished = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

  const draw = (t: number) => {
    const frame = sceneAt(t, durations, fade);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const a = kenBurns(frame.progress, frame.index);
    drawCover(ctx, images[frame.index], a.scale, a.dx, a.dy, 1);
    if (frame.next !== null && frame.mix > 0) { const b = kenBurns(0, frame.next); drawCover(ctx, images[frame.next], b.scale, b.dx, b.dy, frame.mix); }
    // Degradado arriba para que el texto se lea sobre cualquier imagen.
    const shade = ctx.createLinearGradient(0, 0, 0, H * .42); shade.addColorStop(0, "rgba(0,0,0,.45)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H * .42);
    const titleAlpha = options.title.trim() ? Math.max(0, Math.min(1, (3 - t) / .5)) : 0;
    drawCaption(ctx, options.title, H * .12, 78, titleAlpha);
    const captionFade = Math.min(1, frame.progress * durations[frame.index] / .4) * (1 - frame.mix);
    drawCaption(ctx, scenes[frame.index].caption, titleAlpha > 0 ? H * .12 + 230 : H * .12, 62, captionFade);
  };

  draw(0);
  recorder.start(250);
  const startedAt = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      draw(Math.min(t, total));
      onProgress?.(Math.min(1, t / total));
      if (t >= total) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await finished;
  stream.getTracks().forEach(track => track.stop());
  if (audio) await audio.close();
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), type: type.split(";")[0] };
}
