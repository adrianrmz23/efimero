// Renderiza en el navegador un reel vertical (1080×1920) a partir de escenas con imagen o clip de video,
// con texto, voz en off y música opcionales.
// Se graba en tiempo real con MediaRecorder: la pestaña debe quedarse visible mientras se genera.
import { kenBurns, sceneAt, totalDuration } from "@/lib/reelTimeline";
import { subtitleGroups, type TimedWord } from "@/lib/storyScript";

// `video` es un clip de recorrido generado con IA (URL del mismo origen o blob:). Si existe, sustituye la imagen.
// `loop`: el clip se repite con un fundido suave entre vueltas (para fondos que se ven mucho tiempo, como la tarjeta de oración).
// `overlay`: imagen transparente que va encima con el mismo encuadre (el texto de la tarjeta sobre su fondo animado).
export type ReelScene = { image: string; caption: string; duration: number; video?: string; loop?: boolean; overlay?: string };
// `subtitles`: palabras de la voz con su tiempo (desde que empieza la voz); se dibujan estilo karaoke abajo.
// `badge`: aviso pequeño fijo durante todo el video (por ejemplo, «Relato inspirador» en historias de ficción).
// `transition`: cómo pasa una escena a la siguiente. "dissolve" mezcla suave con un ligero acercamiento,
// "black" funde a negro (para momentos dramáticos) y "cut" es corte directo.
export type ReelTransition = "dissolve" | "black" | "cut";
// `subtitleStyle`: "karaoke" (blanco con la palabra en amarillo), "highlight" (mayúsculas grandes con la palabra en un
// recuadro de color), "box" (texto negro sobre recuadro blanco) o "none" (sin subtítulos, por ejemplo con la tarjeta de oración).
export type SubtitleStyle = "karaoke" | "highlight" | "box" | "none";
export type ReelOptions = { title: string; music?: File | null; voice?: Blob | null; subtitles?: TimedWord[]; subtitleStyle?: SubtitleStyle; badge?: string; transition?: ReelTransition; fade?: number; fps?: number; onPauseChange?: (paused: boolean) => void };
const ease = (x: number) => x * x * (3 - 2 * x);
const VOICE_OFFSET = .4;

const W = 1080, H = 1920;
const FONT = 'Inter, "Segoe UI", Arial, sans-serif';
// En los clips en bucle, `alt` es una segunda copia que entra con fundido mientras la primera termina.
type Source = { kind: "image"; el: HTMLImageElement; w: number; h: number } | { kind: "video"; el: HTMLVideoElement; w: number; h: number; alt?: HTMLVideoElement; fading?: boolean };
const LOOP_FADE = .8;

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

