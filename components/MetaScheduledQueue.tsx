"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, CheckSquare2, Loader2, RefreshCw, Square, Trash2 } from "lucide-react";
import { persistWorkingPage, resolveWorkingPageId, WORKING_PAGE_EVENT } from "@/lib/workingPage";

type Page={id:string;name:string};
type Scheduled={
  id:string;
  message:string;
  scheduledPublishTime:number;
  createdTime?:string|null;
  local?:{id:string;page_name?:string;publish_at?:string;text?:string;category?:string;format?:string;status?:string}|null;
};

const pretty=(epoch:number)=>epoch?new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(epoch*1000)):"Horario no disponible";

export default function MetaScheduledQueue({onCancelled}:{onCancelled?:(metaIds:string[])=>void}){
  const [pages,setPages]=useState<Page[]>([]);const [pageId,setPageId]=useState("");const [posts,setPosts]=useState<Scheduled[]>([]);
  const [selected,setSelected]=useState<Set<string>>(new Set());const [loading,setLoading]=useState(false);const [cancelling,setCancelling]=useState(false);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const page=pages.find(x=>x.id===pageId);
  const upcoming=useMemo(()=>[...posts].sort((a,b)=>a.scheduledPublishTime-b.scheduledPublishTime),[posts]);

  useEffect(()=>{
    const handler=(event:Event)=>{const id=(event as CustomEvent<{pageId:string}>).detail?.pageId;if(id)setPageId(id)};
    window.addEventListener(WORKING_PAGE_EVENT,handler);
    fetch("/api/meta/pages",{cache:"no-store"}).then(r=>r.json()).then(data=>{const list=data.pages||[];setPages(list);if(list.length)setPageId(resolveWorkingPageId(list,data.activePageId))}).catch(()=>{});
    return()=>window.removeEventListener(WORKING_PAGE_EVENT,handler);
  },[]);

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
    if(!window.confirm(`¿Cancelar ${label} directamente en Facebook? Una vez canceladas no se publicarán automáticamente.`))return;
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

  return <>
    <div className="pageIntro metaQueueIntro"><div><span className="overline">COLA REAL DE FACEBOOK</span><h1>Lo que Meta todavía tiene programado</h1><p>Esta vista consulta Facebook directamente. Si una publicación aparece aquí, Meta todavía piensa publicarla aunque ya no aparezca en el calendario local.</p></div><button className="uiBtn uiBtnSecondary" onClick={()=>void load()} disabled={loading||cancelling}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar cola</button></div>

    <section className="metaQueueToolbar toolPanel">
      <label><span>Página activa</span><select value={pageId} onChange={e=>{setPageId(e.target.value);void persistWorkingPage(e.target.value)}}><option value="">Selecciona…</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="metaQueueStats"><div><strong>{upcoming.length}</strong><span>programadas en Meta</span></div><div><strong>{selected.size}</strong><span>seleccionadas</span></div></div>
      {!!upcoming.length&&<div className="uiActionRow"><button className="uiBtn uiBtnSecondary" onClick={selectAll}>{selected.size===upcoming.length?<CheckSquare2 size={16}/>:<Square size={16}/>} {selected.size===upcoming.length?"Quitar selección":"Seleccionar todas"}</button><button className="uiBtn uiBtnDanger" onClick={()=>void cancel([...selected])} disabled={!selected.size||cancelling}>{cancelling?<Loader2 className="spin" size={16}/>:<Trash2 size={16}/>} Cancelar seleccionadas</button></div>}
    </section>

    {(error||notice)&&<div className={error?"inlineNotice error":"inlineNotice"}>{error||notice}</div>}

    <section className="metaQueueList">
      {loading?<div className="metaQueueEmpty"><Loader2 className="spin" size={26}/><strong>Consultando Facebook…</strong></div>:upcoming.length?upcoming.map(post=>{
        const checked=selected.has(post.id);const isBulk=post.local?.category==="Bulk visual";return <article className={checked?"metaQueueCard selected":"metaQueueCard"} key={post.id}>
          <button className="metaQueueCheck" onClick={()=>toggle(post.id)} aria-label={checked?"Quitar selección":"Seleccionar"}>{checked?<Check size={16}/>:<span/>}</button>
          <div className="metaQueueTime"><CalendarClock size={18}/><div><strong>{pretty(post.scheduledPublishTime)}</strong><span>{page?.name||post.local?.page_name||"Facebook"}</span></div></div>
          <div className="metaQueueBody"><div className="calendarTags"><span>{isBulk?"Bulk visual":post.local?.category||"Facebook"}</span><span>{post.local?.format||"Post"}</span>{post.local?<b className="ok">Sincronizada con Efímero</b>:<b className="warn">Solo en Meta</b>}</div><p>{post.message||post.local?.text||"Publicación visual sin texto"}</p><small>ID Meta: {post.id}</small></div>
          <button className="uiBtn uiBtnDanger metaQueueCancel" onClick={()=>void cancel([post.id])} disabled={cancelling}><Trash2 size={15}/> Cancelar en Facebook</button>
        </article>
      }):<div className="metaQueueEmpty"><CheckSquare2 size={30}/><strong>No hay publicaciones pendientes en Meta</strong><span>Facebook no reporta publicaciones programadas para {page?.name||"esta página"}.</span></div>}
    </section>

    <div className="metaQueueWarning"><AlertTriangle size={16}/><p><strong>Importante:</strong> borrar una tarjeta local no equivale a cancelar en Facebook. Desde esta versión, cualquier publicación ya programada se cancela primero en Meta y solo después desaparece de Efímero.</p></div>
  </>;
}
