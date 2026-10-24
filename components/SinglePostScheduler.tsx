"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, Globe2, ImagePlus, Loader2, Save, Send, ShieldCheck, Star, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { META_MIN_SCHEDULE_MINUTES, fetchMetaQueueSuggestion, isScheduleInFuture, localDateTime, minTimeForDate, nextAllowedSchedule, type MetaQueueSuggestion } from "@/lib/scheduling";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type Category={name:string;enabled?:boolean};
type Draft={text:string;category:string;nonce?:number}|null;
type ScheduleItem={id:string;date:string;time:string;category:string;text:string;format:"Texto"|"Imagen";status:"Borrador"|"Aprobado"|"Programado"|"Publicado"|"Error";imageDataUrl?:string;pageId?:string;pageName?:string;metaPostId?:string;compliance?:any;publishError?:string};
type Props={categories:Category[];prefill:Draft;onAdd:(item:ScheduleItem)=>void;onSaveFavorite?:(item:any)=>void};

async function compressImage(file:File){
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("No se pudo leer la imagen."));reader.onload=()=>resolve(String(reader.result||""));reader.readAsDataURL(file)});
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const node=new Image();node.onload=()=>resolve(node);node.onerror=()=>reject(new Error("La imagen no tiene un formato válido."));node.src=data});
  const max=1600;const scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.84);
}

