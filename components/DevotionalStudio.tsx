"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clapperboard, Copy, Download, FileText, ImagePlus, Loader2, Mic, ScrollText, Sparkles, Trash2, Video } from "lucide-react";
import { renderReel, type SubtitleStyle } from "@/lib/reelRender";
import { sceneDurationsFromWords, type TimedWord } from "@/lib/storyScript";
import { DEVOTIONAL_STYLES, devotionalSuffix, mergeVisuals, visualPlan, type DevotionalKind, type DevotionalScript } from "@/lib/devotional";
import { cardBackgroundPrompt, renderPrayerCard } from "@/lib/prayerCard";
import { useConfirm } from "@/components/ui/DialogProvider";
import CoverMaker from "@/components/CoverMaker";

type Media = { image?: string; video?: string; status?: "working" | "error"; note?: string };
type Look = "image" | "card";
const VOICES: Array<[string, string]> = [["Aoede", "Aoede · mujer, cálida"], ["Kore", "Kore · mujer, clara"], ["Leda", "Leda · mujer, joven"], ["Charon", "Charon · hombre, grave"], ["Orus", "Orus · hombre, firme"]];
const SUBTITLES: Array<[SubtitleStyle, string]> = [["highlight", "Grandes con palabra resaltada"], ["box", "En recuadro blanco"], ["karaoke", "Blancos con palabra amarilla"], ["none", "Sin subtítulos"]];
const HERO_MOTION = "Very subtle, slow and reverent motion: soft glowing light gently pulsing, light rays and sparkles drifting, clouds or candle flames moving softly, fabric barely moving, slow camera push-in. Keep the face, pose and art style exactly the same, no new elements, no text.";

