"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckSquare2, Download, ExternalLink, Film, Loader2, RefreshCw, Square, Trash2, Video } from "lucide-react";
import { persistWorkingPage, resolveWorkingPageId, WORKING_PAGE_EVENT } from "@/lib/workingPage";

type Page = { id: string; name: string };
type Reel = { id: string; message: string; createdTime?: string | null; permalinkUrl: string; thumbnail?: string; confirmed: boolean };

function pretty(value?: string | null) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function ReelManager() {
  const [pages, setPages] = useState<Page[]>([]);
  const [pageId, setPageId] = useState("");
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

  useEffect(() => {
    const handler = (event: Event) => { const id = (event as CustomEvent<{ pageId: string }>).detail?.pageId; if (id) setPageId(id); };
    window.addEventListener(WORKING_PAGE_EVENT, handler);
    fetch("/api/meta/pages", { cache: "no-store" }).then(r => r.json()).then(data => {
      const list = data.pages || [];
      setPages(list);
      if (list.length) setPageId(resolveWorkingPageId(list, data.activePageId));
    }).catch(() => {});
    return () => window.removeEventListener(WORKING_PAGE_EVENT, handler);
  }, []);

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

  return <>
    <div className="pageIntro reelManagerIntro"><div><span className="overline">GESTOR DE REELS</span><h1>Revisa y limpia tus Reels desde un solo lugar</h1><p>Efímero consulta las publicaciones de la página y solo habilita borrado masivo para elementos que puede confirmar como Reel.</p></div><div className="uiActionRow"><button className="uiBtn uiBtnSecondary" onClick={exportCsv} disabled={!sorted.length}><Download size={16}/> Exportar CSV</button><button className="uiBtn uiBtnSecondary" onClick={() => void load(true)} disabled={loading || deleting}>{loading ? <Loader2 className="spin" size={16}/> : <RefreshCw size={16}/>} Actualizar</button></div></div>

    <div className="reelManagerWarning"><AlertTriangle size={18}/><p><strong>Antes de borrar:</strong> guarda una copia de la lista y revisa el motivo de la suspensión de monetización. Eliminar Reels no garantiza que Meta reactive la monetización.</p></div>

    <section className="toolPanel reelManagerToolbar">
      <label><span>Página</span><select value={pageId} onChange={e => { setPageId(e.target.value); void persistWorkingPage(e.target.value); }}><option value="">Selecciona…</option>{pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Periodo</span><select value={days} onChange={e => setDays(e.target.value)}><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="0">Todo lo disponible</option></select></label>
      <div className="reelManagerStats"><div><strong>{sorted.length}</strong><span>Reels confirmados</span></div><div><strong>{selected.size}</strong><span>seleccionados</span></div><div><strong>{scanned}</strong><span>posts revisados</span></div></div>
      {!!sorted.length && <div className="uiActionRow"><button className="uiBtn uiBtnSecondary" onClick={toggleAll}>{selected.size === sorted.length ? <CheckSquare2 size={16}/> : <Square size={16}/>} {selected.size === sorted.length ? "Quitar selección" : "Seleccionar visibles"}</button><button className="uiBtn uiBtnDanger" onClick={() => void deleteSelected()} disabled={!selected.size || deleting}>{deleting ? <Loader2 className="spin" size={16}/> : <Trash2 size={16}/>} Eliminar seleccionados</button></div>}
    </section>

    {(error || notice) && <div className={error ? "inlineNotice error" : "inlineNotice"}>{error || notice}</div>}

    <section className="reelGrid">
      {loading && !sorted.length ? <div className="reelEmpty"><Loader2 className="spin" size={28}/><strong>Buscando Reels…</strong><span>Estamos revisando publicaciones de {page?.name || "la página"}.</span></div> : sorted.length ? sorted.map(item => {
        const checked = selected.has(item.id);
        return <article className={checked ? "reelCard selected" : "reelCard"} key={item.id}>
          <button className="reelSelect" onClick={() => toggle(item.id)} aria-label={checked ? "Quitar selección" : "Seleccionar"}>{checked ? <Check size={16}/> : <span/>}</button>
          <div className="reelThumb">{item.thumbnail ? <img src={item.thumbnail} alt="Miniatura del Reel"/> : <Video size={32}/>}<span><Film size={14}/> Reel confirmado</span></div>
          <div className="reelBody"><small>{pretty(item.createdTime)}</small><p>{item.message || "Reel sin texto"}</p><code>{item.id}</code></div>
          <a className="uiBtn uiBtnSecondary reelOpen" href={item.permalinkUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Ver en Facebook</a>
        </article>;
      }) : <div className="reelEmpty"><Film size={32}/><strong>No encontramos Reels confirmados todavía</strong><span>Prueba ampliando el periodo o pulsa Actualizar.</span></div>}
    </section>

    {!!after && <div className="reelLoadMore"><button className="uiBtn uiBtnSecondary" onClick={() => void load(false)} disabled={loading}>{loading ? <Loader2 className="spin" size={16}/> : <RefreshCw size={16}/>} Buscar más publicaciones</button></div>}

    {!!ambiguous.length && <details className="reelAmbiguous"><summary><Video size={16}/> {ambiguous.length} videos que Efímero no pudo confirmar como Reel</summary><p>No entran en la selección masiva para evitar borrar videos normales por accidente. Puedes revisarlos desde Facebook si lo necesitas.</p></details>}
  </>;
}
