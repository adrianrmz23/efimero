// Renderiza en el navegador un reel vertical (1080×1920) a partir de escenas con imagen o clip de video,
// con texto, voz en off y música opcionales.
// Se graba en tiempo real con MediaRecorder: la pestaña debe quedarse visible mientras se genera.
import { kenBurns, sceneAt, totalDuration } from "@/lib/reelTimeline";

// `video` es un clip de recorrido generado con IA (URL del mismo origen o blob:). Si existe, sustituye la imagen.
export type ReelScene = { image: string; caption: string; duration: number; video?: string };
export type ReelOptions = { title: string; music?: File | null; voice?: Blob | null; fade?: number; fps?: number };

const W = 1080, H = 1920;
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';
type Source = { kind: "image"; el: HTMLImageElement; w: number; h: number } | { kind: "video"; el: HTMLVideoElement; w: number; h: number };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("No se pudo cargar una imagen.")); img.src = src; });
}

function loadVideo(src: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto"; video.crossOrigin = "anonymous";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("No se pudo cargar un clip de video."));
    video.src = src;
  });
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

function drawCover(ctx: CanvasRenderingContext2D, src: Source, scale: number, dx: number, dy: number, alpha: number) {
  if (!src.w || !src.h) return;
  const ratio = Math.max(W / src.w, H / src.h) * scale;
  const w = src.w * ratio, h = src.h * ratio;
  ctx.globalAlpha = alpha;
  ctx.drawImage(src.el, (W - w) / 2 + dx * W, (H - h) / 2 + dy * H, w, h);
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
  if (!scenes.length) throw new Error("Agrega al menos una escena.");
  if (typeof document !== "undefined" && document.fonts) { try { await document.fonts.load(`700 64px Inter`); } catch { /* Fuente de respaldo. */ } }
  const sources: Source[] = await Promise.all(scenes.map(async scene => {
    if (scene.video) { const el = await loadVideo(scene.video); return { kind: "video" as const, el, w: el.videoWidth, h: el.videoHeight }; }
    const el = await loadImage(scene.image); return { kind: "image" as const, el, w: el.width, h: el.height };
  }));
  // Un clip no puede durar más que su video; si es más corto que la escena, se ajusta la escena.
  const durations = scenes.map((scene, i) => { const s = sources[i]; const base = Math.max(1.5, scene.duration); return s.kind === "video" && Number.isFinite(s.el.duration) ? Math.min(base, s.el.duration) : base; });
  const fade = options.fade ?? .6, fps = options.fps ?? 30;
  const total = totalDuration(durations);
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo iniciar el lienzo.");

  const stream = canvas.captureStream(fps);
  let audio: AudioContext | null = null;
  if (options.music || options.voice) {
    audio = new AudioContext();
    const destination = audio.createMediaStreamDestination();
    const now = audio.currentTime;
    if (options.music) {
      const buffer = await audio.decodeAudioData(await options.music.arrayBuffer());
      const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
      const gain = audio.createGain();
      // Con voz en off, la música baja para que la narración se entienda.
      const level = options.voice ? .22 : .9;
      gain.gain.setValueAtTime(level, now);
      gain.gain.setValueAtTime(level, now + Math.max(0, total - 1.5));
      gain.gain.linearRampToValueAtTime(0, now + total);
      source.connect(gain).connect(destination); source.start();
    }
    if (options.voice) {
      const buffer = await audio.decodeAudioData(await options.voice.arrayBuffer());
      const source = audio.createBufferSource(); source.buffer = buffer;
      // Un poco por debajo del máximo para que no sature al mezclarse con la música.
      const gain = audio.createGain(); gain.gain.value = .85;
      source.connect(gain).connect(destination); source.start(now + .4);
    }
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
  }
  const type = pickRecorderType();
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const finished = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });

  // Los clips se reproducen solo mientras se ven (escena actual o la siguiente durante la transición).
  const syncVideos = (visible: Set<number>) => sources.forEach((s, i) => {
    if (s.kind !== "video") return;
    if (visible.has(i)) { if (s.el.paused && !s.el.ended) void s.el.play().catch(() => {}); }
    else if (!s.el.paused) s.el.pause();
  });

  const draw = (t: number) => {
    const frame = sceneAt(t, durations, fade);
    syncVideos(new Set(frame.next !== null && frame.mix > 0 ? [frame.index, frame.next] : [frame.index]));
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const current = sources[frame.index];
    const a = current.kind === "video" ? { scale: 1, dx: 0, dy: 0 } : kenBurns(frame.progress, frame.index);
    drawCover(ctx, current, a.scale, a.dx, a.dy, 1);
    if (frame.next !== null && frame.mix > 0) { const next = sources[frame.next]; const b = next.kind === "video" ? { scale: 1, dx: 0, dy: 0 } : kenBurns(0, frame.next); drawCover(ctx, next, b.scale, b.dx, b.dy, frame.mix); }
    // Degradado arriba para que el texto se lea sobre cualquier imagen.
    const shade = ctx.createLinearGradient(0, 0, 0, H * .42); shade.addColorStop(0, "rgba(0,0,0,.45)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H * .42);
    const titleAlpha = options.title.trim() ? Math.max(0, Math.min(1, (3 - t) / .5)) : 0;
    drawCaption(ctx, options.title, H * .12, 78, titleAlpha);
    const captionFade = Math.min(1, frame.progress * durations[frame.index] / .4) * (1 - frame.mix);
    drawCaption(ctx, scenes[frame.index].caption, titleAlpha > 0 ? H * .12 + 230 : H * .12, 62, captionFade);
  };

  sources.forEach(s => { if (s.kind === "video") s.el.currentTime = 0; });
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
  sources.forEach(s => { if (s.kind === "video") s.el.pause(); });
  stream.getTracks().forEach(track => track.stop());
  if (audio) await audio.close();
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), type: type.split(";")[0] };
}