async function shrink(dataUrl: string, w: number, h: number, maxLength: number) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("No se pudo leer la imagen.")); i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); if (!ctx) throw new Error("No se pudo procesar la imagen.");
  const ratio = Math.max(w / img.width, h / img.height); ctx.drawImage(img, (w - img.width * ratio) / 2, (h - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  for (let q = .85; q >= .45; q -= .08) { const out = c.toDataURL("image/jpeg", q); if (out.length < maxLength) return out; }
  return c.toDataURL("image/jpeg", .4);
}
const audioDuration = (blob: Blob) => new Promise<number>(resolve => { const a = new Audio(); a.onloadedmetadata = () => resolve(a.duration || 0); a.onerror = () => resolve(0); a.src = URL.createObjectURL(blob); });
async function generateImage(prompt: string) {
  const r = await fetch("/api/media/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo crear la imagen.");
  return d.image as string;
}
// Texto de la tarjeta: la oración corrida sin la frase gancho (la primera parte) y el «Amén.» en su propio renglón.
const cardBody = (lines: string[]) => lines.slice(lines.length > 3 ? 1 : 0).join(" ").replace(/\s*Am[eé]n[.!]*\s*$/i, "").trim() + "\n\nAmén.";

export default function DevotionalStudio() {
  const confirm = useConfirm();
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<DevotionalKind>("prayer");
  const [look, setLook] = useState<Look>("image");
  const [style, setStyle] = useState("painting");
  const [voiceName, setVoiceName] = useState("Aoede");
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("highlight");
  const [script, setScript] = useState<(DevotionalScript & { kind: DevotionalKind }) | null>(null);
  const [hero, setHero] = useState<Media>({});
  const [supports, setSupports] = useState<Media[]>([]);
  const [card, setCard] = useState<{ background?: string; image?: string; status?: "working" | "error"; note?: string }>({});
  const [voice, setVoice] = useState<{ blob: Blob; url: string; duration: number; words: TimedWord[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [output, setOutput] = useState<{ url: string; type: string } | null>(null);

  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => { if (voice) URL.revokeObjectURL(voice.url); }, [voice]);

  // La tarjeta se vuelve a escribir cuando cambian el título o el texto.
  useEffect(() => {
    if (!script || !card.background) return;
    let alive = true;
    void renderPrayerCard(card.background, script.cardTitle || script.title, cardBody(script.lines)).then(image => { if (alive) setCard(c => ({ ...c, image })); }).catch(e => { if (alive) setError(e?.message || "No se pudo dibujar la tarjeta."); });
    return () => { alive = false; };
  }, [script, card.background]);

  function chooseLook(next: Look) { setLook(next); setSubtitleStyle(next === "card" ? "none" : "highlight"); setOutput(null); }
  function patchLine(i: number, text: string) { setScript(cur => cur ? { ...cur, lines: cur.lines.map((l, k) => k === i ? text : l) } : cur); setVoice(null); setOutput(null); }

  async function writeScript() {
    if (!topic.trim()) return;
    setBusy("script"); setError(""); setOutput(null);
    try {
      const r = await fetch("/api/story/devotional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, kind }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo escribir la oración.");
      setScript(d); setHero({}); setSupports(d.support.map(() => ({}))); setCard(c => ({ background: c.background })); setVoice(null);
    } catch (e: any) { setError(e?.message || "No se pudo escribir la oración."); } finally { setBusy(""); }
  }

  async function makeImages() {
    if (!script) return;
    const count = look === "card" ? (card.background ? 0 : 1) : (hero.image ? 0 : 1) + supports.filter(s => !s.image).length;
    if (!count) return;
    if (!await confirm({ title: `¿Crear ${count} ${count === 1 ? "imagen" : "imágenes"}?`, description: `Se usará Cheaper Inference (aprox. 0.02 a 0.08 USD por imagen).${look === "card" ? " Se crea el pergamino sin letras; la oración la escribe la app para que salga exacta." : ""}`, confirmLabel: "Crear imágenes" })) return;
    setError(""); setOutput(null);
    if (look === "card") {
      setCard(c => ({ ...c, status: "working", note: "" }));
      try { setCard({ background: await generateImage(cardBackgroundPrompt) }); } catch (e: any) { setCard({ status: "error", note: e?.message || "Error" }); }
      return;
    }
    const jobs: Array<Promise<void>> = [];
    if (!hero.image) jobs.push((async () => {
      setHero({ status: "working" });
      try { setHero({ image: await generateImage(`${script.hero}. ${devotionalSuffix(style)}`) }); } catch (e: any) { setHero({ status: "error", note: e?.message || "Error" }); }
    })());
    script.support.forEach((prompt, i) => { if (supports[i]?.image) return; jobs.push((async () => {
      setSupports(cur => cur.map((s, k) => k === i ? { status: "working" } : s));
      try { const image = await generateImage(`${prompt}. Same sacred mood and color palette as a devotional image of: ${script.hero}. ${devotionalSuffix(style)}`); setSupports(cur => cur.map((s, k) => k === i ? { image } : s)); }
      catch (e: any) { setSupports(cur => cur.map((s, k) => k === i ? { status: "error", note: e?.message || "Error" } : s)); }
    })()); });
    await Promise.all(jobs);
  }

  // Movimiento suave de la imagen protagonista: un clip de 10 s que se repite en cada aparición.
  async function animateHero() {
    if (!hero.image || hero.video) return;
    if (!await confirm({ title: "¿Animar la imagen protagonista?", description: "Se crea un clip de 10 s con movimiento muy suave (luz, nubes, destellos), aprox. 0.25 a 0.45 USD. Tarda de 1 a 4 minutos.", confirmLabel: "Animar" })) return;
    setHero(h => ({ ...h, status: "working", note: "" }));
    try {
      const image = await shrink(hero.image, 720, 1280, 270_000);
      const r = await fetch("/api/media/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, prompt: HERO_MOTION, duration: 10 }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo animar la imagen.");
      const file = await fetch(d.url); if (!file.ok) throw new Error("No se pudo descargar el clip.");
      const url = URL.createObjectURL(await file.blob());
      setHero(h => ({ image: h.image, video: url })); setOutput(null);
    } catch (e: any) { setHero(h => ({ ...h, status: "error", note: e?.message || "Error" })); }
  }

  async function makeVoice() {
    if (!script) return;
    setBusy("voice"); setError("");
    try {
      const r = await fetch("/api/media/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script.lines.join(" "), voice: voiceName }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "No se pudo generar la voz."); }
      const blob = await r.blob();
      const form = new FormData(); form.set("file", blob, "voz.wav");
      const t = await fetch("/api/media/transcribe", { method: "POST", body: form });
      const d = await t.json(); if (!t.ok) throw new Error(d.error || "No se pudieron sincronizar los subtítulos.");
      setVoice({ blob, url: URL.createObjectURL(blob), duration: d.duration || await audioDuration(blob), words: d.words || [] }); setOutput(null);
    } catch (e: any) { setError(e?.message || "No se pudo generar la voz."); } finally { setBusy(""); }
  }

  async function render() {
    if (!script || !voice) return;
    setBusy("render"); setError(""); setOutput(null); setProgress(0);
    try {
      const durations = sceneDurationsFromWords(script.lines, voice.words, voice.duration);
      const ready = supports.filter(s => s.image);
      const plan = mergeVisuals(visualPlan(script.lines.length, ready.length, look === "card"), durations);
      const heroImage = look === "card" ? card.image : hero.image;
      if (!heroImage) throw new Error(look === "card" ? "Falta la tarjeta. Créala antes de generar el video." : "Falta la imagen protagonista.");
      const scenes = plan.map(p => p.visual === "hero"
        ? { image: heroImage, video: look === "card" ? undefined : hero.video, caption: "", duration: p.duration }
        : { image: ready[p.visual].image as string, caption: "", duration: p.duration });
      const { blob, type } = await renderReel(scenes, { title: look === "card" ? "" : script.title, voice: voice.blob, subtitles: voice.words, subtitleStyle, transition: "dissolve", fade: 1.4, onPauseChange: setPaused }, setProgress);
      setOutput({ url: URL.createObjectURL(blob), type });
    } catch (e: any) { setError(e?.message || "No se pudo generar el video."); } finally { setBusy(""); }
  }

  const imagesReady = look === "card" ? Boolean(card.image) : Boolean(hero.image);
  const working = hero.status === "working" || card.status === "working" || supports.some(s => s.status === "working");
  const ready = Boolean(script && voice && imagesReady);
  const words = script ? script.lines.join(" ").split(/\s+/).filter(Boolean).length : 0;
  const extension = output?.type.includes("mp4") ? "mp4" : "webm";
  const coverImages = look === "card" ? [card.background || ""].filter(Boolean) : [hero.image || "", ...supports.map(s => s.image || "")].filter(Boolean);

  return <div className="reelGrid">
    <section className="calPanel">
      <div className="adsHead"><div><h2>Oración devocional</h2><p>Imagen realista que se mueve suave, voz serena y subtítulos grandes.</p></div></div>
      {error && <div className="quickNotice error"><AlertTriangle size={16} /><span>{error}</span></div>}

      <div className="storyStep"><span className="storyNum">1</span><div>
        <div className="field"><span>Tipo</span><div className="adsCountries" role="group" aria-label="Tipo"><button type="button" className={kind === "prayer" ? "active" : ""} aria-pressed={kind === "prayer"} onClick={() => setKind("prayer")}>Oración</button><button type="button" className={kind === "psalm" ? "active" : ""} aria-pressed={kind === "psalm"} onClick={() => setKind("psalm")}>Salmo</button></div></div>
        <label className="field"><span>Tema</span><textarea rows={2} value={topic} onChange={e => setTopic(e.target.value)} placeholder={kind === "psalm" ? "Ej.: Salmo 91 para la protección de la familia" : "Ej.: Oración a la Virgen del Carmen por los hijos"} /></label>
        <button type="button" className={script ? "uiBtn uiBtnSecondary" : "uiBtn uiBtnPrimary"} onClick={() => void writeScript()} disabled={!topic.trim() || !!busy}>{busy === "script" ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} {script ? "Reescribir" : kind === "psalm" ? "Escribir salmo" : "Escribir oración"}</button>
      </div></div>

      {script && <>
        <div className="storyStep"><span className="storyNum">2</span><div>
          {script.kind === "psalm" && <p className="storyWarn"><AlertTriangle size={14} /> Compara el salmo con tu Biblia antes de publicar: la IA puede cambiar palabras.</p>}
          <label className="field"><span>Título en pantalla</span><input value={script.title} maxLength={80} onChange={e => { setScript({ ...script, title: e.target.value }); setOutput(null); }} /></label>
          <ol className="storyScenes">{script.lines.map((line, i) => <li key={i}><div className="storyThumb">{i + 1}</div><div className="storySceneFields"><textarea rows={2} value={line} onChange={e => patchLine(i, e.target.value)} aria-label={`Parte ${i + 1}`} /></div></li>)}</ol>
          <span className="studioHint">{words} palabras · unos {Math.round(words / 2.3)} segundos de voz</span>
        </div></div>

        <div className="storyStep"><span className="storyNum">3</span><div>
          <div className="field"><span>Protagonista</span><div className="adsCountries" role="group" aria-label="Protagonista"><button type="button" className={look === "image" ? "active" : ""} aria-pressed={look === "image"} onClick={() => chooseLook("image")}><Sparkles size={14} /> Imagen devocional</button><button type="button" className={look === "card" ? "active" : ""} aria-pressed={look === "card"} onClick={() => chooseLook("card")}><ScrollText size={14} /> Tarjeta de oración</button></div></div>
          {look === "image" ? <>
            <label className="field"><span>Estilo</span><select value={style} onChange={e => { setStyle(e.target.value); setOutput(null); }}>{Object.entries(DEVOTIONAL_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <details><summary>Descripciones de las imágenes</summary>
              <label className="field"><span>Protagonista</span><textarea rows={3} value={script.hero} onChange={e => setScript({ ...script, hero: e.target.value })} /></label>
              {script.support.map((s, i) => <label className="field" key={i}><span>Apoyo {i + 1}</span><textarea rows={2} value={s} onChange={e => setScript({ ...script, support: script.support.map((x, k) => k === i ? e.target.value : x) })} /></label>)}
            </details>
            <div className="devotionalImages">
              {[{ m: hero, label: "Protagonista", i: -1 }, ...supports.map((m, i) => ({ m, label: `Apoyo ${i + 1}`, i }))].map(({ m, label, i }) => <figure key={label} className={m.status === "error" ? "flagged" : ""}>
                {m.image ? <img src={m.image} alt={label} /> : <div className="storyThumb">{m.status === "working" ? <Loader2 className="spin" size={18} /> : <ImagePlus size={18} />}</div>}
                <figcaption>{label}{i < 0 && m.video && <span className="studioChip ok"><Check size={12} /> Con movimiento</span>}{m.status === "error" && <span className="studioChip error" title={m.note}><AlertTriangle size={12} /> {m.note}</span>}</figcaption>
                {m.image && m.status !== "working" && <button type="button" className="uiIconBtn" title="Rehacer" aria-label={`Rehacer ${label}`} onClick={() => { if (i < 0) setHero({}); else setSupports(cur => cur.map((s, k) => k === i ? {} : s)); setOutput(null); }}><Trash2 size={14} /></button>}
              </figure>)}
            </div>
          </> : <div className="devotionalImages">
            <figure className={card.status === "error" ? "flagged" : ""}>
              {card.image ? <img src={card.image} alt="Tarjeta de oración" /> : <div className="storyThumb">{card.status === "working" ? <Loader2 className="spin" size={18} /> : <ScrollText size={18} />}</div>}
              <figcaption>Tarjeta{card.status === "error" && <span className="studioChip error" title={card.note}><AlertTriangle size={12} /> {card.note}</span>}</figcaption>
              {card.image && <button type="button" className="uiIconBtn" title="Otro fondo" aria-label="Crear otro fondo" onClick={() => { setCard({}); setOutput(null); }}><Trash2 size={14} /></button>}
            </figure>
            <label className="field"><span>Título de la tarjeta</span><input value={script.cardTitle} maxLength={60} onChange={e => setScript({ ...script, cardTitle: e.target.value })} /></label>
          </div>}
          <div className="reelToolbar">
            <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void makeImages()} disabled={!!busy || working || (look === "card" ? Boolean(card.background) : Boolean(hero.image) && supports.every(s => s.image))}><Sparkles size={16} /> {look === "card" ? "Crear tarjeta" : "Crear imágenes"}</button>
            {look === "image" && <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void animateHero()} disabled={!!busy || working || !hero.image || Boolean(hero.video)}><Video size={16} /> Dar movimiento <small>opcional</small></button>}
            {look === "image" && hero.video && <button type="button" className="linkButton" onClick={() => { setHero(h => ({ image: h.image })); setOutput(null); }}>Quitar movimiento</button>}
          </div>
        </div></div>

        <div className="storyStep"><span className="storyNum">4</span><div>
          <div className="reelToolbar"><select aria-label="Voz" value={voiceName} onChange={e => { setVoiceName(e.target.value); setVoice(null); }}>{VOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void makeVoice()} disabled={!!busy}>{busy === "voice" ? <Loader2 className="spin" size={16} /> : <Mic size={16} />} {voice ? "Rehacer voz" : "Generar voz y subtítulos"}</button>
            {voice && <audio src={voice.url} controls />}</div>
          {voice && <span className="studioHint"><Check size={13} /> {voice.words.length} palabras sincronizadas · {voice.duration.toFixed(1)} s</span>}
          <label className="field"><span>Subtítulos</span><select value={subtitleStyle} onChange={e => { setSubtitleStyle(e.target.value as SubtitleStyle); setOutput(null); }}>{SUBTITLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div></div>

        <div className="actionBar reelActions"><button type="button" className="uiBtn uiBtnPrimary" onClick={() => void render()} disabled={!ready || !!busy || working}>{busy === "render" ? <Loader2 className="spin" size={16} /> : <Clapperboard size={16} />} {busy === "render" ? paused ? "En pausa: regresa a esta pestaña" : `Generando… ${Math.round(progress * 100)}%` : "Generar video"}</button>{!ready && <span className="studioHint">Necesitas {look === "card" ? "la tarjeta" : "la imagen protagonista"} y la voz.</span>}</div>
      </>}
    </section>

    <section className="calPanel reelPreview">
      <div className="adsHead"><div><h2>Video</h2><p>Vertical 1080×1920 con voz y subtítulos.</p></div></div>
      {output ? <><video src={output.url} controls playsInline /><a className="uiBtn uiBtnPrimary" href={output.url} download={`oracion.${extension}`}><Download size={16} /> Descargar video</a></> : <div className="reelEmpty"><Clapperboard size={22} /><span>{busy === "render" ? "Grabando en tiempo real; deja esta pestaña visible…" : "Aquí aparecerá tu oración."}</span></div>}
      {script && coverImages.length > 0 && <details className="storyCover"><summary>Portada del reel</summary>
        <CoverMaker images={coverImages} text={script.cover || script.title} highlight={script.coverWord} badge={script.kind === "psalm" ? "Salmo" : "Oración"} aiPrompt={`${script.hero}. ${devotionalSuffix(style)}`} />
      </details>}
      {script?.caption && <div className="storyCaption"><span>Texto para la publicación</span><p>{script.caption}</p><button type="button" className="linkButton" onClick={() => void navigator.clipboard?.writeText(script.caption)}><Copy size={13} /> Copiar</button></div>}
      <p className="settingsHint">Marca el video como hecho con IA al publicarlo.</p>
    </section>
  </div>;
}
