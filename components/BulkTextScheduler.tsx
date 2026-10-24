"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock3, Loader2, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { formatPageLabel } from "@/lib/pageLabels";
import { planBulkTextSlots, parseBulkTexts } from "@/lib/bulkTextSlots";
import { fetchMetaQueueSuggestion, META_MIN_SCHEDULE_MINUTES } from "@/lib/scheduling";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";
import { supabase } from "@/lib/supabase";

type ItemStatus = "pending" | "sending" | "scheduled" | "failed";
type Review = {status:string;summary?:string;correctedText?:string;issues?:{message:string}[];score?:number};
type Result = {index:number; status:ItemStatus; metaId?:string;error?:string;scheduleId?:string};
type CalendarItem = {id:string;date:string;time:string;category:string;text:string;format:"Texto";status:"Programado";pageId?:string;pageName?:string;metaPostId?:string;compliance?:Review};

type Props={onAddMany?:(items:CalendarItem[])=>void};
const example = "Hoy también mereces un momento de calma.\n\n---\n\nHay canciones que nos llevan a lugares que ya no existen.\n\n---\n\nLa vida adulta es decidir qué cocinar todos los días.";

export default function BulkTextScheduler({onAddMany}:Props){
  const {pages,activePageId:pageId,setActivePage}=usePages();
  const confirm=useConfirm();
  const [input,setInput]=useState("");
  const [gap,setGap]=useState(45);
  const [dayStart,setDayStart]=useState("08:00");
  const [dayEnd,setDayEnd]=useState("23:00");
  const [manualStart,setManualStart]=useState("");
  const [suggestion,setSuggestion]=useState("");
  const [loadingQueue,setLoadingQueue]=useState(false);
  const [reviewing,setReviewing]=useState(false);
  const [sending,setSending]=useState(false);
  const [reviews,setReviews]=useState<Review[]|null>(null);
  const [results,setResults]=useState<Result[]>([]);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const page=pages.find(p=>p.id===pageId);
  const texts=useMemo(()=>parseBulkTexts(input),[input]);
  const duplicateCount=useMemo(()=>texts.length-new Set(texts.map(s=>s.toLowerCase().replace(/\s+/g," ").trim())).size,[texts]);
  const validInput=texts.length>0&&texts.length<=40&&texts.every(t=>t.length<=5000)&&duplicateCount===0;
  const reviewed = reviews !== null && reviews.length === texts.length;
  const passes=reviewed&&reviews!.every(r=>r.status==="pass");
  const start=manualStart||suggestion;
  const planned=useMemo(()=>{
    try {if(!start||!validInput)return {slots:[],error:""};return {slots:planBulkTextSlots(texts.length,new Date(start),gap,dayStart,dayEnd),error:""};}
    catch(e:any){return {slots:[],error:e?.message||"Horarios inválidos"};}
  },[start,gap,dayStart,dayEnd,validInput,texts.length]);
  const done=results.filter(x=>x.status==="scheduled").length;
  const failures=results.filter(x=>x.status==="failed").length;
  const locked=results.some(x=>x.status==="scheduled"||x.status==="failed");

  useEffect(()=>{setSuggestion("");setReviews(null);setResults([]);},[pageId]);
  useEffect(()=>{if(pageId)void refreshQueue(pageId)},[pageId,gap]);

  async function refreshQueue(id=pageId){
    if(!id)return;
    setLoadingQueue(true);setError("");
    try{const next=await fetchMetaQueueSuggestion(id,gap);setSuggestion(next.value)}
    catch(e:any){setSuggestion("");setError(e?.message||"No se pudo consultar la cola de Meta.")}
    finally{setLoadingQueue(false)}
  }
  function changeText(value:string){if(locked)return;setInput(value);setReviews(null);setResults([]);setMessage("");setError("")}
  async function newBatch(){
    if(!await confirm({title:"¿Preparar un nuevo lote?",description:"Las publicaciones del lote anterior seguirán programadas en Meta. Solo se limpia esta vista.",confirmLabel:"Nuevo lote"}))return;
    setInput("");setReviews(null);setResults([]);setMessage("");setError("");setManualStart("");
  }
  async function reviewAll(){
    if(!validInput){setError("Corrige los textos antes de revisar. Máximo 40, sin duplicados ni más de 5,000 caracteres cada uno.");return;}
    setReviewing(true);setError("");setMessage("");setReviews(null);
    try{
      const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!Array.isArray(d.items)||d.items.length!==texts.length)throw new Error(d.error||"Revisión incompleta.");
      setReviews(d.items);
      setMessage(d.items.every((x:Review)=>x.status==="pass")?"Todos los textos tienen Compliance PASS.":"Algunos textos necesitan revisión. Edítalos y ejecuta la revisión otra vez.");
    }catch(e:any){setError(e?.message||"No se pudo revisar el lote.")}
    finally{setReviewing(false)}
  }
  function removeAt(index:number){changeText(texts.filter((_,i)=>i!==index).join("\n\n---\n\n"))}
  function replaceAt(index:number,text:string){changeText(texts.map((t,i)=>i===index?text:t).join("\n\n---\n\n"))}
  async function persist(record:Record<string,unknown>){
    if(!supabase)throw new Error("Configura Supabase para registrar cada programación.");
    const {error:dbError}=await supabase.from("efimero_scheduled_posts").upsert(record,{onConflict:"id"});
    if(dbError)throw new Error(`No se pudo registrar el post en Supabase: ${dbError.message}`);
  }
  async function scheduleAll(){
    if(!pageId||!page||!validInput||!passes){setError("Selecciona una página y revisa todos los textos antes de programar.");return;}
    if(locked){setError("Este lote ya fue enviado o tiene fallos. Verifica la Cola Meta y comienza un nuevo lote.");return;}
    if(!supabase){setError("Configura Supabase antes de publicar.");return;}
    // Recalcular con la cola real justo antes de enviar; no confiar en una vista previa obsoleta.
    let startValue=manualStart;
    if(!startValue){
      try{const next=await fetchMetaQueueSuggestion(pageId,gap);startValue=next.value;setSuggestion(next.value)}
      catch(e:any){setError(e?.message||"Meta no respondió. No se programó nada.");return}
    }
    let freshSlots:ReturnType<typeof planBulkTextSlots>;
    try{freshSlots=planBulkTextSlots(texts.length,new Date(startValue),gap,dayStart,dayEnd)}
    catch(e:any){setError(e?.message||"El calendario contiene horarios inválidos.");return}
    if(!await confirm({
      title:`¿Programar ${texts.length} textos?`,
      description:`Página: ${page.name} (ID …${page.id.slice(-6)})\nPrimer horario: ${freshSlots[0]?.date} ${freshSlots[0]?.time}\nÚltimo horario: ${freshSlots[freshSlots.length-1]?.date} ${freshSlots[freshSlots.length-1]?.time}\nSe enviarán a Meta. No se publicarán ahora.`,
      confirmLabel:`Programar ${texts.length}`,
    }))return;
    setSending(true);setError("");setMessage("");
    const nextResults:Result[]=[];
    const completed:CalendarItem[]=[];
    for(let i=0;i<texts.length;i++){
      const slot=freshSlots[i];const id=crypto.randomUUID();
      setResults([...nextResults,{index:i,status:"sending"}]);
      const record={id,publish_at:`${slot.date}T${slot.time}:00`,publish_at_utc:slot.timestamp,text:texts[i],category:"Bulk textos",format:"Texto",status:"Aprobado",page_id:pageId,page_name:page.name,meta_post_id:null,compliance_data:reviews![i],image_url:null,publish_error:null};
      try{
        await persist(record);
        const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:texts[i],scheduledAt:slot.timestamp,publishNow:false,scheduledPostId:id})});
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d?.ok)throw new Error(d.error||`Meta rechazó la programación (${r.status}).`);
        const metaId=String(d.id||"");
        nextResults.push({index:i,status:"scheduled",metaId,scheduleId:id});
        completed.push({id,date:slot.date,time:slot.time,category:"Bulk textos",text:texts[i],format:"Texto",status:"Programado",pageId,pageName:page.name,metaPostId:metaId,compliance:reviews![i]});
        // Si falla el registro local posterior, NO repetir la publicación: Meta ya aceptó.
        try{await persist({...record,status:"Programado",meta_post_id:metaId})}catch(e:any){setMessage("Meta confirmó programación, pero hubo problemas de sincronización local; revisa la Cola Meta.")}
      }catch(e:any){
        nextResults.push({index:i,status:"failed",error:e?.message||"Error al programar; verifica Meta antes de reintentar.",scheduleId:id});
        try{await persist({...record,status:"Error",publish_error:e?.message||"Error de programación"})}catch{}
      }
      setResults([...nextResults]);
    }
    onAddMany?.(completed);
    setSending(false);
    setMessage(`${completed.length} de ${texts.length} publicaciones confirmadas en Meta. ${texts.length-completed.length} pendientes o fallidas. Antes de repetir un envío, revisa la Cola Meta.`);
    void refreshQueue(pageId);
  }
  const lock=sending||locked;
  const first=planned.slots[0],last=planned.slots[planned.slots.length-1];
  return <>
    <div className="pageIntro"><div><span className="overline">PRODUCCIÓN POR LOTES</span><h1>Textos en bulk</h1><p>Pega hasta 40 publicaciones, revísalas y mándalas a la cola real de Meta con horarios separados. Nada se publica al instante.</p></div><div className="timezoneBadge"><Clock3 size={16}/><span>{Intl.DateTimeFormat().resolvedOptions().timeZone||"Hora local"}</span></div></div>

    <section className="settingsBar" aria-label="Ajustes del lote">
      <label className="settingsPage"><span>Página</span><select value={pageId} disabled={lock} onChange={e=>void setActivePage(e.target.value)}><option value="">Selecciona una página</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
      <div className="settingsField"><span>Publicar cada</span><div className="segmented compact">{[30,45,60,90].map(v=><button type="button" key={v} disabled={lock} className={gap===v?"active":""} onClick={()=>{setGap(v);setResults([])}}>{v} min</button>)}<input aria-label="Minutos personalizados" type="number" min={5} max={720} step={5} value={gap} disabled={lock} onChange={e=>{setGap(Math.max(5,Number(e.target.value)||5));setResults([])}}/></div></div>
      <div className="settingsField"><span>Ventana diaria</span><div className="timeRange"><input aria-label="Desde" type="time" value={dayStart} disabled={lock} onChange={e=>setDayStart(e.target.value)}/><ArrowRight size={14}/><input aria-label="Hasta" type="time" value={dayEnd} disabled={lock} onChange={e=>setDayEnd(e.target.value)}/></div></div>
      <label><span>Empezar <small>opcional</small></span><input type="datetime-local" value={manualStart} disabled={lock} onChange={e=>{setManualStart(e.target.value);setResults([])}}/></label>
    </section>
    <p className="settingsHint">{loadingQueue?<Loader2 className="spin" size={14}/>:<Check size={14}/>}{manualStart?"Inicio manual: se respeta la fecha que elegiste.":suggestion?`Siguiente hueco en Meta: ${suggestion.replace("T"," ")}.`:"Esperando el siguiente hueco de Meta."}<button type="button" className="linkButton" disabled={sending||loadingQueue||!pageId} onClick={()=>void refreshQueue()}><RefreshCw size={13}/> Actualizar</button></p>

    <section className="pasteCard">
      <div className="pasteCardHead"><div><strong>Pega tus textos</strong><span>Separa cada publicación con una línea vacía o con ---.</span></div><span className="pasteCount">{texts.length}/40{duplicateCount>0&&<b> · {duplicateCount} repetidos</b>}</span></div>
      <textarea aria-label="Textos del lote" disabled={lock} rows={10} placeholder={example} value={input} onChange={e=>changeText(e.target.value)}/>
    </section>
    {planned.error&&<div className="inlineNotice error"><AlertTriangle size={16}/>{planned.error}</div>}
    {texts.length>40&&<div className="inlineNotice error">Máximo 40 textos por lote para revisar sin saturar las solicitudes.</div>}
    {texts.some(t=>t.length>5000)&&<div className="inlineNotice error">Uno o más textos superan los 5,000 caracteres.</div>}

    {!!texts.length&&<section className="bulkPreviewCard bulkTextPreview">
      <div className="bulkSectionHead"><div><h2>Vista previa del lote</h2><p>Si editas un texto, hay que volver a revisarlo antes de programar.</p></div></div>
      {texts.slice(0,40).map((text,i)=>{
        const r=reviews?.[i],result=results.find(x=>x.index===i),slot=planned.slots[i];
        return <article className="bulkTextRow" key={i}>
          <div className="bulkTextRowTop"><strong>#{i+1} · {slot?`${slot.date} ${slot.time}`:"Por definir"}</strong><div>{r&&<span className={`bulkTextStatus ${r.status==="pass"?"pass":"warn"}`}>{r.status==="pass"?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>} {r.status.toUpperCase()}</span>}{result&&<span className={`bulkTextStatus ${result.status==="scheduled"?"pass":result.status==="failed"?"warn":""}`}>{result.status==="scheduled"?"Programado en Meta":result.status==="failed"?"Error al enviar":"Enviando…"}</span>}</div></div>
          <textarea value={text} rows={Math.min(6,Math.max(2,Math.ceil(text.length/100)))} disabled={sending||locked} onChange={e=>replaceAt(i,e.target.value)}/>
          {r&&r.status!=="pass"&&<p className="bulkTextAdvice">{r.issues?.map(x=>x.message).join(" · ")||r.summary||"Requiere ajustes antes de programar."}{r.correctedText&&r.correctedText!==text&&<button disabled={sending} onClick={()=>replaceAt(i,r.correctedText!)}> Usar texto corregido</button>}</p>}
          {result?.error&&<p className="bulkTextAdvice">{result.error}. Revisa la Cola Meta antes de reintentar.</p>}
          {!sending&&!locked&&<button className="bulkTextRemove" onClick={()=>removeAt(i)}><Trash2 size={14}/> Quitar</button>}
        </article>;
      })}
      {locked&&<p className="bulkTextAdvice">{done} confirmadas, {failures} fallidas. Para evitar duplicados, este lote queda bloqueado al registrar una programación; consulta la Cola Meta antes de preparar uno nuevo.</p>}
    </section>}

    {!!texts.length&&<div className="actionBar">
      <div className="actionBarSummary">{first&&last?<><span><small>Primera</small><strong>{first.date} {first.time}</strong></span><ArrowRight size={14}/><span><small>Última</small><strong>{last.date} {last.time}</strong></span></>:<span><small>Plan</small><strong>Sin horarios todavía</strong></span>}</div>
      {(message||error)&&<div className={error?"actionBarNotice error":"actionBarNotice"}>{error||message}</div>}
      <div className="actionBarButtons">
        {locked&&<button className="uiBtn uiBtnSecondary" type="button" disabled={sending} onClick={()=>void newBatch()}>Nuevo lote</button>}
        <button className="uiBtn uiBtnSecondary" onClick={()=>void reviewAll()} disabled={!validInput||reviewing||lock}>{reviewing?<Loader2 className="spin" size={16}/>:passes?<CheckCircle2 size={16}/>:<ShieldCheck size={16}/>} {passes?"Revisados":`Revisar ${texts.length}`}</button>
        <button className="uiBtn uiBtnPrimary" onClick={()=>void scheduleAll()} disabled={!passes||!validInput||!!planned.error||!planned.slots.length||!pageId||lock}>{sending?<Loader2 className="spin" size={16}/>:<Send size={16}/>} {sending?`Programando ${done}/${texts.length}`:`Programar ${texts.length}`}</button>
      </div>
    </div>}
    {!texts.length&&(message||error)&&<div className={error?"inlineNotice error":"inlineNotice"}>{error||message}</div>}
    <p className="pageFootnote"><AlertTriangle size={14}/> Los horarios son de tu navegador y se envían a Meta en UTC. La aprobación editorial no garantiza monetización. No hay reintentos automáticos, para evitar duplicados si Meta tarda en responder.</p>
  </>
}
