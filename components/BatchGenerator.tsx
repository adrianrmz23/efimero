"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, FileSpreadsheet, Images, Layers, Loader2, Sparkles, Trash2 } from "lucide-react";
import { usePages } from "@/lib/pagesContext";
import { supabase } from "@/lib/supabase";
import type { SheetRow } from "@/lib/spreadsheetImport";

type Provider = { id: "cheaperinference" | "claudeapi"; label: string; model: string; ready: boolean };
type Preset = { id: string; label: string; page: string; template: "minimal" | "photo"; max: number };
type Row = { titulo: string; texto: string; caption: string };
type Props = { onSendToStudio: (rows: SheetRow[], template: "minimal" | "photo", source: string) => void };
const PROVIDER_KEY = "efimero:batch:provider";

function saveFile(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
const csvOf = (rows: Row[]) => "﻿" + [["titulo", "texto", "caption"], ...rows.map(r => [r.titulo, r.texto, r.caption])].map(r => r.map(v => `"${v.replace(/"/g, '""').replace(/\r?\n/g, "\r\n")}"`).join(",")).join("\r\n");

export default function BatchGenerator({ onSendToStudio }: Props) {
  const { pages, activePageId } = usePages();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [provider, setProvider] = useState<Provider["id"]>("cheaperinference");
  const [presetId, setPresetId] = useState("efimero-frases");
  const [count, setCount] = useState(50);
  const [themes, setThemes] = useState("");
  const [pageId, setPageId] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<Array<Row & { reason: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const preset = presets.find(p => p.id === presetId);

  useEffect(() => {
    fetch("/api/content/batch", { cache: "no-store" }).then(r => r.json()).then(d => {
      setProviders(d.providers || []); setPresets(d.presets || []);
      let saved = ""; try { saved = localStorage.getItem(PROVIDER_KEY) || ""; } catch { /* Sin almacenamiento local. */ }
      const list: Provider[] = d.providers || [];
      setProvider((list.find(p => p.id === saved && p.ready) || list.find(p => p.ready) || list[0])?.id || "cheaperinference");
    }).catch(() => setError("No se pudo cargar la configuración del generador."));
  }, []);
  useEffect(() => { if (!pageId && activePageId) setPageId(activePageId); }, [activePageId, pageId]);
  // Lo ya programado en la página (6 meses) para no repetir contenido.
  useEffect(() => {
    if (!supabase || !pageId) { setHistory([]); return; }
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    void supabase.from("efimero_scheduled_posts").select("compliance_data").eq("page_id", pageId).not("compliance_data", "is", null).gte("publish_at", since).limit(2000)
      .then(({ data }) => setHistory((data || []).map((x: any) => String(x.compliance_data?.embedded_text || "")).filter(Boolean)));
  }, [pageId]);
  useEffect(() => { if (preset && count > preset.max) setCount(preset.max); }, [preset, count]);

  function chooseProvider(id: Provider["id"]) { setProvider(id); try { localStorage.setItem(PROVIDER_KEY, id); } catch { /* Sin almacenamiento local. */ } }

  async function generate(append: boolean) {
    setBusy(true); setError(""); setNotice("");
    try {
      const existing = [...history, ...(append ? rows.map(r => r.texto) : [])];
      const r = await fetch("/api/content/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: presetId, provider, count, themes, existing }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo generar el lote.");
      const next: Row[] = append ? [...rows, ...d.rows] : d.rows;
      setRows(next); setRejected(append ? [...rejected, ...(d.rejected || [])] : d.rejected || []);
      const discarded = (d.rejected || []).length;
      setNotice(`${d.rows.length} piezas nuevas${discarded ? ` · ${discarded} descartadas (repetidas o sin pasar Compliance)` : ""}${d.errors?.length ? ` · ${d.errors.length} tandas fallaron` : ""}.`);
    } catch (e: any) { setError(e?.message || "No se pudo generar el lote."); } finally { setBusy(false); }
  }

  const patch = (i: number, p: Partial<Row>) => setRows(cur => cur.map((r, k) => k === i ? { ...r, ...p } : r));
  const providerInfo = providers.find(p => p.id === provider);
  const reasons = useMemo(() => rejected.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] || 0) + 1 }), {}), [rejected]);

  return <div className="reelStudio">
    <div className="pageIntro"><div><span className="overline">ESTUDIO</span><h1>Generador de lotes</h1><p>Crea con IA las filas para el Estudio creativo (título, texto y caption) con el estilo de cada página. Sin repetidas y revisadas por Compliance.</p></div></div>
    {error && <div className="quickNotice error"><AlertTriangle size={16} /><span>{error}</span></div>}
    <div className="reelGrid">
      <section className="calPanel">
        <div className="field"><span>Tipo de contenido</span><div className="adsCountries">{presets.map(p => <button type="button" key={p.id} className={presetId === p.id ? "active" : ""} aria-pressed={presetId === p.id} onClick={() => { setPresetId(p.id); setRows([]); setRejected([]); }}>{p.label}</button>)}</div></div>
        <div className="fieldRow">
          <label className="field"><span>Cantidad</span><select value={count} onChange={e => setCount(Number(e.target.value))}>{[10, 20, 30, 50, 60, 100].filter(n => !preset || n <= preset.max).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="field"><span>Página <small>para no repetir lo ya programado</small></span><select value={pageId} onChange={e => setPageId(e.target.value)}><option value="">Sin revisar historial</option>{pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        </div>
        <label className="field"><span>Temas o enfoque <small>opcional</small></span><input value={themes} maxLength={400} onChange={e => setThemes(e.target.value)} placeholder={preset?.template === "photo" ? "familia, trabajo, salud, San Judas, noche…" : "desamor, motivación, humor de lunes…"} /></label>
        <div className="field"><span>Generar con</span><div className="segmented" role="group" aria-label="Proveedor">{providers.map(p => <button type="button" key={p.id} className={provider === p.id ? "active" : ""} disabled={!p.ready} title={p.ready ? p.model : "Falta configurarlo en las variables de entorno"} onClick={() => chooseProvider(p.id)}>{p.label}</button>)}</div>
          {providerInfo && <small className="studioHint">{providerInfo.ready ? `Modelo: ${providerInfo.model}` : "No configurado: agrega sus variables en Vercel (ver .env.example)."}</small>}</div>
        <div className="reelToolbar">
          <button type="button" className="uiBtn uiBtnPrimary" onClick={() => void generate(false)} disabled={busy || !providerInfo?.ready}>{busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {busy ? "Generando… (hasta 2 min)" : `Generar ${count}`}</button>
          {!!rows.length && <button type="button" className="uiBtn uiBtnSecondary" onClick={() => void generate(true)} disabled={busy || !providerInfo?.ready}><Layers size={16} /> Agregar {count} más</button>}
        </div>
        {notice && <div className="quickNotice"><Check size={16} /><span>{notice}</span></div>}
        {!!rejected.length && <p className="studioHint">Descartadas: {Object.entries(reasons).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")}</p>}
      </section>

      <section className="calPanel reelPreview">
        <div className="adsHead"><div><h2>{rows.length ? `${rows.length} piezas` : "Piezas"}</h2><p>Edita o quita lo que no te guste antes de enviarlas.</p></div></div>
        {rows.length ? <ol className="batchRows">{rows.map((r, i) => <li key={i}>
          <span className="studioRowIndex">{i + 1}</span>
          <div className="storySceneFields">
            {(r.titulo || preset?.template === "photo") && <input value={r.titulo} placeholder="Título" onChange={e => patch(i, { titulo: e.target.value })} aria-label={`Título ${i + 1}`} />}
            <textarea rows={Math.min(8, Math.max(2, r.texto.split("\n").length))} value={r.texto} onChange={e => patch(i, { texto: e.target.value })} aria-label={`Texto ${i + 1}`} />
            <input value={r.caption} placeholder="Caption (opcional)" onChange={e => patch(i, { caption: e.target.value })} aria-label={`Caption ${i + 1}`} />
          </div>
          <button type="button" className="uiIconBtn" onClick={() => setRows(cur => cur.filter((_, k) => k !== i))} aria-label={`Quitar ${i + 1}`}><Trash2 size={15} /></button>
        </li>)}</ol> : <div className="reelEmpty"><FileSpreadsheet size={22} /><span>{busy ? "Escribiendo en tandas…" : "Aquí aparecerán las piezas generadas."}</span></div>}
        {!!rows.length && <div className="reelToolbar">
          <button type="button" className="uiBtn uiBtnPrimary" onClick={() => onSendToStudio(rows.slice(0, 100).map(r => ({ title: r.titulo, body: r.texto, caption: r.caption })), preset?.template || "minimal", `Generador · ${preset?.label || "lote"}`)}><Images size={16} /> Enviar al Estudio creativo</button>
          <button type="button" className="uiBtn uiBtnSecondary" onClick={() => saveFile(new Blob([csvOf(rows)], { type: "text/csv;charset=utf-8" }), `${presetId}-${rows.length}.csv`)}><Download size={16} /> Descargar CSV</button>
        </div>}
        {preset?.template === "photo" && !!rows.length && <p className="settingsHint">Se abrirán con la plantilla «Oración con fondo». Elige la página Ecos de la Fe en el Estudio para usar sus fondos.</p>}
      </section>
    </div>
  </div>;
}
