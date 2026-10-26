"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clapperboard, Copy, Download, FileText, ImagePlus, Loader2, Mic, Sparkles, Trash2, UserRound, Video } from "lucide-react";
import { renderReel, type ReelTransition } from "@/lib/reelRender";
import { FICTION_BADGE, QUOTES_SCRIPTURE, STORY_KINDS, STORY_STYLES, castInScene, healingClaims, narrationOf, sceneDurationsFromWords, styleSuffix, type StoryKind, type StoryScript, type TimedWord } from "@/lib/storyScript";
import { useConfirm } from "@/components/ui/DialogProvider";
import CoverMaker from "@/components/CoverMaker";

type SceneMedia = { image?: string; video?: string; status?: "working" | "error"; note?: string };
const VOICES: Array<[string, string]> = [["Charon", "Charon · hombre, documental"], ["Orus", "Orus · hombre, firme"], ["Puck", "Puck · hombre, animado"], ["Kore", "Kore · mujer, clara"], ["Aoede", "Aoede · mujer, cálida"], ["Leda", "Leda · mujer, joven"]];

// Etiqueta de la portada según el tipo de historia (los relatos de ficción siempre lo dicen).
const COVER_BADGE: Record<StoryKind, string> = { real: "Historia real", fiction: "Relato inspirador", bible: "Historia bíblica", psalm: "Salmo", prayer: "Oración" };
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) { const queue = [...items]; await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => { while (queue.length) await task(queue.shift() as T); })); }
async function shrink(dataUrl: string, w: number, h: number, maxLength: number) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("No se pudo leer la imagen.")); i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); if (!ctx) throw new Error("No se pudo procesar la imagen.");
  const ratio = Math.max(w / img.width, h / img.height); ctx.drawImage(img, (w - img.width * ratio) / 2, (h - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  for (let q = .85; q >= .45; q -= .08) { const out = c.toDataURL("image/jpeg", q); if (out.length < maxLength) return out; }
  return c.toDataURL("image/jpeg", .4);
}
const audioDuration = (blob: Blob) => new Promise<number>(resolve => { const a = new Audio(); a.onloadedmetadata = () => resolve(a.duration || 0); a.onerror = () => resolve(0); a.src = URL.createObjectURL(blob); });

export default function StoryStudio() {
  const confirm = useConfirm();
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<StoryKind>("real");
  const [transition, setTransition] = useState<ReelTransition>("dissolve");
  const [sceneCount, setSceneCount] = useState(8);
  const [style, setStyle] = useState("cartoon");
  const [voiceName, setVoiceName] = useState("Charon");
  const [script, setScript] = useState<StoryScript | null>(null);
  const [media, setMedia] = useState<SceneMedia[]>([]);
  const [character, setCharacter] = useState("");
  const [voice, setVoice] = useState<{ blob: Blob; url: string; duration: number; words: TimedWord[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [output, setOutput] = useState<{ url: string; type: string } | null>(null);

  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => { if (voice) URL.revokeObjectURL(voice.url); }, [voice]);

  const resetOutputs = () => { setOutput(null); };
  function patchScene(i: number, patch: Partial<StoryScript["scenes"][number]>) {
    setScript(cur => cur ? { ...cur, scenes: cur.scenes.map((s, k) => k === i ? { ...s, ...patch } : s) } : cur);
    if (patch.text !== undefined) setVoice(null);
    resetOutputs();
  }

  async function writeScript() {
    if (!topic.trim()) return;
    setBusy("script"); setError(""); setOutput(null);
    try {
      const r = await fetch("/api/story/script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, scenes: sceneCount, kind }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo escribir el guion.");
      setScript(d); setMedia(d.scenes.map(() => ({}))); setVoice(null); setCharacter("");
    } catch (e: any) { setError(e?.message || "No se pudo escribir el guion."); } finally { setBusy(""); }
  }

  async function makeCharacter() {
    if (!script?.character) return;
    setBusy("character"); setError("");
    try {
      const r = await fetch("/api/media/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Character reference, full body, neutral pose, plain light background: ${script.character}. ${styleSuffix(style)}` }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo crear el personaje.");
      setCharacter(d.image);
    } catch (e: any) { setError(e?.message || "No se pudo crear el personaje."); } finally { setBusy(""); }
  }

  async function makeScene(i: number, reference: string) {
    if (!script) return;
    const scene = script.scenes[i];
    setMedia(cur => cur.map((m, k) => k === i ? { ...m, status: "working", note: "" } : m));
    try {
      const who = script.character ? ` The main character always looks the same: ${script.character}.` : "";
      // Cada personaje que aparece en la escena se describe (un perro llamado Tomás debe seguir siendo un perro).
      const present = castInScene(script, scene);
      const cast = present.length ? ` Characters in this scene: ${present.map(c => `${c.name} is ${c.look}`).join("; ")}.` : "";
      // En las escenas marcadas, el santo se dibuja con su iconografía tradicional.
      const saint = scene.showsSaint && script.saint ? ` The saint appears in this scene, recognizable by the traditional iconography: ${script.saint}. Respectful, luminous, devotional depiction.` : "";
      const prompt = `${reference ? "Use the character from the reference image exactly (same face, hair and clothes). " : ""}${scene.image}${cast}${who}${saint} ${styleSuffix(style)}`;
      const r = await fetch("/api/media/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, reference: reference || undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo crear la ilustración.");
      setMedia(cur => cur.map((m, k) => k === i ? { image: d.image } : m));
    } catch (e: any) { setMedia(cur => cur.map((m, k) => k === i ? { ...m, status: "error", note: e?.message || "Error" } : m)); }
  }

  async function makeScenes() {
    if (!script) return;
    const pending = script.scenes.map((_, i) => i).filter(i => !media[i]?.image);
    if (!pending.length) return;
    if (!await confirm({ title: `¿Crear ${pending.length} ilustraciones?`, description: `Se usará Cheaper Inference (aprox. 0.02 a 0.08 USD por imagen).${character ? " Se usará tu personaje como referencia para que salga igual en todas." : ""}`, confirmLabel: "Crear ilustraciones" })) return;
    setError(""); setOutput(null);
    const reference = character ? await shrink(character, 768, 1152, 600_000) : "";
    await pool(pending, 3, i => makeScene(i, reference));
  }

  async function animateScene(i: number) {
    if (!script || !media[i]?.image) return;
    setMedia(cur => cur.map((m, k) => k === i ? { ...m, status: "working", note: "" } : m));
    try {
      const image = await shrink(media[i].image as string, 720, 1280, 270_000);
      const r = await fetch("/api/media/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, prompt: `${script.scenes[i].motion || "Slow push-in camera movement."} Subtle, smooth animation of this illustration, keep exactly the same art style and character, consistent details, no text.`, duration: 5 }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo animar la escena.");
      const file = await fetch(d.url); const url = URL.createObjectURL(await file.blob());
      setMedia(cur => cur.map((m, k) => k === i ? { ...m, video: url, status: undefined } : m)); setOutput(null);
    } catch (e: any) { setMedia(cur => cur.map((m, k) => k === i ? { ...m, status: "error", note: e?.message || "Error" } : m)); }
  }
  async function animateAll() {
    const pending = media.map((m, i) => ({ m, i })).filter(x => x.m.image && !x.m.video).map(x => x.i);
    if (!pending.length) return;
    if (!await confirm({ title: `¿Animar ${pending.length} escenas con IA?`, description: `Cada ilustración se convierte en un clip de 5 s con movimiento (aprox. 0.15 a 0.21 USD por clip, ${(pending.length * .21).toFixed(2)} USD como máximo). Tarda de 1 a 4 minutos por clip; se hacen 3 a la vez.`, confirmLabel: "Animar escenas" })) return;
    await pool(pending, 3, animateScene);
  }

  async function makeVoice() {
    if (!script) return;
    setBusy("voice"); setError("");
    try {
      const r = await fetch("/api/media/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: narrationOf(script.scenes), voice: voiceName }) });
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
      const durations = sceneDurationsFromWords(script.scenes.map(s => s.text), voice.words, voice.duration);
      const scenes = script.scenes.map((s, i) => ({ image: media[i]?.image || "", video: media[i]?.video, caption: "", duration: durations[i] }));
      if (scenes.some(s => !s.image)) throw new Error("Faltan ilustraciones. Créalas antes de generar el video.");
      const { blob, type } = await renderReel(scenes, { title: script.title, voice: voice.blob, subtitles: voice.words, badge: scriptKind === "fiction" ? FICTION_BADGE : undefined, transition, onPauseChange: setPaused }, setProgress);
      setOutput({ url: URL.createObjectURL(blob), type });
    } catch (e: any) { setError(e?.message || "No se pudo generar el video."); } finally { setBusy(""); }
  }

  // El tipo con el que se escribió el guion (no el seleccionado ahora) decide el aviso del video.
  const scriptKind: StoryKind = (script as (StoryScript & { kind?: StoryKind }) | null)?.kind || "real";
  const flagged = script && (scriptKind === "fiction" || scriptKind === "prayer") ? healingClaims(script) : [];
  const ready = Boolean(script && voice && media.length && media.every(m => m.image));
  const words = script ? narrationOf(script.scenes).split(/\s+/).filter(Boolean).length : 0;
  const extension = output?.type.includes("mp4") ? "mp4" : "webm";

  return <div className="reelGrid">
    <section className="calPanel">
      <div className="adsHead"><div><h2>Historia narrada</h2><p>Tema → guion → ilustraciones → voz → subtítulos sincronizados → video.</p></div></div>
      {error && <div className="quickNotice error"><AlertTriangle size={16} /><span>{error}</span></div>}

      <div className="storyStep"><span className="storyNum">1</span><div>
        <div className="field"><span>Tipo</span><div className="adsCountries" role="group" aria-label="Tipo de historia">{STORY_KINDS.map(k => <button type="button" key={k.id} className={kind === k.id ? "active" : ""} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}</div></div>
        {kind === "fiction" && <p className="storyWarn storyInfo">Personajes inventados. El video muestra «{FICTION_BADGE}» todo el tiempo, la narración lo dice al inicio y el caption lo aclara. No promete curaciones.</p>}
        <label className="field"><span>Tema de la historia</span><textarea rows={2} value={topic} onChange={e => setTopic(e.target.value)} placeholder={STORY_KINDS.find(k => k.id === kind)?.placeholder} /></label>
        <div className="fieldRow">
          <label className="field"><span>Estilo</span><select value={style} onChange={e => { setStyle(e.target.value); setOutput(null); }}>{Object.entries(STORY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="field"><span>Escenas</span><select value={sceneCount} onChange={e => setSceneCount(Number(e.target.value))}>{[6, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <button type="button" className={script ? "uiBtn uiBtnSecondary" : "uiBtn uiBtnPrimary"} onClick={() => void writeScript()} disabled={!topic.trim() || !!busy}>{busy === "script" ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} {script ? "Reescribir guion" : "Escribir guion"}</button>
      </div></div>

      {script && <>
        <div className="storyStep"><span className="storyNum">2</span><div>
          {scriptKind === "fiction" ? <p className="storyWarn storyInfo">{FICTION_BADGE}: personajes y hechos inventados con fines inspiradores.</p> : QUOTES_SCRIPTURE.includes(scriptKind) ? <p className="storyWarn"><AlertTriangle size={14} /> Compara el texto bíblico con tu Biblia antes de publicar: la IA puede cambiar palabras.</p> : scriptKind === "prayer" ? null : <p className="storyWarn"><AlertTriangle size={14} /> Revisa los datos antes de publicar: la IA puede equivocarse en detalles.</p>}
          {flagged.length > 0 && <p className="storyWarn"><AlertTriangle size={14} /> Revisa {flagged.length === 1 ? "la escena" : "las escenas"} {flagged.map(i => i + 1).join(", ")}: suena a promesa de curación. Cámbiala por fuerza, paz o atención médica.</p>}
          <label className="field"><span>Título en pantalla</span><input value={script.title} maxLength={80} onChange={e => { setScript({ ...script, title: e.target.value }); setOutput(null); }} /></label>
          <ol className="storyScenes">{script.scenes.map((s, i) => <li key={i} className={media[i]?.status === "error" || flagged.includes(i) ? "flagged" : ""}>
            {media[i]?.image ? <img src={media[i].image} alt={`Escena ${i + 1}`} /> : <div className="storyThumb">{media[i]?.status === "working" ? <Loader2 className="spin" size={18} /> : i + 1}</div>}
            <div className="storySceneFields">
              <textarea rows={2} value={s.text} onChange={e => patchScene(i, { text: e.target.value })} aria-label={`Narración escena ${i + 1}`} />
              {script.saint && <label className="storySaintToggle"><input type="checkbox" checked={Boolean(s.showsSaint)} onChange={e => patchScene(i, { showsSaint: e.target.checked })} /> Aparece el santo</label>}
              <details><summary>Ilustración y movimiento</summary><textarea rows={3} value={s.image} onChange={e => patchScene(i, { image: e.target.value })} aria-label="Descripción de la ilustración" /><input value={s.motion} onChange={e => patchScene(i, { motion: e.target.value })} aria-label="Movimiento de cámara" /></details>
              {media[i]?.video ? <span className="studioChip ok"><Check size={12} /> Animada</span> : media[i]?.status === "working" ? <span className="studioChip"><Loader2 className="spin" size={12} /> Trabajando…</span> : media[i]?.status === "error" ? <span className="studioChip error" title={media[i].note}><AlertTriangle size={12} /> {media[i].note}</span> : null}
            </div>
            <div className="reelSceneActions">
              <button type="button" className="uiIconBtn" title="Rehacer ilustración" aria-label="Rehacer ilustración" disabled={media[i]?.status === "working"} onClick={async () => { setMedia(cur => cur.map((m, k) => k === i ? {} : m)); void makeScene(i, character ? await shrink(character, 768, 1152, 600_000) : ""); }}><ImagePlus size={15} /></button>
              {media[i]?.image && !media[i]?.video && <button type="button" className="uiIconBtn" title="Animar con IA" aria-label="Animar con IA" disabled={media[i]?.status === "working"} onClick={() => void animateScene(i)}><Video size={15} /></button>}
              {media[i]?.video && <button type="button" className="uiIconBtn" title="Quitar animación" aria-label="Quitar animación" onClick={() => { setMedia(cur => cur.map((m, k) => k === i ? { image: m.image } : m)); setOutput(null); }}><Trash2 size={15} /></button>}
            </div>
          </li>)}</ol>
          <span className="studioHint">{words} palabras · unos {Math.round(words / 2.6)} segundos de narración</span>
        </div></div>

        <div className="storyStep"><span className="storyNum">3</span><div>
          {script.saint !== undefined && script.saint !== "" && <label className="field"><span>Santo <small>iconografía en inglés; aparece en las escenas marcadas</small></span><textarea rows={2} value={script.saint} onChange={e => { setScript({ ...script, saint: e.target.value }); setOutput(null); }} /></label>}
          {script.character && <div className="storyCharacter">{character ? <img src={character} alt="Personaje" /> : <div className="storyThumb"><UserRound size={20} /></div>}<div><strong>Personaje</strong><p>{script.character}</p><button type="button" className="linkButton" onClick={() => void makeCharacter()} disabled={!!busy}>{busy === "character" ? "Creando…" : character ? "Rehacer personaje" : "Crear personaje de referencia"}</button></div></div>}
          <div className="reelToolbar">
            <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void makeScenes()} disabled={!!busy || media.some(m => m.status === "working") || media.every(m => m.image)}><Sparkles size={16} /> Crear ilustraciones</button>
            <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void animateAll()} disabled={!!busy || media.some(m => m.status === "working") || !media.some(m => m.image && !m.video)}><Video size={16} /> Animar con IA <small>opcional</small></button>
          </div>
        </div></div>

        <div className="storyStep"><span className="storyNum">4</span><div>
          <div className="reelToolbar"><select aria-label="Voz" value={voiceName} onChange={e => { setVoiceName(e.target.value); setVoice(null); }}>{VOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void makeVoice()} disabled={!!busy}>{busy === "voice" ? <Loader2 className="spin" size={16} /> : <Mic size={16} />} {voice ? "Rehacer voz y subtítulos" : "Generar voz y subtítulos"}</button>
            {voice && <audio src={voice.url} controls />}</div>
          {voice && <span className="studioHint"><Check size={13} /> {voice.words.length} palabras sincronizadas · {voice.duration.toFixed(1)} s</span>}
        </div></div>

        <div className="storyStep"><span className="storyNum">5</span><div><label className="field"><span>Transición</span><select value={transition} onChange={e => { setTransition(e.target.value as ReelTransition); setOutput(null); }}><option value="dissolve">Disolución suave (recomendada)</option><option value="black">Fundido a negro (dramática)</option><option value="cut">Corte directo</option></select></label></div></div>
        <div className="actionBar reelActions"><button type="button" className="uiBtn uiBtnPrimary" onClick={() => void render()} disabled={!ready || !!busy}>{busy === "render" ? <Loader2 className="spin" size={16} /> : <Clapperboard size={16} />} {busy === "render" ? paused ? "En pausa: regresa a esta pestaña" : `Generando… ${Math.round(progress * 100)}%` : "Generar video"}</button>{!ready && <span className="studioHint">Necesitas las ilustraciones y la voz.</span>}</div>
      </>}
    </section>

    <section className="calPanel reelPreview">
      <div className="adsHead"><div><h2>Video</h2><p>Vertical 1080×1920 con título, voz y subtítulos.</p></div></div>
      {output ? <><video src={output.url} controls playsInline /><a className="uiBtn uiBtnPrimary" href={output.url} download={`historia.${extension}`}><Download size={16} /> Descargar video</a></> : <div className="reelEmpty"><Clapperboard size={22} /><span>{busy === "render" ? "Grabando en tiempo real; deja esta pestaña visible…" : "Aquí aparecerá tu historia."}</span></div>}
      {script && media.some(m => m.image) && <details className="storyCover" open><summary>Portada del reel</summary>
        <CoverMaker images={media.map(m => m.image || "").filter(Boolean)} text={script.cover || script.title} highlight={script.coverWord} badge={COVER_BADGE[scriptKind]} aiPrompt={`${script.scenes[0]?.image || script.title}${script.character ? ` Main character: ${script.character}.` : ""}${script.saint ? ` ${script.saint}.` : ""} ${styleSuffix(style)}`} />
      </details>}
      {script?.caption && <div className="storyCaption"><span>Texto para la publicación</span><p>{script.caption}</p><button type="button" className="linkButton" onClick={() => void navigator.clipboard?.writeText(script.caption)}><Copy size={13} /> Copiar</button></div>}
      <p className="settingsHint">Agrega música de suspenso al subirlo y marca el video como hecho con IA.</p>
    </section>
  </div>;
}
