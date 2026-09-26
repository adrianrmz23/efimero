"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bookmark, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GripVertical, Loader2, Send, ShieldCheck, Sparkles, Star, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { META_MIN_SCHEDULE_MINUTES, isScheduleInFuture, localDateTime, localDateString, minTimeForDate, nextAllowedSchedule } from "@/lib/scheduling";

type Item={id:string;date:string;time:string;category:string;text:string;format:"Texto"|"Imagen";status:string;similarity?:number;imageDataUrl?:string;imageUrl?:string;pageId?:string;pageName?:string;metaPostId?:string;compliance?:any;publishError?:string};
type Page={id:string;name:string};
type Props={items:Item[];onChange:(items:Item[])=>void;onOpenCreator:()=>void;onSaveToLibrary?:(item:any,favorite?:boolean)=>void};
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const pretty=(d:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${d}T12:00:00`));

export default function EditorialCalendar({items,onChange,onOpenCreator,onSaveToLibrary}:Props){
  const [pages,setPages]=useState<Page[]>([]); const [pageId,setPageId]=useState("");
  const [statusFilter,setStatusFilter]=useState("Todos"); const [categoryFilter,setCategoryFilter]=useState("Todas");
  const [busy,setBusy]=useState<string|null>(null); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [weekOffset,setWeekOffset]=useState(0);const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{fetch("/api/meta/pages",{cache:"no-store"}).then(r=>r.json()).then(d=>{setPages(d.pages||[]);if(d.pages?.length)setPageId(d.activePageId||d.pages[0].id)}).catch(()=>{})},[]);
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),60_000);return()=>clearInterval(id)},[]);
  const page=pages.find(p=>p.id===pageId);
  const start=useMemo(()=>{const d=new Date();d.setHours(12,0,0,0);const delta=(d.getDay()+6)%7;d.setDate(d.getDate()-delta+weekOffset*7);return d},[weekOffset]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d)}),[start]);
  const cats=useMemo(()=>["Todas",...Array.from(new Set(items.map(x=>x.category)))],[items]);
  const statuses=["Todos","Borrador","Revisión","Aprobado","Programado","Publicado","Error"];
  const visible=items.filter(x=>(statusFilter==="Todos"||x.status===statusFilter)&&(categoryFilter==="Todas"||x.category===categoryFilter));
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Hora local";
  const today=localDateString(now);

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
    if(!window.confirm(`¿Confirmas ${action} en ${page?.name||"la página"}?`))return;
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
    if(!window.confirm(`Se programarán ${batch.length} piezas futuras${skipped?` y se omitirán ${skipped} con hora inválida`:""}. ¿Continuar?`))return;
    setBusy("batch-schedule");setError("");setMessage("");let next=[...items];let ok=0,failed=0;
    for(const item of batch){try{const scheduledAt=localDateTime(item.date,item.time).toISOString();const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:item.text,imageDataUrl:item.imageDataUrl,imageUrl:item.imageUrl,scheduledAt,publishNow:false,scheduledPostId:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la programación.");next=next.map(x=>x.id===item.id?{...x,status:"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined,publishError:undefined}:x);ok++;}catch(e:any){next=next.map(x=>x.id===item.id?{...x,status:"Error",publishError:e?.message||"Error"}:x);failed++;}}
    onChange(next);next.filter(x=>batch.some(c=>c.id===x.id)).forEach(x=>void persist(x));setBusy(null);setMessage(`${ok} programadas${skipped?` · ${skipped} omitidas por horario`:""}${failed?` · ${failed} con error`:""}.`);
  }

  return <>
    <div className="pageIntro calendarIntro"><div><span className="overline">CALENDARIO EDITORIAL</span><h1>Semana más clara, decisiones más rápidas</h1><p>Ahora el calendario usa más espacio, textos más grandes y bloqueo de horarios pasados. Zona horaria: {timezone}.</p></div><button className="outlineButton" onClick={onOpenCreator}><Sparkles size={17}/> Generar contenido</button></div>
    <section className="calendarCommandBar">
      <label><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Estado</span><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Categoría</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{cats.map(x=><option key={x}>{x}</option>)}</select></label>
      <button onClick={reviewAll}><ShieldCheck size={17}/> Revisar borradores</button><button onClick={scheduleApproved}><CalendarDays size={17}/> Programar aprobados</button>
    </section>
    <div className="calendarNow"><Clock3 size={16}/><span>Ahora: {new Intl.DateTimeFormat("es-MX",{weekday:"long",hour:"2-digit",minute:"2-digit"}).format(now)} · Meta se programa mínimo {META_MIN_SCHEDULE_MINUTES} min hacia adelante.</span></div>
    {(message||error)&&<div className={error?"calendarNotice error":"calendarNotice"}>{error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||message}</span><button onClick={()=>{setError("");setMessage("")}}>×</button></div>}
    <div className="weekNavigator"><button onClick={()=>setWeekOffset(x=>x-1)}><ChevronLeft/></button><button className="todayButton" onClick={()=>setWeekOffset(0)}>Hoy</button><strong>{pretty(days[0])} — {pretty(days[6])}</strong><button onClick={()=>setWeekOffset(x=>x+1)}><ChevronRight/></button></div>
    <section className="weekBoard">{days.map(date=>{const dayItems=visible.filter(x=>x.date===date).sort((a,b)=>a.time.localeCompare(b.time));const pastDay=date<today;return <div className={date===today?"dayColumn today":"dayColumn"} key={date} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData("text/plain");if(id)move(id,date)}}><header><div><strong>{pretty(date)}</strong>{date===today&&<small>HOY</small>}</div><span>{dayItems.length}</span></header><div className="dayDropZone">{pastDay&&!dayItems.length&&<div className="pastDayLabel">Día anterior</div>}{dayItems.map(item=>{const future=isScheduleInFuture(item.date,item.time,META_MIN_SCHEDULE_MINUTES,now);return <article draggable onDragStart={e=>e.dataTransfer.setData("text/plain",item.id)} className={`calendarCard status-${item.status.toLowerCase()} ${!future&&item.status!=="Publicado"?"pastSlot":""}`} key={item.id}><div className="calendarCardTop"><GripVertical size={17}/><input type="time" min={minTimeForDate(item.date,META_MIN_SCHEDULE_MINUTES,now)} value={item.time} onChange={e=>patch(item.id,{time:e.target.value,status:"Borrador"})}/><span className="calendarStatus">{item.status}</span></div><div className="calendarTags"><span>{item.category}</span><span>{item.format}</span>{item.compliance&&<b className={item.compliance.status==="pass"?"ok":"warn"}>Compliance {item.compliance.score}/100</b>}{!future&&item.status!=="Publicado"&&<b className="expiredTag">Hora pasada</b>}</div><textarea value={item.text} onChange={e=>patch(item.id,{text:e.target.value,status:"Borrador",compliance:undefined})}/>{item.imageDataUrl&&<img className="calendarThumb" src={item.imageDataUrl} alt="Creatividad"/>}{item.publishError&&<small className="publishError">{item.publishError}</small>}<div className="calendarActions"><button onClick={()=>review(item)} disabled={busy===item.id}>{busy===item.id?<Loader2 className="spin" size={14}/>:<ShieldCheck size={14}/>} Revisar</button><button onClick={()=>onSaveToLibrary?.(item,false)}><Bookmark size={14}/> Guardar</button><button className="favoriteCalendar" onClick={()=>onSaveToLibrary?.(item,true)} title="Guardar en favoritos"><Star size={14}/></button><button onClick={()=>publish(item,false)} disabled={busy===item.id||item.status!=="Aprobado"||!future}><Clock3 size={14}/> Programar</button><button onClick={()=>publish(item,true)} disabled={busy===item.id||item.status!=="Aprobado"}><Send size={14}/> Publicar</button><button className="danger" onClick={()=>onChange(items.filter(x=>x.id!==item.id))}><Trash2 size={14}/></button></div></article>})}{!dayItems.length&&!pastDay&&<div className="dayEmpty">Sin publicaciones</div>}</div></div>})}</section>
    {!items.length&&<section className="emptyState"><CalendarDays size={40}/><h2>No hay piezas en el calendario</h2><p>Genera contenido o usa el Programador individual.</p><button onClick={onOpenCreator}><Sparkles size={18}/> Abrir generador</button></section>}
  </>
}
