"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, CheckSquare2, Loader2, Minus, RefreshCw, Square, Trash2 } from "lucide-react";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type Scheduled={
  id:string;
  message:string;
  scheduledPublishTime:number;
  createdTime?:string|null;
  local?:{id:string;page_name?:string;publish_at?:string;text?:string;category?:string;format?:string;status?:string}|null;
};

const pretty=(epoch:number)=>epoch?new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(epoch*1000)):"Horario no disponible";
const whenDay=(epoch:number)=>epoch?new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short"}).format(new Date(epoch*1000)):"Sin fecha";
const whenTime=(epoch:number)=>epoch?new Intl.DateTimeFormat("es-MX",{hour:"numeric",minute:"2-digit"}).format(new Date(epoch*1000)):"Horario no disponible";

export default function MetaScheduledQueue({onCancelled}:{onCancelled?:(metaIds:string[])=>void}){
  const {pages,activePageId:pageId,setActivePage}=usePages();const [posts,setPosts]=useState<Scheduled[]>([]);
  const confirm=useConfirm();
  const [selected,setSelected]=useState<Set<string>>(new Set());const [loading,setLoading]=useState(false);const [cancelling,setCancelling]=useState(false);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const page=pages.find(x=>x.id===pageId);
  const upcoming=useMemo(()=>[...posts].sort((a,b)=>a.scheduledPublishTime-b.scheduledPublishTime),[posts]);

  useEffect(()=>{if(pageId)void load()},[pageId]);

  async function load(){
    if(!pageId)return;setLoading(true);setError("");setNotice("");
    try{const r=await fetch(`/api/meta/scheduled?pageId=${encodeURIComponent(pageId)}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible consultar Meta.");setPosts(d.posts||[]);setSelected(new Set())}
    catch(e:any){setError(e?.message||"No fue posible consultar la cola de Meta.")}finally{setLoading(false)}
  }

  function toggle(id:string){setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function selectAll(){setSelected(selected.size===upcoming.length?new Set():new Set(upcoming.map(x=>x.id)))}

  async function cancel(ids:string[]){
    if(!ids.length||!pageId)return;
    const label=ids.length===1?"esta publicación":`${ids.length} publicaciones`;
    const first=ids.length===1?posts.find(x=>x.id===ids[0]):undefined;
    if(!await confirm({
      title:ids.length===1?"¿Cancelar esta publicación en Facebook?":`¿Cancelar ${ids.length} publicaciones en Facebook?`,
      description:`Página: ${page?.name||"Facebook"}${first?`\nHorario: ${pretty(first.scheduledPublishTime)}`:""}\nSe cancelará${ids.length===1?"":"n"} ${label} directamente en Facebook. Una vez cancelada${ids.length===1?"":"s"} no se publicará${ids.length===1?"":"n"} automáticamente.`,
      confirmLabel:ids.length===1?"Cancelar publicación":`Cancelar ${ids.length}`,
      cancelLabel:"Volver",
      tone:"danger",
    }))return;
    setCancelling(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/meta/scheduled",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,postIds:ids})});
      const d=await r.json();if(!r.ok&&!(d.cancelled>0))throw new Error(d.error||d.results?.[0]?.error||"Meta rechazó la cancelación.");
      const okIds=(d.results||[]).filter((x:any)=>x.ok).map((x:any)=>String(x.id));
      setPosts(current=>current.filter(x=>!okIds.includes(x.id)));setSelected(current=>{const next=new Set(current);okIds.forEach((id:string)=>next.delete(id));return next});
      onCancelled?.(okIds);
      setNotice(`${okIds.length} programación${okIds.length===1?"":"es"} cancelada${okIds.length===1?"":"s"} en Meta${d.failed?` · ${d.failed} no se pudieron cancelar`:""}.`);
    }catch(e:any){setError(e?.message||"No fue posible cancelar la programación.")}finally{setCancelling(false)}
  }

  const allSelected=upcoming.length>0&&selected.size===upcoming.length;const someSelected=selected.size>0&&!allSelected;

  return <>
    <div className="pageIntro"><div><span className="overline">COLA DE META</span><h1>Cola de Facebook</h1><p>Lo que Meta todavía tiene programado, consultado directamente en Facebook. Si algo aparece aquí, se publicará aunque ya no esté en el calendario.</p></div><button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void load()} disabled={loading||cancelling}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar</button></div>

    <section className="calToolbar calMetaToolbar" aria-label="Página y resumen">
      <label><span>Página</span><select value={pageId} onChange={e=>void setActivePage(e.target.value)}><option value="">Selecciona una página…</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
      <div className="calMetaStats">
        <div><strong>{upcoming.length}</strong><span>Programadas en Meta</span></div>
        <div><strong>{selected.size}</strong><span>Seleccionadas</span></div>
      </div>
    </section>

    {(error||notice)&&<div className={error?"quickNotice error calNotice":"quickNotice calNotice"} role="status">{error?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span>{error||notice}</span></div>}

    <section className="calPanel calTable" aria-label="Publicaciones programadas en Meta">
      <div className="calTableHead">
        <button type="button" className={`calCheck${allSelected?" checked":someSelected?" mixed":""}`} onClick={selectAll} disabled={!upcoming.length} aria-label={allSelected?"Quitar selección":"Seleccionar todas"}>{allSelected?<Check size={12}/>:someSelected?<Minus size={12}/>:null}</button>
        <span>Horario</span><span>Publicación</span><span>Origen</span><span className="calTableHeadEnd">Acciones</span>
      </div>
      {loading?<div className="calRowsEmpty"><Loader2 className="spin" size={20}/><strong>Consultando Facebook…</strong></div>:upcoming.length?upcoming.map(post=>{
        const checked=selected.has(post.id);const isBulk=post.local?.category==="Bulk visual";
        return <article className={checked?"calMetaRow isSelected":"calMetaRow"} key={post.id}>
          <button type="button" className={`calCheck${checked?" checked":""}`} onClick={()=>toggle(post.id)} aria-label={checked?"Quitar selección":"Seleccionar"}>{checked&&<Check size={12}/>}</button>
          <div className="calMetaWhen" title={pretty(post.scheduledPublishTime)}><strong>{whenTime(post.scheduledPublishTime)}</strong><span>{whenDay(post.scheduledPublishTime)}</span><span>{page?.name||post.local?.page_name||"Facebook"}</span></div>
          <div className="calMetaBody">
            <p className="calRowText">{post.message||post.local?.text||"Publicación visual sin texto"}</p>
            <div className="calRowMeta"><span>{isBulk?"Bulk visual":post.local?.category||"Facebook"}</span><span>{post.local?.format||"Post"}</span><span>ID {post.id}</span></div>
          </div>
          <div className="calMetaOrigin">{post.local?<span className="statusPill tone-success">Sincronizada</span>:<span className="statusPill tone-warning">Solo en Meta</span>}</div>
          <button type="button" className="uiBtn uiBtnGhost calCancelBtn" onClick={()=>void cancel([post.id])} disabled={cancelling} aria-label="Cancelar en Facebook"><Trash2 size={16}/> Cancelar</button>
        </article>;
      }):<div className="calRowsEmpty"><CheckSquare2 size={20}/><strong>No hay publicaciones pendientes en Meta</strong><span>Facebook no reporta publicaciones programadas para {page?.name||"esta página"}.</span></div>}
    </section>

    {upcoming.length>0&&selected.size>0&&<div className="actionBar">
      <div className="actionBarSummary"><CalendarClock size={16}/><span><small>Selección</small><strong>{selected.size} de {upcoming.length} publicaciones</strong></span></div>
      <div className="actionBarButtons">
        <button type="button" className="uiBtn uiBtnSecondary" onClick={selectAll}>{allSelected?<CheckSquare2 size={16}/>:<Square size={16}/>} {allSelected?"Quitar selección":"Seleccionar todas"}</button>
        <button type="button" className="uiBtn uiBtnDanger" onClick={()=>void cancel([...selected])} disabled={!selected.size||cancelling}>{cancelling?<Loader2 className="spin" size={16}/>:<Trash2 size={16}/>} Cancelar seleccionadas</button>
      </div>
    </div>}

    <p className="pageFootnote"><AlertTriangle size={14}/> Borrar una pieza del calendario no equivale a cancelarla en Facebook. Las publicaciones ya programadas se cancelan primero en Meta y solo después desaparecen de Efímero.</p>
  </>;
}
