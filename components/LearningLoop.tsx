"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Info, Loader2, MessageCircle, RefreshCw, Share2, ThumbsUp, TrendingUp } from "lucide-react";
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
    <div className="pageIntro"><div><span className="overline">APRENDIZAJE</span><h1>Ciclo vivo</h1><p>Publicar ya no es el final. Efímero vuelve a cada post a la 1 h, 24 h, 72 h y 7 días para aprender qué copies generaron interacción real.</p></div><button className="uiBtn uiBtnPrimary" onClick={collect} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Medir ahora</button></div>
    <div className="setStack">
      {message&&<div className="setNotice"><Info size={16}/><span>{message}</span></div>}
      <div className="setKpis"><Metric label="Snapshots" value={snapshots.length}/><Metric label="Posts medidos" value={latest.length}/><Metric label="Reacciones" value={totals.r}/><Metric label="Compartidos" value={totals.s}/></div>

      <section className="setCard flush">
        <div className="setCardHead"><div className="setCardTitle"><TrendingUp size={18}/><div><h2>Checkpoints recientes</h2><p>Comparar en el tiempo evita decidir demasiado pronto si un texto funcionó.</p></div></div></div>
        {snapshots.length?<div className="setRows">{snapshots.slice(0,40).map(s=><div className="setRow" key={s.id}>
          <span className="statusPill tone-accent">{s.checkpoint}</span>
          <div className="setRowMain"><div className="setMeta setMetaStrong"><span><ThumbsUp size={13}/>{Number(s.reactions||0).toLocaleString("es-MX")}</span><span><MessageCircle size={13}/>{Number(s.comments||0).toLocaleString("es-MX")}</span><span><Share2 size={13}/>{Number(s.shares||0).toLocaleString("es-MX")}</span></div><span className="setRowNote">{new Date(s.collected_at).toLocaleString("es-MX")}</span></div>
          <div className="setRowEnd"><BarChart3 size={14}/><span className="setNum">{Math.round(Number(s.performance_score||0))}</span></div>
        </div>)}</div>:<div className="setEmpty"><Activity size={20}/><strong>Todavía no hay checkpoints</strong><span>Aparecerán cuando haya publicaciones con métricas de rendimiento.</span></div>}
      </section>
    </div>
  </>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="setKpi"><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
