"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useMemo, useState } from "react";
import { usePages } from "@/lib/pagesContext";
import { AlertTriangle, Bot, CalendarDays, Check, CheckCircle2, Loader2, Send, ShieldCheck, Sparkles, Target, WandSparkles } from "lucide-react";

type Proposal={date:string;time:string;category:string;text:string;reason:string;compliance:any;score:any};
type Props={onQueue:(items:any[])=>void};

export default function AutonomousEditor({onQueue}:Props){
  const {pages,activePageId}=usePages();
  // Selección local: elegir otra página aquí no cambia la página activa global.
  const [localPageId,setPageId]=useState("");
  const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
  const [horizon,setHorizon]=useState(7);const [perDay,setPerDay]=useState(3);const [objective,setObjective]=useState("Equilibrado");const [busy,setBusy]=useState(false);const [queueBusy,setQueueBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");const [items,setItems]=useState<Proposal[]>([]);const [selected,setSelected]=useState<Set<number>>(new Set());
  const passCount=useMemo(()=>items.filter(x=>x.compliance?.status==="pass").length,[items]);
  async function run(){setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/editorial-agent/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,horizonDays:horizon,perDay,objective,maxItems:8})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible ejecutar el agente.");const next=d.items||[];setItems(next);setSelected(new Set(next.map((x:any,i:number)=>x.compliance?.status==="pass"&&Number(x.score?.score||0)>=55?i:-1).filter((x:number)=>x>=0)));setMessage(d.message||`${next.length} propuestas construidas para ${d.pageName||"la página"}.`) }catch(e:any){setError(e?.message||"Falló el agente editorial.")}finally{setBusy(false)}}
  async function queue(){const chosen=items.filter((_,i)=>selected.has(i));if(!chosen.length)return;setQueueBusy(true);setError("");try{const r=await fetch("/api/editorial-agent/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,items:chosen})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible mandar las propuestas a Bandeja.");const local=(d.queued||[]).map((x:any)=>({id:x.id,date:String(x.publish_at||"").slice(0,10),time:String(x.publish_at||"").slice(11,16),category:x.category,text:x.text,format:"Texto",status:"Aprobado",pageId:x.page_id,pageName:x.page_name,compliance:x.compliance_data,autopilot:true}));onQueue(local);setMessage(`${d.queued?.length||0} textos PASS enviados a Bandeja.`)}catch(e:any){setError(e?.message||"No fue posible guardar la cola.")}finally{setQueueBusy(false)}}
  function toggle(i:number){setSelected(current=>{const next=new Set(current);next.has(i)?next.delete(i):next.add(i);return next})}
  return <>
    <div className="pageIntro"><div><span className="overline">AUTOMATIZACIÓN</span><h1>Agente editorial</h1><p>Que la máquina proponga y tú conserves el control. Detecta huecos del calendario, consulta aprendizaje, fatiga y dataset, redacta textos y los pasa por Compliance antes de acercarlos a publicación.</p></div><span className="setBadge"><ShieldCheck size={14}/>Sin publicación directa</span></div>
    <div className="setStack">
      <section className="setCard">
        <div className="setCardHead">
          <div className="setCardTitle"><WandSparkles size={18}/><div><h2>Planificar el siguiente tramo</h2><p>Máximo 8 propuestas por ejecución para mantener la revisión y el coste bajo control.</p></div></div>
          <button className={`uiBtn ${items.length?"uiBtnSecondary":"uiBtnPrimary"}`} onClick={run} disabled={busy||!pageId}>{busy?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Analizar y proponer</button>
        </div>
        <div className="setFields c4">
          <label className="setField"><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>)}</select></label>
          <label className="setField"><span>Horizonte</span><select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option></select></label>
          <label className="setField"><span>Meta diaria</span><select value={perDay} onChange={e=>setPerDay(Number(e.target.value))}><option value={2}>2 textos</option><option value={3}>3 textos</option><option value={4}>4 textos</option><option value={6}>6 textos</option></select></label>
          <label className="setField"><span>Objetivo</span><select value={objective} onChange={e=>setObjective(e.target.value)}><option>Equilibrado</option><option>Compartibilidad</option><option>Comentarios</option><option>Variedad editorial</option></select></label>
        </div>
        <ol className="setFlow" aria-label="Flujo del agente"><li>Calendario</li><li>Contexto</li><li>Propuesta</li><li>Score</li><li>Compliance</li><li>Bandeja</li></ol>
        {(message||error)&&<div className={error?"setNotice error":"setNotice success"}>{error?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span>{error||message}</span></div>}
      </section>

      {items.length>0&&<section className="setCard flush">
        <div className="setCardHead">
          <div className="setCardTitle"><Target size={18}/><div><h2>Propuestas del agente</h2><p>{passCount} de {items.length} pasan Compliance local. Revisa la razón y el score antes de mandarlas a Bandeja.</p></div></div>
          <button className="uiBtn uiBtnPrimary" onClick={queue} disabled={queueBusy||!selected.size}>{queueBusy?<Loader2 className="spin" size={16}/>:<Send size={16}/>} Enviar {selected.size} a Bandeja</button>
        </div>
        <div className="setRows">{items.map((item,i)=>{const on=selected.has(i);const score=Math.round(Number(item.score?.score||0));const pass=item.compliance?.status==="pass";return <div className={on?"setRow top setRowSelected":"setRow top"} key={`${item.date}-${item.time}-${i}`}>
          <button type="button" className={on?"setCheckbox on":"setCheckbox"} onClick={()=>toggle(i)} aria-label={on?"Quitar propuesta":"Seleccionar propuesta"} aria-pressed={on}>{on&&<Check size={14}/>}</button>
          <div className="setRowMain">
            <div className="setMeta"><span><CalendarDays size={13}/>{item.date} · {item.time}</span><span>{item.category}</span></div>
            <p className="setRowText">{item.text}</p>
            <span className="setRowNote">{item.reason}</span>
          </div>
          <div className="setRowEnd setRowEndStack">
            <span className={`statusPill ${score>=70?"tone-success":"tone-neutral"}`}>{score}/100</span>
            <span className={`statusPill ${pass?"tone-success":"tone-warning"}`}>{pass?<ShieldCheck size={12}/>:<AlertTriangle size={12}/>} {String(item.compliance?.status||"review").toUpperCase()}</span>
          </div>
        </div>})}</div>
      </section>}

      <p className="pageFootnote"><Bot size={14}/>Nunca salta la revisión de políticas. El score describe compatibilidad editorial, no probabilidad de viralidad.</p>
    </div>
  </>;
}