export default function SinglePostScheduler({categories,prefill,onAdd,onSaveFavorite}:Props){
  const {pages,activePageId:pageId,setActivePage}=usePages();
  const confirm=useConfirm();
  const [text,setText]=useState("");const [category,setCategory]=useState(categories.find(x=>x.enabled!==false)?.name||"General");
  const [date,setDate]=useState("");const [time,setTime]=useState("");const [mode,setMode]=useState<"auto"|"manual">("auto");
  const [autoSuggestion,setAutoSuggestion]=useState<MetaQueueSuggestion|null>(null);const [autoBusy,setAutoBusy]=useState(false);const [autoError,setAutoError]=useState("");
  const [imageDataUrl,setImageDataUrl]=useState("");const [fileName,setFileName]=useState("");
  const [compliance,setCompliance]=useState<any>(null);const [busy,setBusy]=useState("");const [notice,setNotice]=useState("");const [error,setError]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!prefill)return;setText(prefill.text);setCategory(prefill.category||category);setDate("");setTime("");setMode("auto");setCompliance(null);setNotice("Texto recibido desde el generador. Si dejas fecha y hora vacías, Efímero lo colocará 30 min después de la última publicación de la cola de Meta.");setError("")},[prefill?.nonce]);
  const page=pages.find(x=>x.id===pageId);const timezone=useMemo(()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"Hora local",[]);
  const autoMode=!date&&!time;const manualPartial=Boolean(date||time)&&!Boolean(date&&time);const manualComplete=Boolean(date&&time);
  const validFuture=manualComplete?isScheduleInFuture(date,time,META_MIN_SCHEDULE_MINUTES):autoMode;
  const minTime=date?minTimeForDate(date,META_MIN_SCHEDULE_MINUTES):undefined;

  async function refreshAutoSuggestion(targetPageId=pageId){
    if(!targetPageId){setAutoSuggestion(null);return null}
    setAutoBusy(true);setAutoError("");
    try{const suggestion=await fetchMetaQueueSuggestion(targetPageId,30);setAutoSuggestion(suggestion);return suggestion}
    catch(e:any){setAutoSuggestion(null);setAutoError(e?.message||"No se pudo consultar la cola de Meta.");return null}
    finally{setAutoBusy(false)}
  }
  useEffect(()=>{if(pageId)void refreshAutoSuggestion(pageId)},[pageId]);

  async function pickImage(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024){setError("La imagen supera 10 MB.");return}setBusy("image");setError("");try{setImageDataUrl(await compressImage(file));setFileName(file.name)}catch(err:any){setError(err?.message||"No se pudo preparar la imagen.")}finally{setBusy("")}}
  async function review(){if(!text.trim()){setError("Escribe un texto antes de revisar Compliance.");return null}setBusy("review");setError("");try{const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});const d=await r.json();const c=d.items?.[0];if(!r.ok||!c)throw new Error(d.error||"No se pudo revisar.");setCompliance(c);if(c.status!=="pass"&&c.correctedText)setText(String(c.correctedText));setNotice(c.status==="pass"?"Compliance PASS. Ya puedes programar.":"El texto requiere ajustes antes de publicar.");return c}catch(e:any){setError(e?.message||"Falló Compliance.");return null}finally{setBusy("")}}
  async function persist(item:ScheduleItem){if(!supabase)return;const at=`${item.date}T${item.time}:00`;await supabase.from("efimero_scheduled_posts").upsert({id:item.id,publish_at:at,publish_at_utc:localDateTime(item.date,item.time).toISOString(),text:item.text,category:item.category,format:item.format,status:item.status,page_id:item.pageId||null,page_name:item.pageName||null,meta_post_id:item.metaPostId||null,compliance_data:item.compliance||null,image_url:null,publish_error:item.publishError||null},{onConflict:"id"})}
  function buildItem(status:ScheduleItem["status"]="Borrador",targetDate=date,targetTime=time):ScheduleItem{return {id:crypto.randomUUID(),date:targetDate,time:targetTime,category,text:text.trim(),format:imageDataUrl?"Imagen":"Texto",status,imageDataUrl:imageDataUrl||undefined,pageId:pageId||undefined,pageName:page?.name,compliance:compliance||undefined}}
  async function resolveTarget(){
    if(manualPartial)throw new Error("Completa fecha y hora, o deja ambos campos vacíos para usar la cola automática de Meta.");
    if(manualComplete){if(!isScheduleInFuture(date,time,META_MIN_SCHEDULE_MINUTES))throw new Error(`Elige una hora al menos ${META_MIN_SCHEDULE_MINUTES} minutos posterior a la hora actual.`);return {date,time,automatic:false}}
    const suggestion=await fetchMetaQueueSuggestion(pageId,30);setAutoSuggestion(suggestion);return {date:suggestion.date,time:suggestion.time,automatic:true};
  }
  async function saveDraft(){if(!text.trim()&&!imageDataUrl){setError("Agrega texto o una imagen.");return}const fallback=autoSuggestion||nextAllowedSchedule(20);const targetDate=date||fallback.date;const targetTime=time||fallback.time;const item=buildItem("Borrador",targetDate,targetTime);onAdd(item);await persist(item);setNotice("Borrador guardado en el Calendario.")}
  async function schedule(){if(!pageId){setError("Selecciona una página.");return}if(!text.trim()&&!imageDataUrl){setError("Agrega texto o una imagen.");return}let c=compliance;if(text.trim()&&c?.status!=="pass")c=await review();if(text.trim()&&c?.status!=="pass")return;setBusy("schedule");setError("");try{const target=await resolveTarget();const item={...buildItem("Aprobado",target.date,target.time),compliance:c||undefined};await persist(item);const scheduledAt=localDateTime(target.date,target.time).toISOString();const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:text.trim(),imageDataUrl,scheduledAt,publishNow:false,scheduledPostId:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la programación.");const done={...item,status:"Programado" as const,metaPostId:d.id||undefined};onAdd(done);await persist(done);if(target.automatic){setDate("");setTime("");void refreshAutoSuggestion(pageId)}else setMode("manual");setNotice(`${target.automatic?"Programación automática":"Programado"} en ${page?.name||"Facebook"} para ${target.date} ${target.time}.`)}catch(e:any){setError(e?.message||"No fue posible programar.")}finally{setBusy("")}}
  async function publishNow(){if(!pageId){setError("Selecciona una página.");return}if(!text.trim()&&!imageDataUrl){setError("Agrega texto o una imagen.");return}let c=compliance;if(text.trim()&&c?.status!=="pass")c=await review();if(text.trim()&&c?.status!=="pass")return;if(!await confirm({title:"¿Publicar ahora?",description:`Página: ${page?.name||"Facebook"}\n${imageDataUrl?"Publicación con imagen. ":""}Se publicará de inmediato, sin programación.`,confirmLabel:"Publicar ahora"}))return;setBusy("publish");setError("");try{const now=new Date();const item={...buildItem("Aprobado"),date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`,time:`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`,compliance:c||undefined};await persist(item);const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:text.trim(),imageDataUrl,publishNow:true,scheduledPostId:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la publicación.");const done={...item,status:"Publicado" as const,metaPostId:d.id||undefined};onAdd(done);await persist(done);setNotice("Publicado correctamente.")}catch(e:any){setError(e?.message||"No fue posible publicar.")}finally{setBusy("")}}

  function chooseMode(next:"auto"|"manual"){
    setMode(next);
    if(next==="auto"){setDate("");setTime("");void refreshAutoSuggestion(pageId);return}
    if(!date||!time){const base=autoSuggestion||nextAllowedSchedule(META_MIN_SCHEDULE_MINUTES);setDate(base.date);setTime(base.time)}
  }
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  const scheduleWarn=manualPartial||Boolean(autoError)||(!autoMode&&!validFuture);
  const scheduleLabel=manualPartial?"Completa la fecha y la hora."
    :autoMode?(autoBusy?"Consultando la cola real de Meta…":autoError||(autoSuggestion?`${autoSuggestion.count?`Después de ${autoSuggestion.count} programadas`:"La cola está vacía"} · ${autoSuggestion.date} ${autoSuggestion.time}`:"Al programar, Efímero buscará el siguiente hueco libre en Meta."))
    :validFuture?`Se publicará el ${date} a las ${time}.`:`Esa hora ya pasó o está muy cerca. Usa ${nextAllowedSchedule(META_MIN_SCHEDULE_MINUTES).time} o después.`;
  const previewWhen=autoMode?(autoSuggestion?`${autoSuggestion.date} · ${autoSuggestion.time}`:"Siguiente hueco"):`${date||"Fecha"} · ${time||"hora"}`;

  return <>
    <div className="pageIntro"><div><span className="overline">PROGRAMADOR INDIVIDUAL</span><h1>Programa un post</h1><p>Escribe, revisa cómo se verá y elige cuándo sale. Nunca se usa un horario anterior al momento actual.</p></div><div className="timezoneBadge"><Clock3 size={16}/><span>{timezone}</span></div></div>
    <section className="postComposer">
      <div className="composerCard">
        <div className="composerToolbar">
          <label><span>Publicar en</span><select value={pageId} onChange={e=>void setActivePage(e.target.value)}><option value="">Selecciona una página…</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
          <label><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.filter(x=>x.enabled!==false).map(c=><option key={c.name}>{c.name}</option>)}</select></label>
        </div>
        <textarea className="composerText" aria-label="Texto de la publicación" value={text} onChange={e=>{setText(e.target.value);setCompliance(null)}} placeholder="¿Qué quieres publicar hoy?"/>
        {imageDataUrl&&<div className="composerImage"><img src={imageDataUrl} alt="Imagen adjunta"/><button type="button" onClick={()=>{setImageDataUrl("");setFileName("")}} aria-label="Quitar imagen"><X size={15}/></button></div>}
        <div className="composerFooter">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} hidden/>
          <button type="button" className="uiBtn uiBtnGhost" onClick={()=>fileRef.current?.click()} disabled={busy==="image"}>{busy==="image"?<Loader2 className="spin" size={16}/>:<ImagePlus size={16}/>} {fileName?"Cambiar foto":"Agregar foto"}</button>
          <span className="composerCount">{words} palabras · {text.length} caracteres</span>
        </div>
        <div className="composerCompliance">
          <div><ShieldCheck size={16}/><span>{compliance?<><b className={compliance.status==="pass"?"tone-success":"tone-danger"}>{String(compliance.status).toUpperCase()} · {Math.round(Number(compliance.score||0))}/100</b> {compliance.summary||"Revisión completada."}</>:"Compliance sin revisar. Se revisa automáticamente al programar."}</span></div>
          <button type="button" className="uiBtn uiBtnGhost" onClick={review} disabled={busy==="review"}>{busy==="review"?<Loader2 className="spin" size={16}/>:null} Revisar</button>
        </div>
      </div>

      <aside className="composerSide">
        <section className="fbPreview" aria-label="Vista previa">
          <div className="fbPreviewHead"><span className="fbAvatar">{(page?.name||"?").charAt(0).toUpperCase()}</span><div><strong>{page?.name||"Tu página"}</strong><small>{previewWhen} · <Globe2 size={11}/></small></div></div>
          <p className={text?"":"placeholder"}>{text||"Aquí verás tu publicación tal como aparecerá en Facebook."}</p>
          {imageDataUrl&&<img src={imageDataUrl} alt=""/>}
        </section>

        <section className="scheduleCard">
          <div className="scheduleCardHead"><strong>Programación</strong><span>Meta pide al menos {META_MIN_SCHEDULE_MINUTES} min de anticipación.</span></div>
          <div className="segmented" role="radiogroup" aria-label="Cuándo publicar">
            <button type="button" role="radio" aria-checked={mode==="auto"} className={mode==="auto"?"active":""} onClick={()=>chooseMode("auto")}>Siguiente hueco</button>
            <button type="button" role="radio" aria-checked={mode==="manual"} className={mode==="manual"?"active":""} onClick={()=>chooseMode("manual")}>Fecha específica</button>
          </div>
          {mode==="manual"&&<div className="fieldRow"><label><span>Fecha</span><input type="date" min={nextAllowedSchedule(META_MIN_SCHEDULE_MINUTES).date} value={date} onChange={e=>setDate(e.target.value)}/></label><label><span>Hora</span><input type="time" min={minTime} value={time} onChange={e=>setTime(e.target.value)}/></label></div>}
          <div className={scheduleWarn?"scheduleValidity warn":"scheduleValidity ok"}>{scheduleWarn?<Clock3 size={16}/>:autoBusy?<Loader2 className="spin" size={16}/>:<CheckCircle2 size={16}/>}<span>{scheduleLabel}</span></div>
          <div className="scheduleActions">
            <button className="uiBtn uiBtnPrimary" onClick={schedule} disabled={busy==="schedule"||manualPartial||(!autoMode&&!validFuture)}>{busy==="schedule"?<Loader2 className="spin" size={16}/>:<CalendarClock size={16}/>} Programar</button>
            <div><button className="uiBtn uiBtnSecondary" onClick={saveDraft}><Save size={16}/> Borrador</button><button className="uiBtn uiBtnSecondary" onClick={publishNow} disabled={busy==="publish"}>{busy==="publish"?<Loader2 className="spin" size={16}/>:<Send size={16}/>} Publicar ya</button></div>
            {onSaveFavorite&&text.trim()&&<button className="linkButton" onClick={()=>onSaveFavorite({id:crypto.randomUUID(),text:text.trim(),category,format:imageDataUrl?"Imagen":"Texto",createdAt:new Date().toISOString(),source:"manual",favorite:true})}><Star size={14}/> Guardar en favoritos</button>}
          </div>
          {(notice||error)&&<div className={error?"quickNotice error":"quickNotice"}>{error||notice}</div>}
        </section>
      </aside>
    </section>
  </>
}
