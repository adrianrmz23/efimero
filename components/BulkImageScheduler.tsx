"use client";

import { formatPageLabel } from "@/lib/pageLabels";
import type { CreativeQueueItem } from "@/lib/creativeStudio";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, Clock3, ImagePlus, Loader2, RefreshCw, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { META_MIN_SCHEDULE_MINUTES, fetchMetaQueueSuggestion, localDateString, localTimeString, type MetaQueueSuggestion } from "@/lib/scheduling";
import { persistWorkingPage, resolveWorkingPageId, WORKING_PAGE_EVENT } from "@/lib/workingPage";

type Page={id:string;name:string;followers_count?:number|null;fan_count?:number|null};
type ItemStatus="ready"|"scheduling"|"scheduled"|"error";
type BulkImageItem={
  id:string;
  fileName:string;
  previewUrl:string;
  dataUrl:string;
  date:string;
  time:string;
  status:ItemStatus;
  error?:string;
  metaPostId?:string;
  scheduleId?:string;
  sourceText?:string;
  caption?:string;
  originPageId?:string;
};
type CalendarItem={id:string;date:string;time:string;category:string;text:string;format:"Imagen";status:"Programado"|"Error";imageDataUrl?:string;pageId?:string;pageName?:string;metaPostId?:string;publishError?:string};
type Props={onAddMany:(items:CalendarItem[])=>void; importedCreatives?:CreativeQueueItem[];onImported?:()=>void};

const pad=(n:number)=>String(n).padStart(2,"0");
const minutesFromTime=(value:string)=>{const [h,m]=value.split(":").map(Number);return (h||0)*60+(m||0)};
const timeFromMinutes=(value:number)=>`${pad(Math.floor(value/60)%24)}:${pad(value%60)}`;
const atLocalTime=(date:Date,time:string)=>{const [h,m]=time.split(":").map(Number);const next=new Date(date);next.setHours(h||0,m||0,0,0);return next};
const prettyDateTime=(date:string,time:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(`${date}T${time}:00`));

function roundUp(date:Date,minutes=5){
  const next=new Date(date);next.setSeconds(0,0);
  const remainder=next.getMinutes()%minutes;
  if(remainder)next.setMinutes(next.getMinutes()+(minutes-remainder));
  return next;
}

function fitIntoWindow(candidate:Date,windowStart:string,windowEnd:string){
  const startMin=minutesFromTime(windowStart);const endMin=minutesFromTime(windowEnd);
  const minute=candidate.getHours()*60+candidate.getMinutes();
  if(minute<startMin)return atLocalTime(candidate,windowStart);
  if(minute<=endMin)return candidate;
  const tomorrow=new Date(candidate);tomorrow.setDate(tomorrow.getDate()+1);return atLocalTime(tomorrow,windowStart);
}

function buildSlots(count:number,interval:number,windowStart:string,windowEnd:string,customStart:string,now=new Date()){
  if(count<=0)return [] as {date:string;time:string}[];
  const minDate=new Date(now.getTime()+META_MIN_SCHEDULE_MINUTES*60_000);
  let cursor=customStart?new Date(customStart):roundUp(minDate,5);
  if(Number.isNaN(cursor.getTime())||cursor<minDate)cursor=roundUp(minDate,5);
  cursor=fitIntoWindow(cursor,windowStart,windowEnd);
  const result:{date:string;time:string}[]=[];
  const endMin=minutesFromTime(windowEnd);
  for(let i=0;i<count;i++){
    cursor=fitIntoWindow(cursor,windowStart,windowEnd);
    result.push({date:localDateString(cursor),time:localTimeString(cursor)});
    const next=new Date(cursor.getTime()+interval*60_000);
    const nextMinute=next.getHours()*60+next.getMinutes();
    if(localDateString(next)!==localDateString(cursor)||nextMinute>endMin){
      const tomorrow=new Date(cursor);tomorrow.setDate(tomorrow.getDate()+1);cursor=atLocalTime(tomorrow,windowStart);
    }else cursor=next;
  }
  return result;
}

async function compressImage(file:File){
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error(`No se pudo leer ${file.name}.`));reader.onload=()=>resolve(String(reader.result||""));reader.readAsDataURL(file)});
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const node=new Image();node.onload=()=>resolve(node);node.onerror=()=>reject(new Error(`${file.name} no parece una imagen válida.`));node.src=source});
  const max=1800;const scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("No fue posible preparar la imagen.");context.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.84);
}