// Subtítulo estilo karaoke: frase corta en blanco con la palabra que se está diciendo en amarillo.
function drawSubtitle(ctx: CanvasRenderingContext2D, group: TimedWord[], t: number, style: SubtitleStyle = "karaoke") {
  if (style === "none") return;
  const size = style === "highlight" ? 84 : style === "box" ? 62 : 70;
  const label = (w: TimedWord) => style === "highlight" ? w.text.toLocaleUpperCase("es") : w.text;
  ctx.save();
  ctx.font = `${style === "box" ? 700 : 800} ${size}px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  const widths = group.map(w => ctx.measureText(label(w)).width);
  // Si la frase no cabe en una línea, se parte en dos.
  const lines: number[][] = [[]]; let lineWidth = 0;
  group.forEach((_, i) => { const w = widths[i] + (lines[lines.length - 1].length ? space : 0); if (lineWidth + w > W * .86 && lines[lines.length - 1].length) { lines.push([]); lineWidth = 0; } lines[lines.length - 1].push(i); lineWidth += widths[i] + (lines[lines.length - 1].length > 1 ? space : 0); });
  const lineH = size * (style === "box" ? 1.45 : 1.2);
  const baseY = (style === "highlight" ? H * .62 : H * .7) - (lines.length - 1) * lineH / 2;
  lines.forEach((line, row) => {
    const total = line.reduce((n, i, k) => n + widths[i] + (k ? space : 0), 0);
    let x = (W - total) / 2; const y = baseY + row * lineH;
    // Recuadro blanco detrás de cada renglón, como en los videos de frailes y predicadores.
    if (style === "box") { ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.beginPath(); ctx.roundRect(x - 26, y - size * .68, total + 52, size * 1.36, 18); ctx.fill(); }
    line.forEach(i => {
      const word = group[i]; const text = label(word); const active = t >= word.start && t < word.end + .05;
      if (style === "box") { ctx.fillStyle = active ? "#8b1a1a" : "#111111"; ctx.fillText(text, x, y); }
      else if (style === "highlight") {
        if (active) { ctx.fillStyle = "#f2b705"; ctx.beginPath(); ctx.roundRect(x - 14, y - size * .62, widths[i] + 28, size * 1.24, 16); ctx.fill(); ctx.fillStyle = "#111111"; ctx.fillText(text, x, y); }
        else { ctx.lineWidth = size * .18; ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineJoin = "round"; ctx.strokeText(text, x, y); ctx.fillStyle = "#ffffff"; ctx.fillText(text, x, y); }
      } else {
        ctx.lineWidth = size * .16; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.lineJoin = "round"; ctx.strokeText(text, x, y);
        ctx.fillStyle = active ? "#ffd400" : "#ffffff"; ctx.fillText(text, x, y);
      }
      x += widths[i] + space;
    });
  });
  ctx.restore();
}

export async function renderReel(scenes: ReelScene[], options: ReelOptions, onProgress?: (ratio: number) => void): Promise<{ blob: Blob; type: string }> {
  if (!scenes.length) throw new Error("Agrega al menos una escena.");
  if (typeof document !== "undefined" && document.fonts) { try { await document.fonts.load(`700 64px Inter`); } catch { /* Fuente de respaldo. */ } }
  const sources: Source[] = await Promise.all(scenes.map(async scene => {
    if (scene.video) { const el = await loadVideo(scene.video); return { kind: "video" as const, el, w: el.videoWidth, h: el.videoHeight, alt: scene.loop ? await loadVideo(scene.video) : undefined }; }
    const el = await loadImage(scene.image); return { kind: "image" as const, el, w: el.width, h: el.height };
  }));
  // La duración de cada escena manda (la voz depende de ella). Si un clip es más corto, se reproduce un poco más lento
  // (sin bajar de 0.75× para que no se vea en cámara lenta) y, al terminar, su último cuadro sigue con un acercamiento suave.
  const durations = scenes.map(scene => Math.max(1.5, scene.duration));
  const overlays = await Promise.all(scenes.map(async scene => { if (!scene.overlay) return null; const el = await loadImage(scene.overlay); return { kind: "image" as const, el, w: el.width, h: el.height }; }));
  sources.forEach((s, i) => { if (s.kind === "video" && !s.alt && Number.isFinite(s.el.duration) && s.el.duration > 0) s.el.playbackRate = Math.max(.75, Math.min(1, s.el.duration / durations[i])); });
  const transition = options.transition || "dissolve";
  const fade = transition === "cut" ? .001 : options.fade ?? (transition === "black" ? .8 : 1), fps = options.fps ?? 30;
  const groups = options.subtitles?.length ? subtitleGroups(options.subtitles) : [];
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
      source.connect(gain).connect(destination); source.start(now + VOICE_OFFSET);
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
    if (visible.has(i)) { if (s.el.paused && !s.el.ended) void s.el.play().catch(() => {}); if (s.fading && s.alt?.paused) void s.alt.play().catch(() => {}); }
    else { if (!s.el.paused) s.el.pause(); if (s.alt && !s.alt.paused) s.alt.pause(); }
  });

  // Dibuja una escena; en los clips en bucle, la copia entra con fundido al final y luego toma su lugar.
  const drawSource = (i: number, scale: number, dx: number, dy: number, alpha: number) => {
    const s = sources[i];
    drawCover(ctx, s, scale, dx, dy, alpha);
    if (s.kind === "video" && s.alt && Number.isFinite(s.el.duration)) {
      const left = s.el.duration - s.el.currentTime;
      if (left <= LOOP_FADE || s.el.ended) {
        if (!s.fading) { s.fading = true; s.alt.currentTime = 0; void s.alt.play().catch(() => {}); }
        const mixIn = s.el.ended ? 1 : 1 - left / LOOP_FADE;
        drawCover(ctx, { kind: "video", el: s.alt, w: s.w, h: s.h }, scale, dx, dy, alpha * ease(Math.min(1, mixIn)));
        if (mixIn >= 1) { const old = s.el; old.pause(); s.el = s.alt; s.alt = old; s.fading = false; }
      }
    }
    const over = overlays[i]; if (over) drawCover(ctx, over, scale, dx, dy, alpha);
  };

  const draw = (t: number) => {
    const frame = sceneAt(t, durations, fade);
    syncVideos(new Set(frame.next !== null && frame.mix > 0 ? [frame.index, frame.next] : [frame.index]));
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    // Los clips llevan un acercamiento muy leve durante toda la escena: así no se nota si el video termina antes.
    const motion = (i: number, progress: number) => sources[i].kind === "video" ? { scale: 1 + .05 * progress, dx: 0, dy: 0 } : kenBurns(progress, i);
    const mix = ease(frame.mix);
    const a = motion(frame.index, frame.progress);
    const next = frame.next !== null && frame.mix > 0 ? frame.next : null;
    if (next !== null && transition === "black") {
      // Fundido a negro: la escena sale a negro y la siguiente entra desde negro.
      if (mix < .5) drawSource(frame.index, a.scale, a.dx, a.dy, 1 - mix * 2);
      else { const b = motion(next, 0); drawSource(next, b.scale, b.dx, b.dy, (mix - .5) * 2); }
    } else {
      drawSource(frame.index, a.scale, a.dx, a.dy, 1);
      // Disolución: la siguiente entra un poco más cerca y se asienta mientras aparece; la anterior sigue moviéndose debajo.
      if (next !== null) { const b = motion(next, 0); drawSource(next, b.scale * (1 + .06 * (1 - mix)), b.dx, b.dy, mix); }
    }
    // Degradado arriba para que el texto se lea sobre cualquier imagen.
    const shade = ctx.createLinearGradient(0, 0, 0, H * .42); shade.addColorStop(0, "rgba(0,0,0,.45)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H * .42);
    const titleAlpha = options.title.trim() ? Math.max(0, Math.min(1, (3 - t) / .5)) : 0;
    drawCaption(ctx, options.title, H * .12, 78, titleAlpha);
    const captionFade = Math.min(1, frame.progress * durations[frame.index] / .4) * (1 - frame.mix);
    drawCaption(ctx, scenes[frame.index].caption, titleAlpha > 0 ? H * .12 + 230 : H * .12, 62, captionFade);
    if (options.badge) {
      ctx.save(); ctx.font = `600 34px ${FONT}`; ctx.textBaseline = "middle";
      const label = options.badge; const w = ctx.measureText(label).width + 44; const x = (W - w) / 2, y = H * .045;
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(x, y, w, 56, 28); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.fillText(label, W / 2, y + 29); ctx.restore();
    }
    if (groups.length) {
      const st = t - VOICE_OFFSET;
      const group = groups.find((g, i) => st >= g[0].start - .05 && st < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + .6));
      if (group) drawSubtitle(ctx, group, st, options.subtitleStyle);
    }
  };

  sources.forEach(s => { if (s.kind === "video") s.el.currentTime = 0; });
  draw(0);
  recorder.start(250);
  // Si la pestaña se oculta, el navegador deja de dibujar y el video se congelaría mientras la voz sigue.
  // Por eso se pausa todo (grabación, audio, clips y reloj) y se reanuda al volver a la pestaña.
  let pausedMs = 0, pausedAt = 0, wake: (() => void) | null = null;
  const onVisibility = () => {
    if (document.hidden && !pausedAt) {
      pausedAt = performance.now();
      if (recorder.state === "recording") recorder.pause();
      void audio?.suspend();
      sources.forEach(s => { if (s.kind === "video") { s.el.pause(); s.alt?.pause(); } });
      options.onPauseChange?.(true);
    } else if (!document.hidden && pausedAt) {
      pausedMs += performance.now() - pausedAt; pausedAt = 0;
      void audio?.resume();
      if (recorder.state === "paused") recorder.resume();
      options.onPauseChange?.(false);
      wake?.();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const startedAt = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      if (pausedAt) { wake = () => { wake = null; requestAnimationFrame(tick); }; return; }
      const t = (performance.now() - startedAt - pausedMs) / 1000;
      draw(Math.min(t, total));
      onProgress?.(Math.min(1, t / total));
      if (t >= total) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  document.removeEventListener("visibilitychange", onVisibility);
  recorder.stop();
  await finished;
  sources.forEach(s => { if (s.kind === "video") { s.el.pause(); s.alt?.pause(); } });
  stream.getTracks().forEach(track => track.stop());
  if (audio) await audio.close();
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), type: type.split(";")[0] };
}
