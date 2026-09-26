"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Filter, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Item = { id:string; date:string; time:string; category:string; text:string; status:string; compliance?:any; pageName?:string };
type Props = { items:Item[]; onChange:(items:Item[])=>void; onOpenCalendar:()=>void };

const statusOrder=["Borrador","Revisión","Aprobado","Programado","Publicado","Error"];
const statusClass=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");

export default function TextQueue({items,onChange,onOpenCalendar}:Props){
  const [filter,setFilter]=useState("Pendientes");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const stats=useMemo(()=>({pending:items.filter(x=>x.status==="Borrador"||x.status==="Revisión").length,approved:items.filter(x=>x.status==="Aprobado").length,scheduled:items.filter(x=>x.status==="Programado").length,blocked:items.filter(x=>x.compliance?.status&&x.compliance.status!=="pass").length}),[items]);
  const visible=useMemo(()=>items.filter(x=>filter==="Todos"?true:filter==="Pendientes"?(x.status==="Borrador"||x.status==="Revisión"):x.status===filter).slice(0,120),[items,filter]);

  async function persist(next:Item){
    if(!supabase)return;
    await supabase.from("efimero_scheduled_posts").update({status:next.status,compliance_data:next.compliance||null}).eq("id",next.id);
  }
  async function patch(id:string,changes:Partial<Item>){
    const next=items.map(x=>x.id===id?{...x,...changes}:x);onChange(next);
    const changed=next.find(x=>x.id===id);if(changed)await persist(changed);
  }
  async function reviewOne(item:Item){
    const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:item.text})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"No fue posible revisar el texto.");
    const compliance=data.items?.[0]||data.review||data;
    await patch(item.id,{compliance,status:compliance.status==="pass"?"Revisión":"Borrador"});
    return compliance;
  }
  async function reviewPending(){
    const targets=items.filter(x=>(x.status==="Borrador"||x.status==="Revisión")&&!x.compliance).slice(0,30);if(!targets.length){setMessage("No hay textos pendientes sin revisar.");return}
    setBusy(true);setMessage("");let pass=0;
    try{for(const item of targets){const result=await reviewOne(item);if(result.status==="pass")pass++}setMessage(`${targets.length} textos revisados · ${pass} pasaron Compliance.`)}catch(e:any){setMessage(e?.message||"La revisión se interrumpió.")}finally{setBusy(false)}
  }
  async function approvePass(){
    const ids=new Set(items.filter(x=>(x.status==="Borrador"||x.status==="Revisión")&&x.compliance?.status==="pass").map(x=>x.id));
    if(!ids.size){setMessage("No hay textos con Compliance PASS pendientes de aprobación.");return}
    const next=items.map(x=>ids.has(x.id)?{...x,status:"Aprobado"}:x);onChange(next);
    const db=supabase;if(db)await Promise.all([...ids].map(id=>db.from("efimero_scheduled_posts").update({status:"Aprobado"}).eq("id",id)));
    setMessage(`${ids.size} textos aprobados.`);
  }

  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 17 · BANDEJA EDITORIAL</span><h1>Todo texto pasa por una sola cola</h1><p>Revisa, valida Compliance y aprueba copies antes de programarlos. Aquí no se publica nada por accidente.</p></div><button className="uiBtn uiBtnSecondary" onClick={onOpenCalendar}>Abrir calendario</button></div>
    <div className="opsMetricGrid"><Metric label="Pendientes" value={stats.pending}/><Metric label="Aprobados" value={stats.approved}/><Metric label="Programados" value={stats.scheduled}/><Metric label="Con alerta" value={stats.blocked} danger={stats.blocked>0}/></div>
    <section className="toolPanel textQueuePanel"><div className="panelTitle actionTitle"><div><ClipboardCheck size={20}/><div><h2>Bandeja de aprobación</h2><p>Máximo 120 elementos visibles para mantener la revisión ligera.</p></div></div><div className="uiActionRow"><button className="uiBtn uiBtnSecondary" onClick={reviewPending} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar pendientes</button><button className="uiBtn uiBtnPrimary" onClick={approvePass}><CheckCircle2 size={16}/> Aprobar PASS</button></div></div>
      {message&&<div className="inlineNotice">{message}</div>}
      <div className="queueFilters"><Filter size={15}/>{["Pendientes","Aprobado","Programado","Publicado","Error","Todos"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div>
      <div className="queueList">{visible.length?visible.map(item=><article className="queueRow" key={item.id}><div className={`queueStatus ${statusClass(item.status)}`}>{item.status}</div><div className="queueMain"><div className="queueMeta"><span>{item.date} · {item.time}</span><span>{item.category}</span>{item.pageName&&<span>{item.pageName}</span>}</div><p>{item.text}</p><div className="queueCompliance">{item.compliance?.status==="pass"?<><CheckCircle2 size={14}/> Compliance PASS</>:item.compliance?.status?<><AlertTriangle size={14}/> {item.compliance.status}</>:<><Sparkles size={14}/> Sin revisar</>}</div></div><div className="queueActions">{!item.compliance&&<button className="uiIconBtn" title="Revisar Compliance" onClick={()=>reviewOne(item)}><ShieldCheck size={17}/></button>}{item.compliance?.status==="pass"&&item.status!=="Aprobado"&&<button className="uiBtn uiBtnSmall uiBtnPrimary" onClick={()=>patch(item.id,{status:"Aprobado"})}>Aprobar</button>}{statusOrder.includes(item.status)&&<select value={item.status} onChange={e=>patch(item.id,{status:e.target.value})}>{statusOrder.map(s=><option key={s}>{s}</option>)}</select>}</div></article>):<div className="emptyInline">No hay textos para este filtro.</div>}</div>
    </section>
  </>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <article className={danger?"opsMetric danger":"opsMetric"}><span>{label}</span><strong>{value}</strong></article>}
