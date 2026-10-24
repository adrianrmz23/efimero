"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bookmark, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Globe2, Image as ImageIcon, Loader2, RefreshCw, Send, ShieldCheck, Sparkles, Star, Trash2, X } from "lucide-react";
import { metaOnly, useMetaQueue } from "@/lib/metaQueue";
import { supabase } from "@/lib/supabase";
import { META_MIN_SCHEDULE_MINUTES, isScheduleInFuture, localDateTime, localDateString, minTimeForDate, nextAllowedSchedule } from "@/lib/scheduling";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type Item={id:string;date:string;time:string;category:string;text:string;format:"Texto"|"Imagen";status:string;similarity?:number;imageDataUrl?:string;imageUrl?:string;pageId?:string;pageName?:string;metaPostId?:string;compliance?:any;publishError?:string};
type Props={items:Item[];onChange:(items:Item[])=>void;onOpenCreator:()=>void;onSaveToLibrary?:(item:any,favorite?:boolean)=>void};
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const pretty=(d:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${d}T12:00:00`));
const rangeDay=(d:string)=>new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short"}).format(new Date(`${d}T12:00:00`)).replace(".","");
const weekdayShort=(d:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"short"}).format(new Date(`${d}T12:00:00`)).replace(".","");
const longDate=(d:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long"}).format(new Date(`${d}T12:00:00`));
const statusTone:Record<string,string>={Borrador:"neutral",Revisión:"warning",Aprobado:"success",Programado:"accent",Publicado:"muted",Error:"danger"};

export default function EditorialCalendar({items,onChange,onOpenCreator,onSaveToLibrary}:Props){
  const {pages,activePageId:pageId,setActivePage}=usePages();
  const confirm=useConfirm();
  const [statusFilter,setStatusFilter]=useState("Todos"); const [categoryFilter,setCategoryFilter]=useState("Todas");
  const [busy,setBusy]=useState<string|null>(null); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [weekOffset,setWeekOffset]=useState(0);const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),60_000);return()=>clearInterval(id)},[]);
  const page=pages.find(p=>p.id===pageId);
  // Cola real de Facebook: incluye lo programado en bulk que no vive en el estado de la app.
  const meta=useMetaQueue(pageId);
  const metaPosts=useMemo(()=>metaOnly(meta.posts,items),[meta.posts,items]);
  const start=useMemo(()=>{const d=new Date();d.setHours(12,0,0,0);const delta=(d.getDay()+6)%7;d.setDate(d.getDate()-delta+weekOffset*7);return d},[weekOffset]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d)}),[start]);
  const cats=useMemo(()=>["Todas",...Array.from(new Set(items.map(x=>x.category)))],[items]);
  const statuses=["Todos","Borrador","Revisión","Aprobado","Programado","Publicado","Error"];
  const visible=items.filter(x=>(statusFilter==="Todos"||x.status===statusFilter)&&(categoryFilter==="Todas"||x.category===categoryFilter));
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Hora local";
  const today=localDateString(now);
  // Estado solo de interfaz: pieza abierta en el panel lateral y día bajo el cursor al arrastrar.
  const [selectedId,setSelectedId]=useState<string|null>(null);const [dragOver,setDragOver]=useState<string|null>(null);
  const selected=selectedId?items.find(x=>x.id===selectedId):undefined;
  const visibleMeta=(statusFilter==="Todos"||statusFilter==="Programado")&&categoryFilter==="Todas"?metaPosts:[];
  const weekCount=visible.filter(x=>days.includes(x.date)).length+visibleMeta.filter(x=>days.includes(x.date)).length;
  useEffect(()=>{if(!selectedId)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setSelectedId(null)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[selectedId]);

  async function persist(item:Item){
    if(!supabase)return;
    const publishAt=`${item.date}T${item.time}:00`;
    await supabase.from("efimero_scheduled_posts").upsert({id:item.id,publish_at:publishAt,publish_at_utc:localDateTime(item.date,item.time).toISOString(),text:item.text,category:item.category,format:item.format,status:item.status,page_id:item.pageId||pageId||null,page_name:item.pageName||page?.name||null,meta_post_id:item.metaPostId||null,compliance_data:item.compliance||null,image_url:item.imageUrl||null,autopilot:Boolean((item as any).autopilot),publish_error:item.publishError||null},{onConflict:"id"});
  }
  function patch(id:string,changes:Partial<Item>){const next=items.map(x=>x.id===id?{...x,...changes}:x);onChange(next);const changed=next.find(x=>x.id===id);if(changed)void persist(changed)}
  function move(id:string,date:string){
    if(date<today){setError("No puedes mover una publicación a una fecha anterior a hoy.");return}
    const item=items.find(x=>x.id===id);if(!item)return;
    if(date===today&&!isScheduleInFuture(date,item.time,META_MIN_SCHEDULE_MINUTES,now)){const next=nextAllowedSchedule(20,5,now);patch(id,{date,time:next.time,status:"Borrador"});setMessage(`La hora anterior ya pasó. Se ajustó automáticamente a ${next.time}.`);return}
    patch(id,{date,status:"Borrador"});
  }
  async function review(item:Item,autoFix=true){
    setBusy(item.id);setError("");setMessage("");
    try{const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:item.text})});const d=await r.json();const c=d.items?.[0];if(!r.ok||!c)throw new Error(d.error||"No se pudo revisar.");const nextText=autoFix&&c.status!=="pass"&&c.correctedText?c.correctedText:item.text;patch(item.id,{text:nextText,compliance:c,status:c.status==="pass"?"Aprobado":"Revisión"});setMessage(c.status==="pass"?"Texto aprobado por Compliance Meta.":"Texto marcado para revisión; se aplicó una corrección cuando fue posible.");}
    catch(e:any){setError(e?.message||"Falló Compliance Meta.")}finally{setBusy(null)}
  }
  async function publish(item:Item,publishNow:boolean){
    if(!pageId){setError("Selecciona una página.");return}
    if(!publishNow&&!isScheduleInFuture(item.date,item.time,META_MIN_SCHEDULE_MINUTES,now)){setError(`Ese horario ya pasó o está demasiado cerca. Programa al menos ${META_MIN_SCHEDULE_MINUTES} minutos hacia adelante.`);return}
    if(item.compliance?.status!=="pass"){await review(item);setError("Primero confirma que el texto quede en estado Aprobado.");return}
    const scheduledAt=publishNow?"":localDateTime(item.date,item.time).toISOString();const action=publishNow?"publicar ahora":"programar en Facebook";
    if(!await confirm({
      title:publishNow?"¿Publicar ahora?":"¿Programar en Facebook?",
      description:`Página: ${page?.name||"la página"}\n${publishNow?"Se publicará de inmediato.":`Horario: ${pretty(item.date)} · ${item.time}`}`,
      confirmLabel:publishNow?"Publicar ahora":"Programar",
    }))return;
    setBusy(item.id);setError("");setMessage("");
    try{const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:item.text,imageDataUrl:item.imageDataUrl,imageUrl:item.imageUrl,scheduledAt,publishNow,scheduledPostId:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la publicación.");patch(item.id,{status:publishNow?"Publicado":"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined,publishError:undefined});setMessage(publishNow?"Publicación enviada a Facebook.":"Publicación programada en Facebook.");}
    catch(e:any){patch(item.id,{status:"Error",publishError:e?.message||"Error"});setError(e?.message||"No fue posible publicar.")}finally{setBusy(null)}
  }
  async function reviewAll(){
    const candidates=items.filter(x=>x.status==="Borrador"||x.status==="Revisión");if(!candidates.length){setMessage("No hay borradores pendientes de Compliance.");return}
    setBusy("batch-review");setError("");setMessage("");let next=[...items];
    try{for(let i=0;i<candidates.length;i+=40){const chunk=candidates.slice(i,i+40);const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:chunk.map(x=>x.text)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo revisar el lote.");const checks=d.items||[];chunk.forEach((item,index)=>{const c=checks[index];if(!c)return;const text=c.status!=="pass"&&c.correctedText?String(c.correctedText):item.text;next=next.map(x=>x.id===item.id?{...x,text,compliance:c,status:c.status==="pass"?"Aprobado":"Revisión"}:x)})}onChange(next);next.filter(x=>candidates.some(c=>c.id===x.id)).forEach(x=>void persist(x));setMessage(`${candidates.length} piezas revisadas. ${next.filter(x=>candidates.some(c=>c.id===x.id)&&x.status==="Aprobado").length} quedaron aprobadas.`)}catch(e:any){setError(e?.message||"Falló la revisión masiva.")}finally{setBusy(null)}
  }
  async function scheduleApproved(){
    const all=items.filter(x=>x.status==="Aprobado");if(!all.length){setError("No hay piezas aprobadas.");return}if(!pageId){setError("Selecciona una página.");return}
    const batch=all.filter(x=>isScheduleInFuture(x.date,x.time,META_MIN_SCHEDULE_MINUTES,now));const skipped=all.length-batch.length;if(!batch.length){setError("Todas las piezas aprobadas tienen un horario pasado o demasiado cercano. Ajusta sus horas primero.");return}
    if(!await confirm({
      title:`¿Programar ${batch.length} piezas aprobadas?`,
      description:`Página: ${page?.name||"la página"}\nSe programarán ${batch.length} piezas futuras${skipped?` y se omitirán ${skipped} con hora inválida`:""}.`,
      confirmLabel:`Programar ${batch.length}`,
    }))return;
    setBusy("batch-schedule");setError("");setMessage("");let next=[...items];let ok=0,failed=0;
    for(const item of batch){try{const scheduledAt=localDateTime(item.date,item.time).toISOString();const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:item.text,imageDataUrl:item.imageDataUrl,imageUrl:item.imageUrl,scheduledAt,publishNow:false,scheduledPostId:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la programación.");next=next.map(x=>x.id===item.id?{...x,status:"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined,publishError:undefined}:x);ok++;}catch(e:any){next=next.map(x=>x.id===item.id?{...x,status:"Error",publishError:e?.message||"Error"}:x);failed++;}}
    onChange(next);next.filter(x=>batch.some(c=>c.id===x.id)).forEach(x=>void persist(x));setBusy(null);setMessage(`${ok} programadas${skipped?` · ${skipped} omitidas por horario`:""}${failed?` · ${failed} con error`:""}.`);
  }

  async function removeItem(item:Item){
    if(busy)return;setError("");setMessage("");
    if(item.status==="Programado"){
      if(!item.metaPostId){setError("Esta pieza figura como programada, pero Efímero no conserva su ID de Meta. Ábrela desde Cola Meta para cancelarla de forma segura.");return}
      const targetPage=item.pageId||pageId;
      if(!targetPage){setError("No se pudo identificar la página de Facebook de esta programación.");return}
      if(!await confirm({
        title:"¿Cancelar la programación en Facebook?",
        description:`Esta publicación ya está en la cola de Facebook (${item.pageName||page?.name||"la página"}). Se cancelará en Meta para que NO se publique el ${pretty(item.date)} a las ${item.time}, y se eliminará de Efímero.`,
        confirmLabel:"Cancelar y eliminar",
        cancelLabel:"Volver",
        tone:"danger",
      }))return;
      setBusy(item.id);
      try{
        const r=await fetch("/api/meta/scheduled",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId:targetPage,postIds:[item.metaPostId]})});
        const d=await r.json();if(!r.ok||!d.cancelled)throw new Error(d.error||d.results?.[0]?.error||"Meta no confirmó la cancelación.");
        onChange(items.filter(x=>x.id!==item.id));
        if(supabase)await supabase.from("efimero_scheduled_posts").delete().eq("id",item.id);
        setMessage("Programación cancelada en Facebook y eliminada de Efímero.");
      }catch(e:any){setError(e?.message||"No fue posible cancelar la publicación en Facebook. No se eliminó de Efímero.")}finally{setBusy(null)}
      return;
    }
    if(!await confirm({
      title:"¿Eliminar esta pieza?",
      description:`${item.category} · ${pretty(item.date)} · ${item.time}\nSe eliminará de Efímero. No afecta a Facebook.`,
      confirmLabel:"Eliminar",
      tone:"danger",
    }))return;
    onChange(items.filter(x=>x.id!==item.id));
    if(supabase)await supabase.from("efimero_scheduled_posts").delete().eq("id",item.id);
    setMessage("Pieza eliminada de Efímero.");
  }

  const closeNotice=()=>{setError("");setMessage("")};
  const notice=(message||error)?<div className={error?"quickNotice error calNotice":"quickNotice calNotice"} role="status">{error?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span>{error||message}</span><button type="button" className="calNoticeClose" onClick={closeNotice} aria-label="Cerrar aviso"><X size={14}/></button></div>:null;

  return <>
    <div className="pageIntro">
      <div><span className="overline">CALENDARIO EDITORIAL</span><h1>Calendario</h1><p>Tu semana de publicaciones de un vistazo. Arrastra una pieza a otro día para moverla y ábrela para editarla, revisarla o programarla.</p></div>
      <div className="calIntroActions"><span className="timezoneBadge"><Globe2 size={14}/>{timezone}</span><button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenCreator}><Sparkles size={16}/> Generar contenido</button></div>
    </div>

    <section className="calToolbar" aria-label="Filtros y acciones del calendario">
      <label><span>Página</span><select value={pageId} onChange={e=>void setActivePage(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
      <label><span>Estado</span><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Categoría</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{cats.map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="calToolbarActions">
        <button type="button" className="uiBtn uiBtnSecondary" onClick={reviewAll}>{busy==="batch-review"?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar borradores</button>
        <button type="button" className="uiBtn uiBtnPrimary" onClick={scheduleApproved}>{busy==="batch-schedule"?<Loader2 className="spin" size={16}/>:<CalendarDays size={16}/>} Programar aprobados</button>
      </div>
    </section>

    <div className="calWeekBar">
      <div className="calWeekNav">
        <button type="button" className="uiBtn uiBtnSecondary calTodayBtn" onClick={()=>setWeekOffset(0)}>Hoy</button>
        <button type="button" className="uiIconBtn" onClick={()=>setWeekOffset(x=>x-1)} aria-label="Semana anterior"><ChevronLeft size={16}/></button>
        <button type="button" className="uiIconBtn" onClick={()=>setWeekOffset(x=>x+1)} aria-label="Semana siguiente"><ChevronRight size={16}/></button>
        <div className="calWeekRange"><strong>{rangeDay(days[0])} – {rangeDay(days[6])}</strong><span>{weekCount} {weekCount===1?"publicación":"publicaciones"}{metaPosts.length?` · ${metaPosts.length} solo en Facebook`:""}</span></div>
        <button type="button" className="uiIconBtn" onClick={()=>void meta.refresh()} disabled={meta.loading} title="Actualizar cola de Facebook" aria-label="Actualizar cola de Facebook">{meta.loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>}</button>
      </div>
      <div className="calNow"><Clock3 size={14}/><span>Ahora: {new Intl.DateTimeFormat("es-MX",{weekday:"long",hour:"2-digit",minute:"2-digit"}).format(now)} · Meta pide al menos {META_MIN_SCHEDULE_MINUTES} min de anticipación</span></div>
    </div>

    {!selected&&notice}
    {meta.error&&<div className="quickNotice error">No se pudo leer la cola de Facebook: {meta.error}</div>}

    {!items.length&&!metaPosts.length&&<div className="calEmpty">
      <span className="calEmptyIcon"><CalendarDays size={18}/></span>
      <div><strong>Todavía no hay piezas en el calendario</strong><span>Genera contenido o usa Programar un post para llenar la semana.</span></div>
      <button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenCreator}><Sparkles size={16}/> Abrir generador</button>
    </div>}

    <section className="calBoard" aria-label="Semana">
      {days.map(date=>{
        const dayItems=visible.filter(x=>x.date===date).sort((a,b)=>a.time.localeCompare(b.time));const dayMeta=visibleMeta.filter(x=>x.date===date);const dayTotal=dayItems.length+dayMeta.length;const pastDay=date<today;const isToday=date===today;
        const dayClass=["calDay",isToday?"isToday":"",pastDay?"isPast":"",dragOver===date?"isDragOver":""].filter(Boolean).join(" ");
        return <div className={dayClass} key={date} aria-label={pretty(date)}
          onDragOver={e=>e.preventDefault()}
          onDragEnter={()=>setDragOver(date)}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragOver(current=>current===date?null:current)}}
          onDrop={e=>{setDragOver(null);const id=e.dataTransfer.getData("text/plain");if(id)move(id,date)}}>
          <header className="calDayHead">
            <div className="calDayLabel"><span>{weekdayShort(date)}</span><strong>{Number(date.slice(8,10))}</strong></div>
            {isToday&&<span className="statusPill tone-accent">Hoy</span>}
            <span className="calDayCount" title={`${dayTotal} publicaciones`}>{dayTotal}</span>
          </header>
          <div className="calDayBody">
            {[...dayItems.map(item=>({time:item.time,item,post:null})),...dayMeta.map(post=>({time:post.time,item:null,post}))].sort((a,b)=>a.time.localeCompare(b.time)).map(({item,post})=>{
              if(post)return <article key={`meta-${post.id}`} className="calBlock isMeta" data-tone="accent" title="Programada directamente en Facebook. Para cancelarla usa Cola de Meta.">
                <div className="calBlockTop"><span className="calBlockTime">{post.time}</span><span className="statusPill tone-accent">Facebook</span></div>
                <p className="calBlockText">{post.text||"Publicación sin texto (solo imagen)"}</p>
                <div className="calBlockMeta"><Globe2 size={12}/><span>{post.category||"Cola de Facebook"}</span></div>
              </article>;
              if(!item)return null;
              const future=isScheduleInFuture(item.date,item.time,META_MIN_SCHEDULE_MINUTES,now);const expired=!future&&item.status!=="Publicado";const tone=statusTone[item.status]||"neutral";
              return <article key={item.id} draggable role="button" tabIndex={0} data-tone={tone}
                className={`calBlock${expired?" isExpired":""}${selectedId===item.id?" isSelected":""}`}
                aria-label={`${item.time} · ${item.status} · ${item.category}. Abrir detalle`}
                onDragStart={e=>e.dataTransfer.setData("text/plain",item.id)}
                onDragEnd={()=>setDragOver(null)}
                onClick={()=>setSelectedId(item.id)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedId(item.id)}}}>
                <div className="calBlockTop"><span className="calBlockTime">{busy===item.id&&<Loader2 className="spin" size={12}/>}{item.time}</span><span className={`statusPill tone-${tone}`}>{item.status}</span></div>
                <p className="calBlockText">{item.text||"Publicación sin texto"}</p>
                <div className="calBlockMeta">{item.format==="Imagen"&&<ImageIcon size={12}/>}<span>{item.category}</span></div>
                {(expired||item.publishError)&&<div className="calBlockFlags">
                  {expired&&<span className="calFlag warn"><Clock3 size={12}/> Hora pasada</span>}
                  {item.publishError&&<span className="calFlag danger"><AlertTriangle size={12}/> Error al publicar</span>}
                </div>}
              </article>;
            })}
            {!dayTotal&&<div className="calDayEmpty">{pastDay?"Día anterior":"Sin publicaciones"}</div>}
          </div>
        </div>;
      })}
    </section>

    <p className="pageFootnote"><CalendarDays size={14}/> Al mover una pieza a otro día o cambiar su hora, vuelve a Borrador. Solo las piezas aprobadas se pueden programar o publicar.</p>

    {selected&&(()=>{
      const item=selected;const future=isScheduleInFuture(item.date,item.time,META_MIN_SCHEDULE_MINUTES,now);const expired=!future&&item.status!=="Publicado";const tone=statusTone[item.status]||"neutral";const itemBusy=busy===item.id;const c=item.compliance;
      return <>
        <div className="calSheetBackdrop" onClick={()=>setSelectedId(null)} aria-hidden="true"/>
        <aside className="calSheet" role="dialog" aria-modal="true" aria-labelledby="calSheetTitle">
          <header className="calSheetHead">
            <div>
              <span className="calSheetDate">{longDate(item.date)}</span>
              <h2 id="calSheetTitle">Publicación de las {item.time}</h2>
              <div className="calSheetTags"><span className={`statusPill tone-${tone}`}>{item.status}</span><span className="calTag">{item.category}</span><span className="calTag">{item.format}</span>{item.pageName&&<span className="calTag">{item.pageName}</span>}</div>
            </div>
            <button type="button" className="uiIconBtn" onClick={()=>setSelectedId(null)} aria-label="Cerrar panel"><X size={16}/></button>
          </header>

          <div className="calSheetBody">
            <label className="calField calFieldTime"><span>Hora</span><input type="time" min={minTimeForDate(item.date,META_MIN_SCHEDULE_MINUTES,now)} value={item.time} onChange={e=>patch(item.id,{time:e.target.value,status:"Borrador"})}/></label>
            <label className="calField"><span>Texto</span><textarea value={item.text} onChange={e=>patch(item.id,{text:e.target.value,status:"Borrador",compliance:undefined})}/></label>
            {item.imageDataUrl&&<img className="calSheetImage" src={item.imageDataUrl} alt="Creatividad"/>}
            <div className={c?(c.status==="pass"?"scheduleValidity ok":"scheduleValidity warn"):"scheduleValidity"}><ShieldCheck size={16}/><span>{c?<>Compliance {c.score}/100 · {c.status==="pass"?"texto aprobado.":"requiere revisión."}</>:"Compliance sin revisar. Revísalo antes de programar."}</span></div>
            {expired&&<div className="scheduleValidity warn"><Clock3 size={16}/><span>Esa hora ya pasó o está muy cerca. Elige una al menos {META_MIN_SCHEDULE_MINUTES} min hacia adelante para programar.</span></div>}
            {item.publishError&&<div className="quickNotice error"><AlertTriangle size={16}/><span>{item.publishError}</span></div>}
            {notice}
          </div>

          <footer className="calSheetFoot">
            {item.status!=="Aprobado"&&<p className="calSheetHint">Para programar o publicar, la pieza debe estar en Aprobado.</p>}
            <div className="calSheetPrimary">
              <button type="button" className="uiBtn uiBtnPrimary" onClick={()=>publish(item,false)} disabled={itemBusy||item.status!=="Aprobado"||!future}><Clock3 size={16}/> Programar</button>
              <button type="button" className="uiBtn uiBtnSecondary" onClick={()=>publish(item,true)} disabled={itemBusy||item.status!=="Aprobado"}><Send size={16}/> Publicar ya</button>
            </div>
            <div className="calSheetSecondary">
              <button type="button" className="uiBtn uiBtnGhost" onClick={()=>review(item)} disabled={itemBusy}>{itemBusy?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar</button>
              <button type="button" className="uiBtn uiBtnGhost" onClick={()=>onSaveToLibrary?.(item,false)}><Bookmark size={16}/> Guardar</button>
              <button type="button" className="uiIconBtn" onClick={()=>onSaveToLibrary?.(item,true)} title="Guardar en favoritos" aria-label="Guardar en favoritos"><Star size={16}/></button>
              <button type="button" className="uiIconBtn danger calSheetDelete" onClick={()=>void removeItem(item)} disabled={itemBusy} title={item.status==="Programado"?"Cancelar programación en Facebook":"Eliminar de Efímero"} aria-label={item.status==="Programado"?"Cancelar programación en Facebook":"Eliminar de Efímero"}>{itemBusy?<Loader2 className="spin" size={16}/>:<Trash2 size={16}/>}</button>
            </div>
          </footer>
        </aside>
      </>;
    })()}
  </>
}
