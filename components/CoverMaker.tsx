"use client";

import { useEffect, useRef, useState } from "react";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/inter/700.css";
import { Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { renderCover, type CoverLayout } from "@/lib/coverRender";

type Props = { images: string[]; text: string; highlight?: string; badge?: string; aiPrompt?: string };
const LAYOUTS: Array<[CoverLayout, string]> = [["choque", "Choque"], ["impacto", "Impacto"], ["banda", "Banda"], ["titular", "Titular"]];
const EMOJIS = ["", "😱", "😭", "🙏", "🔥", "❤️", "✨"];
const ACCENTS = ["#ffd400", "#ff3b30", "#2ee6a6", "#ffffff"];

// Portada del reel: eliges fondo (una escena, una imagen nueva con IA o una tuya), texto, diseño y color.
export default function CoverMaker({ images, text, highlight = "", badge = "", aiPrompt }: Props) {
  const [background, setBackground] = useState(images[0] || "");
  const [extra, setExtra] = useState<string[]>([]);
  const [title, setTitle] = useState(text);
  const [word, setWord] = useState(highlight);
  const [label, setLabel] = useState(badge);
  const [layout, setLayout] = useState<CoverLayout>("choque");
  const [arrow, setArrow] = useState(true);
  const [circle, setCircle] = useState(false);
  const [emoji, setEmoji] = useState("😱");
  const [realistic, setRealistic] = useState(true);
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitle(text); setWord(highlight); }, [text, highlight]);
  useEffect(() => { setLabel(badge); }, [badge]);
  useEffect(() => { if (!background && images[0]) setBackground(images[0]); }, [images, background]);
  useEffect(() => {
    if (!background || !title.trim() || !canvas.current) { setPreview(""); return; }
    let active = true;
    renderCover(canvas.current, { image: background, text: title, highlight: word, badge: label, layout, accent, arrow, circle, emoji }).then(url => { if (active) setPreview(url); }).catch(e => { if (active) setError(e?.message || "No se pudo dibujar la portada."); });
    return () => { active = false; };
  }, [background, title, word, label, layout, accent, arrow, circle, emoji]);

  // Imagen pensada para portada: un primer plano emotivo funciona mejor que una escena general.
  async function makeAiBackground() {
    if (!aiPrompt) return;
    setBusy(true); setError("");
    try {
      // Realista: foto cinematográfica con emoción fuerte, lo que más se detiene a ver en la cuadrícula de Reels.
      const look = realistic
        ? "Photorealistic cinematic film still, real people with natural skin and detailed faces, intense emotional expression, medium close-up, dramatic rim light and volumetric light, vivid teal-and-orange color grading, high contrast, shallow depth of field, viral video thumbnail composition"
        : "Dramatic emotional close-up in the same illustration style, strong expression, high contrast, bold saturated colors, cinematic rim light";
      const r = await fetch("/api/media/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${aiPrompt.replace(/,? ?(2D cartoon comic illustration|realistic cinematic digital painting|Japanese anime film still|watercolor storybook illustration)[^.]*\./i, ".")} ${look}, subject centered in the middle of the frame, vertical 9:16, no text, no letters, no watermark.` }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo crear la imagen.");
      setExtra(cur => [d.image, ...cur]); setBackground(d.image);
    } catch (e: any) { setError(e?.message || "No se pudo crear la imagen."); } finally { setBusy(false); }
  }
  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0]; event.target.value = ""; if (!f) return;
    const reader = new FileReader(); reader.onload = () => { const url = String(reader.result || ""); setExtra(cur => [url, ...cur]); setBackground(url); }; reader.readAsDataURL(f);
  }
  function download() {
    if (!preview) return;
    const a = document.createElement("a"); a.href = preview; a.download = `portada-${title.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "reel"}.jpg`; a.click();
  }

  const options = [...extra, ...images.filter(Boolean)];
  return <div className="coverMaker">
    <div className="coverControls">
      <label className="field"><span>Texto de portada <small>2 a 6 palabras</small></span><input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder="LE QUEDABAN 3 DÍAS" /></label>
      <div className="fieldRow">
        <label className="field"><span>Palabra en color</span><input value={word} maxLength={30} onChange={e => setWord(e.target.value)} placeholder="3 DÍAS" /></label>
        <label className="field"><span>Etiqueta</span><input value={label} maxLength={24} onChange={e => setLabel(e.target.value)} placeholder="HISTORIA REAL" /></label>
      </div>
      <div className="field"><span>Diseño</span><div className="segmented" role="group" aria-label="Diseño">{LAYOUTS.map(([id, name]) => <button type="button" key={id} className={layout === id ? "active" : ""} onClick={() => setLayout(id)}>{name}</button>)}</div></div>
      <div className="field"><span>Elementos</span><div className="coverToggles">
        <label><input type="checkbox" checked={arrow} onChange={e => setArrow(e.target.checked)} /> Flecha</label>
        <label><input type="checkbox" checked={circle} onChange={e => setCircle(e.target.checked)} /> Círculo</label>
        <select aria-label="Emoji" value={emoji} onChange={e => setEmoji(e.target.value)}>{EMOJIS.map(x => <option key={x || "none"} value={x}>{x || "Sin emoji"}</option>)}</select>
      </div></div>
      <div className="field"><span>Color</span><div className="coverSwatches">{ACCENTS.map(c => <button type="button" key={c} className={accent === c ? "active" : ""} style={{ background: c }} onClick={() => setAccent(c)} aria-label={`Color ${c}`} />)}</div></div>
      <div className="field"><span>Fondo</span>
        <div className="coverThumbs">{options.map((src, i) => <button type="button" key={`${i}-${src.slice(-24)}`} className={background === src ? "active" : ""} onClick={() => setBackground(src)} aria-label={`Fondo ${i + 1}`}><img src={src} alt="" /></button>)}</div>
        <div className="reelToolbar">
          {aiPrompt && <label className="coverToggles"><input type="checkbox" checked={realistic} onChange={e => setRealistic(e.target.checked)} /> Foto realista</label>}
          {aiPrompt && <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void makeAiBackground()} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Imagen para portada con IA</button>}
          <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
          <button type="button" className="linkButton" onClick={() => upload.current?.click()}><ImagePlus size={14} /> Subir mía</button>
        </div>
      </div>
      {error && <p className="storyWarn">{error}</p>}
    </div>
    <div className="coverPreview">
      <canvas ref={canvas} hidden />
      {preview ? <img src={preview} alt="Vista previa de la portada" /> : <div className="reelEmpty"><ImagePlus size={20} /><span>Elige un fondo y escribe el texto.</span></div>}
      <button type="button" className="uiBtn uiBtnPrimary" onClick={download} disabled={!preview}><Download size={16} /> Descargar portada</button>
    </div>
  </div>;
}
