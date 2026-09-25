"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CalendarClock, CheckCircle2, Loader2, Play, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

type Props={library:any[];editorialProfile:any;onQueue:(items:any[])=>void};
type Page={id:string;name:string};
const pad=(n:number)=>String(n).padStart(2,"0");
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function timeSlots(start:string,end:string,count:number){const [sh,sm]=start.split(":").map(Number),[eh,em]=end.split(":").map(Number);const a=sh*60+sm,b=eh*60+em;if(count<=1)return [a];const step=(b-a)/(count-1);return Array.from({length:count},(_,i)=>Math.round(a+step*i)).map(m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`)}

export default function AutopilotPanel({library,editorialProfile,onQueue}:Props){
  const [pages,setPages]=useState<Page[]>([]);const [pageId,setPageId]=useState("");
  const [days,setDays]=useState(7);const [perDay,setPerDay]=useState(6);const [start,setStart]=useState("08:00");const [end,setEnd]=useState("22:00");
  const [mode,setMode]=useState<"manual"|"semi"|"auto">("semi");const [objective,setObjective]=useState("Compartibilidad");const [category,setCategory]=useState("Automática");
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  useEffect(()=>{fetch("/api/meta/pages",{cache:"no-store"}).then(r=>r.json()).then(d=>{setPages(d.pages||[]);if(d.pages?.length)setPageId(d.pages[0].id)}).catch(()=>{})},[]);
  const currentPage=pages.find(p=>p.id===pageId);
  const examples=useMemo(()=>library.filter(x=>x.source!=="reference"&&(!x.sourcePageId||x.sourcePageId===pageId)).sort((a,b)=>(b.performanceScore||0)-(a.performanceScore||0)).slice(0,24).map(x=>({text:x.text,category:x.category,reactions:x.reactions,comments:x.comments,shares:x.shares,performanceScore:x.performanceScore,structure:x.extractionMetadata?.structure,hook:x.extractionMetadata?.hook})),[library,pageId]);

  async function buildPlan(){
    setBusy(true);setError("");setMessage("");
    try{
      const total=Math.min(30,days*perDay); // lote inicial seguro; se puede repetir por semanas
      const r=await fetch("/api/text-factory/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count:total,category,objective,length:"Automática",examples,profile:editorialProfile})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo generar el lote.");
      const texts=(data.items||[]).map((x:any)=>String(x.text||"").trim()).filter(Boolean);
      const cr=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts})});
      const cd=await cr.json();if(!cr.ok)throw new Error(cd.error||"No se pudo revisar el lote.");
      const reviews=cd.items||[];
      const slots=timeSlots(start,end,perDay);const today=new Date();const items:any[]=[];
      for(let i=0;i<texts.length;i++){
        const dayIndex=Math.floor(i/perDay);if(dayIndex>=days)break;const d=new Date(today);d.setDate(d.getDate()+dayIndex);
        const review=reviews[i]||{};const corrected=review.correctedText||texts[i];
        items.push({id:crypto.randomUUID(),date:iso(d),time:slots[i%slots.length],category:data.items?.[i]?.category||category||"Frases identificables",text:corrected,format:"Texto",status:mode==="manual"?"Borrador":review.status==="pass"?"Aprobado":"Revisión",compliance:review,pageId,pageName:currentPage?.name,autopilot:true});
      }
      onQueue(items);setMessage(`${items.length} piezas creadas. ${items.filter(x=>x.status==="Aprobado").length} pasaron Compliance Meta y quedaron listas para calendarizar.`);
    }catch(e:any){setError(e?.message||"No fue posible crear el plan.")}finally{setBusy(false)}
  }

  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 11 · AUTOPILOT</span><h1>Automatiza la producción, no el criterio</h1><p>Autopilot llena huecos del calendario con textos nuevos, pero Compliance Meta sigue siendo obligatorio en todos los modos.</p></div><div className="autopilotShield"><ShieldCheck size={20}/><span>Compliance obligatorio</span></div></div>
    <section className="autopilotHero"><div className="autopilotIcon"><Bot size={32}/></div><div><span>FLUJO</span><h2>Huella → Fábrica → Compliance → Calendario → Facebook</h2><p>Ningún texto bloqueado por el agente de políticas puede pasar a publicación.</p></div></section>
    <section className="toolPanel autopilotPanel">
      <div className="panelTitle"><div><WandSparkles size={20}/><div><h2>Configura el siguiente lote</h2><p>Para controlar coste y calidad, cada ejecución genera como máximo 30 textos; puedes repetirla para cubrir más semanas.</p></div></div></div>
      <div className="autopilotGrid">
        <label><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label><span>Días</span><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option></select></label>
        <label><span>Publicaciones/día</span><select value={perDay} onChange={e=>setPerDay(Number(e.target.value))}><option value={3}>3</option><option value={4}>4</option><option value={6}>6</option><option value={8}>8</option></select></label>
        <label><span>Objetivo</span><select value={objective} onChange={e=>setObjective(e.target.value)}><option>Compartibilidad</option><option>Comentarios</option><option>Equilibrado</option></select></label>
        <label><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}><option>Automática</option><option>Frases identificables</option><option>Relaciones</option><option>Nostalgia</option><option>Humor</option><option>Preguntas</option><option>Vida cotidiana</option></select></label>
        <label><span>Modo</span><select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="manual">Manual · todo en borrador</option><option value="semi">Semi · aprobados si cumplen</option><option value="auto">Auto · listos para programar si cumplen</option></select></label>
        <label><span>Primera hora</span><input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label><span>Última hora</span><input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      </div>
      <div className="autopilotRules"><div><ShieldCheck size={18}/><strong>Regla fija</strong><span>Sin CTA directo, engagement bait, clickbait ni incentivos artificiales.</span></div><div><Sparkles size={18}/><strong>Memoria usada</strong><span>{examples.length} referencias propias de {currentPage?.name||"la página"}.</span></div><div><CalendarClock size={18}/><strong>Capacidad</strong><span>{Math.min(30,days*perDay)} textos en esta ejecución.</span></div></div>
      {(message||error)&&<div className={error?"calendarNotice error":"calendarNotice"}>{error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||message}</span></div>}
      <button className="generateButton" onClick={buildPlan} disabled={busy||!pageId}>{busy?<Loader2 className="spin" size={20}/>:<Play size={20}/>}<span>{busy?"Construyendo lote…":"Crear lote Autopilot"}</span><small>pasa por Compliance antes de entrar al calendario</small></button>
    </section>
  </>
}
