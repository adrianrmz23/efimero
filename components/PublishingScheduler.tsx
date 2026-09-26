"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Play, RefreshCw, Send, TimerReset } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Row={id:string;publish_at:string;text:string;category:string;status:string;page_name?:string|null;meta_post_id?:string|null;publish_error?:string|null;compliance_data?:any};
export default function PublishingScheduler(){
  const [rows,setRows]=useState<Row[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  const due=useMemo(()=>rows.filter(x=>["Aprobado","approved"].includes(x.status)&&new Date(x.publish_at).getTime()<=Date.now()),[rows]);
  const future=useMemo(()=>rows.filter(x=>["Aprobado","approved"].includes(x.status)&&new Date(x.publish_at).getTime()>Date.now()),[rows]);
  async function load(){const db=supabase;if(!db)return;const {data}=await db.from("efimero_scheduled_posts").select("id,publish_at,text,category,status,page_name,meta_post_id,publish_error,compliance_data").order("publish_at",{ascending:true}).limit(120);setRows((data||[]) as Row[])}
  useEffect(()=>{void load()},[]);
  async function run(){setBusy(true);setMessage("");setError("");try{const r=await fetch("/api/cron/automation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:20})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Falló el scheduler.");setMessage(`${d.results?.filter((x:any)=>x.status==="published").length||0} publicaciones enviadas · ${d.checked||0} revisadas.`);await load()}catch(e:any){setError(e?.message||"No fue posible ejecutar el scheduler.")}finally{setBusy(false)}}
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 21 · SCHEDULER</span><h1>Publica aunque no tengas la app abierta</h1><p>El motor toma piezas aprobadas cuyo horario ya venció, bloquea cualquier texto sin Compliance PASS y registra cada intento para evitar duplicados.</p></div><button className="uiBtn uiBtnPrimary" onClick={run} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<Play size={16}/>} Ejecutar ahora</button></div>
    {(message||error)&&<div className={error?"calendarNotice error":"calendarNotice"}>{error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||message}</span></div>}
    <div className="opsMetricGrid"><Metric label="Listas ahora" value={due.length}/><Metric label="Próximas" value={future.length}/><Metric label="Publicadas" value={rows.filter(x=>Boolean(x.meta_post_id)).length}/><Metric label="Con error" value={rows.filter(x=>x.status==="Error").length} danger={rows.some(x=>x.status==="Error")}/></div>
    <section className="toolPanel"><div className="panelTitle actionTitle"><div><Clock3 size={20}/><div><h2>Cola automática</h2><p>Para automatización continua, configura Vercel Cron contra <code>/api/cron/automation</code> usando <code>CRON_SECRET</code>.</p></div></div><button className="uiBtn uiBtnSecondary" onClick={()=>load()}><RefreshCw size={16}/> Actualizar</button></div>
      <div className="queueList">{rows.slice(0,60).map(row=><article className="queueRow" key={row.id}><div className={`queueStatus ${row.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}`}>{row.status}</div><div className="queueMain"><div className="queueMeta"><span>{new Date(row.publish_at).toLocaleString("es-MX")}</span><span>{row.category}</span>{row.page_name&&<span>{row.page_name}</span>}</div><p>{row.text}</p><div className="queueCompliance">{row.compliance_data?.status==="pass"?<><CheckCircle2 size={14}/> Compliance PASS</>:<><AlertTriangle size={14}/> Sin PASS</>}</div></div><div className="queueActions">{row.meta_post_id?<Send size={18}/>:new Date(row.publish_at).getTime()<=Date.now()?<TimerReset size={18}/>:<Clock3 size={18}/>}</div></article>)}{!rows.length&&<div className="emptyInline">No hay piezas programadas todavía.</div>}</div>
    </section>
  </>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <article className={danger?"opsMetric danger":"opsMetric"}><span>{label}</span><strong>{value}</strong></article>}
