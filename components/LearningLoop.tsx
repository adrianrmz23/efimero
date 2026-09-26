"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Snapshot={id:string;checkpoint:string;reactions:number;comments:number;shares:number;performance_score:number;collected_at:string;scheduled_post_id:string};
export default function LearningLoop(){
  const [snapshots,setSnapshots]=useState<Snapshot[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function load(){const db=supabase;if(!db)return;const {data}=await db.from("efimero_metric_snapshots").select("*").order("collected_at",{ascending:false}).limit(250);setSnapshots((data||[]) as Snapshot[])}
  useEffect(()=>{void load()},[]);
  async function collect(){setBusy(true);setMessage("");try{const r=await fetch("/api/metrics/collect",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron recuperar métricas.");setMessage(`${d.collected||0} checkpoints nuevos capturados.`);await load()}catch(e:any){setMessage(e?.message||"Falló la medición.")}finally{setBusy(false)}}
  const latest=useMemo(()=>{const m=new Map<string,Snapshot>();for(const s of snapshots){if(!m.has(s.scheduled_post_id))m.set(s.scheduled_post_id,s)}return [...m.values()]},[snapshots]);
  const totals=useMemo(()=>latest.reduce((a,x)=>({r:a.r+Number(x.reactions||0),c:a.c+Number(x.comments||0),s:a.s+Number(x.shares||0)}),{r:0,c:0,s:0}),[latest]);
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 22 · CICLO DE APRENDIZAJE</span><h1>Publicar ya no es el final</h1><p>Efímero vuelve a cada post en 1 h, 24 h, 72 h y 7 días para aprender qué copies realmente generaron interacción.</p></div><button className="uiBtn uiBtnPrimary" onClick={collect} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Medir ahora</button></div>
    {message&&<div className="inlineNotice">{message}</div>}
    <div className="opsMetricGrid"><Metric label="Snapshots" value={snapshots.length}/><Metric label="Posts medidos" value={latest.length}/><Metric label="Reacciones" value={totals.r}/><Metric label="Compartidos" value={totals.s}/></div>
    <section className="toolPanel"><div className="panelTitle"><div><TrendingUp size={20}/><div><h2>Checkpoints recientes</h2><p>La comparación temporal evita decidir demasiado pronto que un texto funcionó o no.</p></div></div></div><div className="auditTable">{snapshots.slice(0,40).map(s=><div className="auditRow" key={s.id}><span className="auditStatus pass">{s.checkpoint}</span><p><BarChart3 size={14}/> 👍 {Number(s.reactions||0).toLocaleString("es-MX")} · 💬 {Number(s.comments||0).toLocaleString("es-MX")} · ↗ {Number(s.shares||0).toLocaleString("es-MX")}</p><strong>{Math.round(Number(s.performance_score||0))}</strong><small>{new Date(s.collected_at).toLocaleString("es-MX")}</small></div>)}{!snapshots.length&&<div className="emptyInline"><Activity size={18}/> Todavía no hay publicaciones con checkpoints de rendimiento.</div>}</div></section>
  </>;
}
function Metric({label,value}:{label:string;value:number}){return <article className="opsMetric"><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></article>}
