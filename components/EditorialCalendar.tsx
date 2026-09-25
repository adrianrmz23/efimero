"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GripVertical, Loader2, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Item={id:string;date:string;time:string;category:string;text:string;format:"Texto"|"Imagen";status:string;similarity?:number;imageDataUrl?:string;imageUrl?:string;pageId?:string;pageName?:string;metaPostId?:string;compliance?:any;publishError?:string};
type Page={id:string;name:string};
type Props={items:Item[];onChange:(items:Item[])=>void;onOpenCreator:()=>void;onSaveToLibrary?:(item:any)=>void};
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const pretty=(d:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${d}T12:00:00`));

export default function EditorialCalendar({items,onChange,onOpenCreator,onSaveToLibrary}:Props){
  const [pages,setPages]=useState<Page[]>([]); const [pageId,setPageId]=useState("");
  const [statusFilter,setStatusFilter]=useState("Todos"); const [categoryFilter,setCategoryFilter]=useState("Todas");
  const [busy,setBusy]=useState<string|null>(null); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [weekOffset,setWeekOffset]=useState(0);
  useEffect(()=>{fetch("/api/meta/pages",{cache:"no-store"}).then(r=>r.json()).then(d=>{setPages(d.pages||[]);if(d.pages?.length)setPageId(d.pages[0].id)}).catch(()=>{})},[]);
  const page=pages.find(p=>p.id===pageId);
  const start=useMemo(()=>{const d=new Date();d.setHours(12,0,0,0);const delta=(d.getDay()+6)%7;d.setDate(d.getDate()-delta+weekOffset*7);return d},[weekOffset]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d)}),[start]);
  const cats=useMemo(()=>["Todas",...Array.from(new Set(items.map(x=>x.category)))],[items]);
  const statuses=["Todos","Borrador","Revisión","Aprobado","Programado","Publicado","Error"];
  const visible=items.filter(x=>(statusFilter==="Todos"||x.status===statusFilter)&&(categoryFilter==="Todas"||x.category===categoryFilter));

  async function persist(item:Item){
    if(!supabase)return;
    const publishAt=`${item.date}T${item.time}:00`;
    await supabase.from("efimero_scheduled_posts").upsert({id:item.id,publish_at:publishAt,text:item.text,category:item.category,format:item.format,status:item.status,page_id:item.pageId||pageId||null,page_name:item.pageName||page?.name||null,meta_post_id:item.metaPostId||null,compliance_data:item.compliance||null,image_url:item.imageUrl||null,autopilot:Boolean((item as any).autopilot),publish_error:item.publishError||null},{onConflict:"id"});
  }
  function patch(id:string,changes:Partial<Item>){const next=items.map(x=>x.id===id?{...x,...changes}:x);onChange(next);const changed=next.find(x=>x.id===id);if(changed)void persist(changed)}
  function move(id:string,date:string){patch(id,{date,status:"Borrador"})}
  async function review(item:Item,autoFix=true){
    setBusy(item.id);setError("");setMessage("");
    try{const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:item.text})});const d=await r.json();const c=d.items?.[0];if(!r.ok||!c)throw new Error(d.error||"No se pudo revisar.");const nextText=autoFix&&c.status!=="pass"&&c.correctedText?c.correctedText:item.text;patch(item.id,{text:nextText,compliance:c,status:c.status==="pass"?"Aprobado":"Revisión"});setMessage(c.status==="pass"?"Texto aprobado por Compliance Meta.":"Texto marcado para revisión; se aplicó una corrección cuando fue posible.");}
    catch(e:any){setError(e?.message||"Falló Compliance Meta.")}finally{setBusy(null)}
  }
  async function publish(item:Item,now:boolean){
    if(!pageId){setError("Selecciona una página.");return}
    if(item.compliance?.status!=="pass"){await review(item);setError("Primero confirma que el texto quede en estado Aprobado.");return}
    const scheduledAt=now?"":new Date(`${item.date}T${item.time}:00`).toISOString();
    const action=now?"publicar ahora":"programar en Facebook";
    if(!window.confirm(`¿Confirmas ${action} en ${page?.name||"la página"}?`))return;
    setBusy(item.id);setError("");setMessage("");
    try{const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:item.text,imageDataUrl:item.imageDataUrl,imageUrl:item.imageUrl,scheduledAt,publishNow:now})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la publicación.");patch(item.id,{status:now?"Publicado":"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined,publishError:undefined});setMessage(now?"Publicación enviada a Facebook.":"Publicación programada en Facebook.");}
    catch(e:any){patch(item.id,{status:"Error",publishError:e?.message||"Error"});setError(e?.message||"No fue posible publicar.")}finally{setBusy(null)}
  }
  async function reviewAll(){
    const candidates=items.filter(x=>x.status==="Borrador"||x.status==="Revisión");if(!candidates.length){setMessage("No hay borradores pendientes de Compliance.");return}
    setBusy("batch-review");setError("");setMessage("");let next=[...items];
    try{
      for(let i=0;i<candidates.length;i+=40){
        const chunk=candidates.slice(i,i+40);const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:chunk.map(x=>x.text)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo revisar el lote.");
        const checks=d.items||[];chunk.forEach((item,index)=>{const c=checks[index];if(!c)return;const text=c.status!=="pass"&&c.correctedText?String(c.correctedText):item.text;next=next.map(x=>x.id===item.id?{...x,text,compliance:c,status:c.status==="pass"?"Aprobado":"Revisión"}:x)});
      }
      onChange(next);next.filter(x=>candidates.some(c=>c.id===x.id)).forEach(x=>void persist(x));setMessage(`${candidates.length} piezas revisadas. ${next.filter(x=>candidates.some(c=>c.id===x.id)&&x.status==="Aprobado").length} quedaron aprobadas.`);
    }catch(e:any){setError(e?.message||"Falló la revisión masiva.")}finally{setBusy(null)}
  }
  async function scheduleApproved(){
    const batch=items.filter(x=>x.status==="Aprobado");if(!batch.length){setError("No hay piezas aprobadas.");return}if(!pageId){setError("Selecciona una página.");return}if(!window.confirm(`Se intentarán programar ${batch.length} piezas en ${page?.name||"Facebook"}. ¿Continuar?`))return;
    setBusy("batch-schedule");setError("");setMessage("");let next=[...items];let ok=0,failed=0;
    for(const item of batch){
      try{const scheduledAt=new Date(`${item.date}T${item.time}:00`).toISOString();const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:item.text,imageDataUrl:item.imageDataUrl,imageUrl:item.imageUrl,scheduledAt,publishNow:false})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la programación.");next=next.map(x=>x.id===item.id?{...x,status:"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined,publishError:undefined}:x);ok++;}catch(e:any){next=next.map(x=>x.id===item.id?{...x,status:"Error",publishError:e?.message||"Error"}:x);failed++;}
    }
    onChange(next);next.filter(x=>batch.some(c=>c.id===x.id)).forEach(x=>void persist(x));setBusy(null);setMessage(`${ok} programadas${failed?` · ${failed} con error`:""}.`);
  }

  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUES 9–10 · PUBLICACIÓN + CALENDARIO</span><h1>Calendario editorial con guardrails</h1><p>Arrastra piezas entre días, revisa Compliance Meta y publica o programa únicamente contenido aprobado.</p></div><button className="outlineButton" onClick={onOpenCreator}><Sparkles size={17}/> Generar más contenido</button></div>
    <section className="calendarCommandBar">
      <label><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Estado</span><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Categoría</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{cats.map(x=><option key={x}>{x}</option>)}</select></label>
      <button onClick={reviewAll}><ShieldCheck size={17}/> Revisar borradores</button><button onClick={scheduleApproved}><CalendarDays size={17}/> Programar aprobados</button>
    </section>
    {(message||error)&&<div className={error?"calendarNotice error":"calendarNotice"}>{error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||message}</span><button onClick={()=>{setError("");setMessage("")}}>×</button></div>}
    <div className="weekNavigator"><button onClick={()=>setWeekOffset(x=>x-1)}><ChevronLeft/></button><strong>{pretty(days[0])} — {pretty(days[6])}</strong><button onClick={()=>setWeekOffset(x=>x+1)}><ChevronRight/></button></div>
    <section className="weekBoard">{days.map(date=><div className="dayColumn" key={date} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData("text/plain");if(id)move(id,date)}}><header><strong>{pretty(date)}</strong><span>{visible.filter(x=>x.date===date).length}</span></header><div className="dayDropZone">{visible.filter(x=>x.date===date).sort((a,b)=>a.time.localeCompare(b.time)).map(item=><article draggable onDragStart={e=>e.dataTransfer.setData("text/plain",item.id)} className={`calendarCard status-${item.status.toLowerCase()}`} key={item.id}><div className="calendarCardTop"><GripVertical size={16}/><input type="time" value={item.time} onChange={e=>patch(item.id,{time:e.target.value,status:"Borrador"})}/><span className="calendarStatus">{item.status}</span></div><div className="calendarTags"><span>{item.category}</span><span>{item.format}</span>{item.compliance&&<b className={item.compliance.status==="pass"?"ok":"warn"}>Compliance {item.compliance.score}/100</b>}</div><textarea value={item.text} onChange={e=>patch(item.id,{text:e.target.value,status:"Borrador",compliance:undefined})}/>{item.imageDataUrl&&<img className="calendarThumb" src={item.imageDataUrl} alt="Creatividad"/>}{item.publishError&&<small className="publishError">{item.publishError}</small>}<div className="calendarActions"><button onClick={()=>review(item)} disabled={busy===item.id}>{busy===item.id?<Loader2 className="spin" size={14}/>:<ShieldCheck size={14}/>} Revisar</button><button onClick={()=>onSaveToLibrary?.(item)}><CheckCircle2 size={14}/> Biblioteca</button><button onClick={()=>publish(item,false)} disabled={busy===item.id||item.status!=="Aprobado"}><Clock3 size={14}/> Programar</button><button onClick={()=>publish(item,true)} disabled={busy===item.id||item.status!=="Aprobado"}><Send size={14}/> Publicar</button><button className="danger" onClick={()=>onChange(items.filter(x=>x.id!==item.id))}><Trash2 size={14}/></button></div></article>)}</div></div>)}</section>
    {!items.length&&<section className="emptyState"><CalendarDays size={40}/><h2>No hay piezas en el calendario</h2><p>Genera contenido o envía textos desde Fábrica e Imágenes.</p><button onClick={onOpenCreator}><Sparkles size={18}/> Abrir generador</button></section>}
  </>
}
