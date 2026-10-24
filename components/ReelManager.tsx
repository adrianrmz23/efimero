"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckSquare2, Download, ExternalLink, Film, Loader2, RefreshCw, Square, Trash2, Video } from "lucide-react";
import { usePages } from "@/lib/pagesContext";

type Reel = { id: string; message: string; createdTime?: string | null; permalinkUrl: string; thumbnail?: string; confirmed: boolean };

function pretty(value?: string | null) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function ReelManager() {
  const { pages, activePageId: pageId, setActivePage } = usePages();
  const [reels, setReels] = useState<Reel[]>([]);
  const [ambiguous, setAmbiguous] = useState<Reel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [days, setDays] = useState("90");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [after, setAfter] = useState("");
  const [scanned, setScanned] = useState(0);
  const page = pages.find(x => x.id === pageId);
  const sorted = useMemo(() => [...reels].sort((a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime()), [reels]);

  useEffect(() => { if (pageId) void load(true); }, [pageId, days]);

  async function load(reset = false) {
    if (!pageId) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const cursor = reset ? "" : after;
      const q = new URLSearchParams({ pageId, days, scanPages: "5" });
      if (cursor) q.set("after", cursor);
      const r = await fetch(`/api/meta/reels?${q}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No fue posible consultar los Reels.");
      setReels(current => {
        const base = reset ? [] : current;
        const map = new Map(base.map(x => [x.id, x]));
        for (const item of d.reels || []) map.set(item.id, item);
        return [...map.values()];
      });
      setAmbiguous(current => {
        const base = reset ? [] : current;
        const map = new Map(base.map(x => [x.id, x]));
        for (const item of d.ambiguousVideos || []) map.set(item.id, item);
        return [...map.values()];
      });
      setScanned(current => reset ? Number(d.scannedPosts || 0) : current + Number(d.scannedPosts || 0));
      setAfter(String(d.nextAfter || ""));
      if (reset) setSelected(new Set());
    } catch (e: any) { setError(e?.message || "No fue posible consultar los Reels."); }
    finally { setLoading(false); }
  }

  function toggle(id: string) { setSelected(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAll() { setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map(x => x.id))); }

  function exportCsv() {
    const rows = [["id", "fecha", "texto", "url"], ...sorted.map(item => [item.id, item.createdTime || "", item.message, item.permalinkUrl])];
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reels-${page?.name || "facebook"}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length || !pageId) return;
    const answer = window.prompt(`Vas a eliminar ${ids.length} Reel${ids.length === 1 ? "" : "s"} de Facebook. Esta acción no se puede deshacer.\n\nEscribe ELIMINAR para continuar.`);
    if (answer !== "ELIMINAR") return;
    setDeleting(true); setError(""); setNotice("");
    const deleted: string[] = []; const failures: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const r = await fetch("/api/meta/reels", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, postIds: batch }) });
        const d = await r.json();
        for (const result of d.results || []) result.ok ? deleted.push(String(result.id)) : failures.push(`${result.id}: ${result.error || "Error"}`);
        if (!r.ok && !(d.deleted > 0)) throw new Error(d.error || failures[0] || "Meta rechazó la eliminación.");
      }
      setReels(current => current.filter(item => !deleted.includes(item.id)));
      setSelected(new Set());
      setNotice(`${deleted.length} Reel${deleted.length === 1 ? "" : "s"} eliminado${deleted.length === 1 ? "" : "s"} de Facebook${failures.length ? ` · ${failures.length} no se pudieron eliminar` : ""}.`);
      if (failures.length) setError(failures.slice(0, 3).join(" · "));
    } catch (e: any) { setError(e?.message || "No fue posible completar el borrado."); }
    finally { setDeleting(false); }
  }

  const periods: Array<[string, string]> = [["30", "30 días"], ["90", "90 días"], ["365", "1 año"], ["0", "Todo"]];
  const allSelected = !!sorted.length && selected.size === sorted.length;

  return <div className="studioPage">
    <div className="pageIntro"><div><span className="overline">GESTOR DE REELS</span><h1>Gestor de Reels</h1><p>Revisa los Reels de tu página y elimínalos en bloque. Solo se pueden seleccionar los elementos que Efímero confirma como Reel.</p></div><div className="studioHeaderActions"><button className="uiBtn uiBtnGhost" onClick={exportCsv} disabled={!sorted.length}><Download size={16}/> Exportar CSV</button><button className="uiBtn uiBtnSecondary" onClick={() => void load(true)} disabled={loading || deleting}>{loading ? <Loader2 className="spin" size={16}/> : <RefreshCw size={16}/>} Actualizar</button></div></div>

    <div className="studioNotice warn"><AlertTriangle size={16}/><span><strong>Antes de borrar:</strong> exporta una copia de la lista y revisa el motivo de la suspensión de monetización. Eliminar Reels no garantiza que Meta la reactive.</span></div>

    <section className="studioCard studioReelToolbar" aria-label="Filtros">
      <label><span>Página</span><select value={pageId} onChange={e => { void setActivePage(e.target.value); }}><option value="">Selecciona…</option>{pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="studioField"><span>Periodo</span><div className="segmented compact studioSegmented" role="group" aria-label="Periodo">{periods.map(([value, label]) => <button type="button" key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{label}</button>)}</div></div>
      <dl className="studioReelStats"><div><dt>Reels confirmados</dt><dd>{sorted.length}</dd></div><div><dt>Seleccionados</dt><dd>{selected.size}</dd></div><div><dt>Posts revisados</dt><dd>{scanned}</dd></div></dl>
    </section>

    {(error || notice) && <div className={error ? "studioNotice error" : "studioNotice success"}>{error ? <AlertTriangle size={16}/> : <Check size={16}/>}<span>{error || notice}</span></div>}

    {!!sorted.length && <div className="studioListHead">
      <button type="button" className="linkButton" onClick={toggleAll}>{allSelected ? <CheckSquare2 size={16}/> : <Square size={16}/>} {allSelected ? "Quitar selección" : "Seleccionar visibles"}</button>
      <span>{sorted.length} {sorted.length === 1 ? "Reel" : "Reels"} · del más reciente al más antiguo</span>
    </div>}

    <section className="studioReelGrid">
      {loading && !sorted.length ? <div className="studioEmpty studioEmptyBox"><Loader2 className="spin" size={28}/><strong>Buscando Reels…</strong><span>Revisando las publicaciones de {page?.name || "la página"}.</span></div> : sorted.length ? sorted.map(item => {
        const checked = selected.has(item.id);
        return <article className={checked ? "studioReelCard selected" : "studioReelCard"} key={item.id}>
          <div className="studioReelThumb">
            {item.thumbnail ? <img src={item.thumbnail} alt="Miniatura del Reel"/> : <Video size={28}/>}
            <button className="studioCheck" onClick={() => toggle(item.id)} aria-pressed={checked} aria-label={checked ? "Quitar selección" : "Seleccionar"}>{checked ? <Check size={14}/> : null}</button>
            <span className="studioReelBadge"><Film size={12}/> Reel</span>
          </div>
          <div className="studioReelBody">
            <small>{pretty(item.createdTime)}</small>
            <p className={item.message ? "" : "muted"}>{item.message || "Reel sin texto"}</p>
            <code title={item.id}>{item.id}</code>
          </div>
          <a className="linkButton studioReelLink" href={item.permalinkUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Ver en Facebook</a>
        </article>;
      }) : <div className="studioEmpty studioEmptyBox"><Film size={28}/><strong>Aún no hay Reels confirmados</strong><span>Amplía el periodo o pulsa Actualizar.</span></div>}
    </section>

    {!!after && <div className="studioLoadMore"><button className="uiBtn uiBtnSecondary" onClick={() => void load(false)} disabled={loading}>{loading ? <Loader2 className="spin" size={16}/> : <RefreshCw size={16}/>} Buscar más publicaciones</button></div>}

    {!!ambiguous.length && <details className="studioDetails"><summary><Video size={16}/> {ambiguous.length} {ambiguous.length === 1 ? "video" : "videos"} sin confirmar como Reel</summary><p>No entran en la selección masiva para no borrar videos normales por accidente. Puedes revisarlos directamente en Facebook.</p></details>}

    {!!sorted.length && <div className="actionBar">
      <div className="actionBarSummary"><span><small>Selección</small><strong>{selected.size} de {sorted.length} {sorted.length === 1 ? "Reel" : "Reels"}</strong></span></div>
      <div className="actionBarButtons"><button className="uiBtn uiBtnDanger" onClick={() => void deleteSelected()} disabled={!selected.size || deleting}>{deleting ? <Loader2 className="spin" size={16}/> : <Trash2 size={16}/>} Eliminar seleccionados</button></div>
    </div>}
  </div>;
}