export default function BulkImageScheduler({onAddMany,importedCreatives,onImported}:Props){
  const [pages,setPages]=useState<Page[]>([]);const [pageId,setPageId]=useState("");
  const [items,setItems]=useState<BulkImageItem[]>([]);const [interval,setInterval]=useState(30);
  const [windowStart,setWindowStart]=useState("08:00");const [windowEnd,setWindowEnd]=useState("23:30");
  const [customStart,setCustomStart]=useState("");const [caption,setCaption]=useState("");
  const [queueSuggestion,setQueueSuggestion]=useState<MetaQueueSuggestion|null>(null);const [queueBusy,setQueueBusy]=useState(false);const [queueError,setQueueError]=useState("");
  const [busy,setBusy]=useState(false);const [reading,setReading]=useState(false);const [notice,setNotice]=useState("");const [error,setError]=useState("");
  const inputRef=useRef<HTMLInputElement>(null);
  const page=pages.find(p=>p.id===pageId);const timezone=useMemo(()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"Hora local",[]);
  const effectiveStart=customStart||queueSuggestion?.value||"";
  const slots=useMemo(()=>buildSlots(items.length,Math.max(5,interval),windowStart,windowEnd,effectiveStart),[items.length,interval,windowStart,windowEnd,effectiveStart]);
  const scheduledCount=items.filter(x=>x.status==="scheduled").length;const failedCount=items.filter(x=>x.status==="error").length;
  const dates=useMemo(()=>Array.from(new Set(slots.map(x=>x.date))),[slots]);
  const invalidWindow=minutesFromTime(windowEnd)<=minutesFromTime(windowStart);

  useEffect(()=>{
    const onWorkingPage=(event:Event)=>{const value=(event as CustomEvent<{pageId:string}>).detail?.pageId;if(value)setPageId(value)};
    window.addEventListener(WORKING_PAGE_EVENT,onWorkingPage);
    fetch("/api/meta/pages",{cache:"no-store"}).then(r=>r.json()).then(d=>{const list=d.pages||[];setPages(list);if(list.length)setPageId(resolveWorkingPageId(list,d.activePageId))}).catch(()=>{});
    return()=>window.removeEventListener(WORKING_PAGE_EVENT,onWorkingPage);
  },[]);

  // An in-memory transfer avoids localStorage limits and keeps drafts private to the selected page.
  useEffect(()=>{
    if(!importedCreatives?.length)return;
    const origin=importedCreatives[0].pageId;
    if(!origin||importedCreatives.some(x=>x.pageId!==origin)){
      setError("El lote contiene páginas distintas. Sepáralas antes de programar.");onImported?.();return;
    }
    setPageId(origin);
    setItems(current=>{
      const seen=new Set(current.map(x=>x.id));
      return [...current,...importedCreatives.filter(x=>!seen.has(x.id)).map(x=>({id:x.id,fileName:x.fileName,previewUrl:x.dataUrl,dataUrl:x.dataUrl,date:"",time:"",status:"ready" as ItemStatus,sourceText:x.sourceText,caption:x.caption,originPageId:origin}))].slice(0,100);
    });
    setNotice(`${importedCreatives.length} creatividades del Estudio importadas. Revisa los horarios y confirma manualmente.`);
    onImported?.();
  },[importedCreatives,onImported]);

  async function refreshQueueSuggestion(targetPageId=pageId,targetInterval=interval){
    if(!targetPageId||customStart){setQueueSuggestion(null);setQueueError("");return null}
    setQueueBusy(true);setQueueError("");
    try{const suggestion=await fetchMetaQueueSuggestion(targetPageId,Math.max(5,targetInterval));setQueueSuggestion(suggestion);return suggestion}
    catch(e:any){setQueueSuggestion(null);setQueueError(e?.message||"No se pudo consultar la cola de Meta.");return null}
    finally{setQueueBusy(false)}
  }
  useEffect(()=>{if(pageId&&!customStart)void refreshQueueSuggestion(pageId,interval)},[pageId,interval,customStart]);

  useEffect(()=>{setItems(current=>current.map((item,index)=>item.status==="scheduled"?item:{...item,date:slots[index]?.date||item.date,time:slots[index]?.time||item.time}))},[slots.map(x=>`${x.date}-${x.time}`).join("|")]);

  async function pickFiles(event:ChangeEvent<HTMLInputElement>){
    const files=Array.from(event.target.files||[]);event.target.value="";if(!files.length)return;
    const imageFiles=files.filter(file=>/^image\/(jpeg|png|webp)$/i.test(file.type));
    if(imageFiles.length!==files.length)setNotice("Algunos archivos se omitieron porque no eran JPG, PNG o WebP.");
    if(!imageFiles.length)return;
    if(items.length+imageFiles.length>100){setError("Puedes preparar hasta 100 imágenes por lote.");return}
    setReading(true);setError("");
    try{
      const prepared:BulkImageItem[]=[];
      for(const file of imageFiles){
        if(file.size>15*1024*1024){setNotice(`${file.name} se omitió porque supera 15 MB.`);continue}
        const dataUrl=await compressImage(file);prepared.push({id:crypto.randomUUID(),fileName:file.name,previewUrl:dataUrl,dataUrl,date:"",time:"",status:"ready"});
      }
      setItems(current=>[...current,...prepared]);
    }catch(err:any){setError(err?.message||"No fue posible preparar todas las imágenes.")}finally{setReading(false)}
  }

  function removeItem(id:string){if(busy)return;setItems(current=>current.filter(x=>x.id!==id))}
  function clearQueue(){if(busy)return;if(items.some(x=>x.status==="scheduled")&&!window.confirm("Esto solo limpiará la vista del lote. NO cancela publicaciones que Facebook ya tiene programadas. Para cancelarlas usa ‘Cola Meta’. ¿Continuar?"))return;setItems([]);setNotice("");setError("")}
  function resetFailures(){setItems(current=>current.map(x=>x.status==="error"?{...x,status:"ready" as const,error:undefined}:x));setError("")}

  async function persistScheduled(item:BulkImageItem,status:"Programado"|"Error",message:string,metaPostId?:string,publishError?:string){
    const id=item.scheduleId||crypto.randomUUID();
    if(supabase){await supabase.from("efimero_scheduled_posts").upsert({id,publish_at:`${item.date}T${item.time}:00`,publish_at_utc:new Date(`${item.date}T${item.time}:00`).toISOString(),text:message,category:"Bulk visual",format:"Imagen",status,page_id:pageId||null,page_name:page?.name||null,meta_post_id:metaPostId||null,compliance_data:item.sourceText?{source:"creative_studio_v1.9",embedded_text:item.sourceText,reviewed_at:new Date().toISOString()}:null,image_url:null,publish_error:publishError||null},{onConflict:"id"})}
    return id;
  }

  async function scheduleAll(retryOnly=false){
    if(!pageId){setError("Selecciona una página de Facebook.");return}
    if(items.some(x=>x.originPageId&&x.originPageId!==pageId)){setError("El lote incluye creatividades de otra página. Elige la página de origen o elimina esas piezas.");return}
    if(invalidWindow){setError("La hora de fin debe ser posterior a la hora de inicio.");return}
    let freshStart=customStart;
    if(!freshStart){
      try{const suggestion=await fetchMetaQueueSuggestion(pageId,Math.max(5,interval));setQueueSuggestion(suggestion);freshStart=suggestion.value}
      catch(err:any){setError(err?.message||"No fue posible consultar la cola de Meta antes de programar.");return}
    }
    const freshSlots=buildSlots(items.length,Math.max(5,interval),windowStart,windowEnd,freshStart,new Date());
    const planned=items.map((item,index)=>item.status==="scheduled"?item:{...item,date:freshSlots[index]?.date||item.date,time:freshSlots[index]?.time||item.time});
    setItems(planned);
    const targets=planned.filter(x=>retryOnly?x.status==="error":x.status==="ready"||x.status==="error");
    if(!targets.length){setNotice("No hay imágenes pendientes por programar.");return}
    if(!window.confirm(`¿Programar ${targets.length} imágenes en ${page?.name||"Facebook"} con separación de ${interval} minutos? Confirma que revisaste visualmente las imágenes y que tienes derecho a publicarlas.`))return;
    setBusy(true);setError("");setNotice("");
    const calendarItems:CalendarItem[]=[];let ok=0;let failed=0;
    for(const target of targets){
      const latest=planned.find(x=>x.id===target.id)||target;
      setItems(current=>current.map(x=>x.id===target.id?{...x,status:"scheduling"}:x));
      try{
        if(latest.originPageId&&latest.originPageId!==pageId)throw new Error("La creatividad pertenece a otra página. No se puede programar aquí.");
        // Re-check actual text embedded in generated creatives, not only optional Facebook caption.
        if(latest.sourceText){
          const review=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:latest.sourceText})});
          const result=await review.json();const check=result.items?.[0];
          if(!review.ok||!check)throw new Error(result.error||"No se pudo verificar Compliance.");
          if(check.status!=="pass")throw new Error(`Compliance ${String(check.status).toUpperCase()}: ${check.issues?.[0]?.message||"el texto necesita revisión"}. Corrígelo en Estudio Creativo y vuelve a generar la imagen.`);
        }
        const scheduledAt=new Date(`${latest.date}T${latest.time}:00`).toISOString();
        const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:(latest.caption?.trim()||caption.trim()),imageDataUrl:latest.dataUrl,scheduledAt,publishNow:false})});
        const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la programación.");
        const scheduleId=await persistScheduled(latest,"Programado",(latest.caption?.trim()||caption.trim()),d.id||undefined);
        setItems(current=>current.map(x=>x.id===target.id?{...x,status:"scheduled",metaPostId:d.id||undefined,scheduleId,error:undefined}:x));
        calendarItems.push({id:scheduleId,date:latest.date,time:latest.time,category:"Bulk visual",text:(latest.caption?.trim()||caption.trim()),format:"Imagen",status:"Programado",pageId,pageName:page?.name,metaPostId:d.id||undefined});ok++;
      }catch(err:any){
        const message=err?.message||"No se pudo programar.";const scheduleId=await persistScheduled(latest,"Error",(latest.caption?.trim()||caption.trim()),undefined,message).catch(()=>latest.scheduleId||crypto.randomUUID());
        setItems(current=>current.map(x=>x.id===target.id?{...x,status:"error",error:message,scheduleId}:x));failed++;
      }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(calendarItems.length)onAddMany(calendarItems);
    setNotice(`${ok} imágenes programadas${failed?` · ${failed} con error`:""}.`);setBusy(false);
  }

  const pendingCount=items.filter(x=>x.status!=="scheduled").length||items.length;
  const queueText=queueBusy?"Consultando la cola real de Meta…":queueError||(queueSuggestion?`${queueSuggestion.count?`Continúa ${interval} min después de la última publicación en Meta`:"Meta no tiene cola pendiente; empieza en el siguiente horario válido"}.`:"Antes de programar se consulta Meta para continuar al final de la cola.");

  return <>
    <div className="pageIntro"><div><span className="overline">PROGRAMACIÓN VISUAL MASIVA</span><h1>Imágenes en bulk</h1><p>Sube un lote, define el ritmo y Efímero reparte las publicaciones por días, sin horarios pasados.</p></div><div className="timezoneBadge"><Clock3 size={16}/><span>{timezone}</span></div></div>

    <section className="settingsBar" aria-label="Ajustes del lote">
      <label className="settingsPage"><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);void persistWorkingPage(e.target.value)}}><option value="">Selecciona…</option>{pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>)}</select></label>
      <div className="settingsField"><span>Publicar cada</span><div className="segmented compact">{[30,45,60,90].map(value=><button type="button" key={value} className={interval===value?"active":""} onClick={()=>setInterval(value)}>{value} min</button>)}<input aria-label="Minutos personalizados" type="number" min={5} max={720} step={5} value={interval} onChange={e=>setInterval(Math.max(5,Number(e.target.value)||5))}/></div></div>
      <div className="settingsField"><span>Ventana diaria</span><div className="timeRange"><input aria-label="Desde" type="time" value={windowStart} onChange={e=>setWindowStart(e.target.value)}/><ArrowRight size={14}/><input aria-label="Hasta" type="time" value={windowEnd} onChange={e=>setWindowEnd(e.target.value)}/></div></div>
      <label><span>Empezar <small>opcional</small></span><input type="datetime-local" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label>
      <details className="settingsCaption"><summary>Texto común {caption.trim()?<b>· agregado</b>:<small>opcional</small>}</summary><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Déjalo vacío para publicar solo las imágenes."/></details>
    </section>
    {invalidWindow&&<div className="bulkWarning"><AlertTriangle size={15}/> La hora de fin debe ser posterior a la de inicio.</div>}
    {!customStart&&!invalidWindow&&<p className={queueError?"settingsHint warn":"settingsHint"}>{queueError?<AlertTriangle size={14}/>:queueBusy?<Loader2 className="spin" size={14}/>:<Check size={14}/>}{queueText} Si el día se termina, sigue al día siguiente desde {windowStart}.</p>}

    <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={pickFiles} hidden/>
    {!items.length?<button className="bulkDropZone" onClick={()=>inputRef.current?.click()} disabled={reading||busy}>
      {reading?<Loader2 className="spin" size={28}/>:<Upload size={28}/>}<span><strong>{reading?"Preparando imágenes…":"Arrastra o selecciona tus imágenes"}</strong><small>JPG, PNG o WebP · hasta 100 por lote · el orden de subida es el orden de publicación</small></span>
    </button>:<section className="bulkPreviewCard">
      <div className="bulkSectionHead"><div><h2>{items.length} {items.length===1?"imagen":"imágenes"} en el lote</h2><p>{dates.length} {dates.length===1?"día":"días"} · {scheduledCount} programadas{failedCount?` · ${failedCount} con error`:""}</p></div><div className="bulkHeadActions"><button className="uiBtn uiBtnSecondary" onClick={()=>inputRef.current?.click()} disabled={reading||busy||items.length>=100}>{reading?<Loader2 className="spin" size={16}/>:<ImagePlus size={16}/>} Agregar</button><button className="uiBtn uiBtnGhost" onClick={clearQueue} disabled={busy}><Trash2 size={16}/> Limpiar</button></div></div>
      <div className="bulkImageGrid">{items.map((item,index)=><article className={`bulkImageTile ${item.status}`} key={item.id}><div className="bulkImageThumb"><img src={item.previewUrl} alt={item.fileName}/><span className="bulkOrder">{index+1}</span>{!busy&&item.status!=="scheduled"&&<button className="bulkRemove" onClick={()=>removeItem(item.id)} aria-label={`Quitar ${item.fileName}`}><X size={15}/></button>}</div><div className="bulkTileBody"><strong title={item.fileName}>{item.fileName}</strong><span><CalendarClock size={13}/>{item.date&&item.time?prettyDateTime(item.date,item.time):"Calculando…"}</span>{item.sourceText&&<small title={item.sourceText} className="creativeImportedTag">Desde Estudio · texto revisable</small>}{item.status==="scheduled"&&<em className="bulkState ok"><CheckCircle2 size={13}/> Programada</em>}{item.status==="scheduling"&&<em className="bulkState"><Loader2 className="spin" size={13}/> Programando</em>}{item.status==="error"&&<em className="bulkState error" title={item.error}><AlertTriangle size={13}/> Error</em>}{item.status==="error"&&item.error&&<small className="bulkErrorText" title={item.error}>{item.error}</small>}</div></article>)}</div>
    </section>}

    {!!items.length&&<div className="actionBar">
      <div className="actionBarSummary">{slots[0]?<><span><small>Primera</small><strong>{prettyDateTime(slots[0].date,slots[0].time)}</strong></span><ArrowRight size={14}/><span><small>Última</small><strong>{prettyDateTime(slots[slots.length-1].date,slots[slots.length-1].time)}</strong></span></>:<span><small>Plan</small><strong>Calculando horarios…</strong></span>}</div>
      {(notice||error)&&<div className={error?"actionBarNotice error":"actionBarNotice"}>{error||notice}</div>}
      <div className="actionBarButtons">
        {failedCount>0&&<button className="uiBtn uiBtnSecondary" disabled={busy} onClick={()=>{resetFailures();setTimeout(()=>void scheduleAll(true),0)}}><RefreshCw size={16}/> Reintentar fallidas</button>}
        {scheduledCount===items.length&&<button className="uiBtn uiBtnSecondary" disabled={busy} onClick={clearQueue}><RotateCcw size={16}/> Otro lote</button>}
        <button className="uiBtn uiBtnPrimary" disabled={busy||reading||!items.length||invalidWindow||scheduledCount===items.length} onClick={()=>void scheduleAll(false)}>{busy?<Loader2 className="spin" size={16}/>:<CalendarClock size={16}/>} {busy?"Programando…":`Programar ${pendingCount}`}</button>
      </div>
    </div>}
    {!items.length&&(notice||error)&&<div className={error?"quickNotice error":"quickNotice"}>{error||notice}</div>}
  </>
}
