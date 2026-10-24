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
    <div className="pageIntro"><div><span className="overline">AUTOMATIZACIÓN</span><h1>Scheduler</h1><p>Publica aunque no tengas la app abierta. Toma las piezas aprobadas cuyo horario ya venció, bloquea textos sin Compliance PASS y registra cada intento para evitar duplicados.</p></div><button className="uiBtn uiBtnPrimary" onClick={run} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<Play size={16}/>} Ejecutar ahora</button></div>
    <div className="setStack">
      {(message||error)&&<div className={error?"setNotice error":"setNotice success"}>{error?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span>{error||message}</span></div>}
      <div className="setKpis"><Metric label="Listas ahora" value={due.length}/><Metric label="Próximas" value={future.length}/><Metric label="Publicadas" value={rows.filter(x=>Boolean(x.meta_post_id)).length}/><Metric label="Con error" value={rows.filter(x=>x.status==="Error").length} danger={rows.some(x=>x.status==="Error")}/></div>

      <section className="setCard flush">
        <div className="setCardHead"><div className="setCardTitle"><Clock3 size={18}/><div><h2>Cola automática</h2><p>Hasta 60 piezas registradas en Supabase, ordenadas por horario.</p></div></div><button className="uiBtn uiBtnGhost setSmall" onClick={()=>load()}><RefreshCw size={14}/> Actualizar</button></div>
        {rows.length?<div className="setRows">{rows.slice(0,60).map(row=>{const now=Date.now();const at=new Date(row.publish_at).getTime();return <div className="setRow top" key={row.id}>
          <span className="setIconBox" title={row.meta_post_id?"Enviada a Meta":at<=now?"Horario vencido":"Pendiente"}>{row.meta_post_id?<Send size={15}/>:at<=now?<TimerReset size={15}/>:<Clock3 size={15}/>}</span>
          <div className="setRowMain">
            <p className="setRowText clamp2">{row.text}</p>
            <div className="setMeta"><span>{new Date(row.publish_at).toLocaleString("es-MX")}</span><span>{row.category}</span>{row.page_name&&<span>{row.page_name}</span>}{row.compliance_data?.status==="pass"?<span className="ok"><CheckCircle2 size={13}/> Compliance PASS</span>:<span className="warn"><AlertTriangle size={13}/> Sin PASS</span>}</div>
          </div>
          <span className={`statusPill tone-${rowTone(row.status)}`}>{row.status}</span>
        </div>})}</div>:<div className="setEmpty"><Clock3 size={20}/><strong>No hay piezas programadas todavía</strong><span>Las publicaciones aprobadas aparecerán aquí con su horario.</span></div>}
      </section>

      <p className="pageFootnote"><Clock3 size={14}/><span>Para automatización continua, configura Vercel Cron contra <code>/api/cron/automation</code> usando <code>CRON_SECRET</code>.</span></p>
    </div>
  </>;
}
function rowTone(status:string){const s=status.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");if(s==="aprobado"||s==="approved")return "success";if(s==="programado")return "accent";if(s==="publicado")return "muted";if(s==="error")return "danger";if(s==="revision")return "warning";return "neutral"}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className={danger?"setKpi isDanger":"setKpi"}><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
