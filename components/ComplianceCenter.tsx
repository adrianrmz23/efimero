"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Item={id:string;text:string;status:string;category:string;compliance?:any};
type Props={items:Item[];onChange:(items:Item[])=>void};

export default function ComplianceCenter({items,onChange}:Props){
  const [text,setText]=useState("");const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);const [reviews,setReviews]=useState<any[]>([]);
  const alerts=useMemo(()=>items.filter(x=>x.compliance?.status&&x.compliance.status!=="pass"),[items]);
  useEffect(()=>{void loadReviews()},[]);
  async function loadReviews(){if(!supabase)return;const {data}=await supabase.from("efimero_compliance_reviews").select("*").order("created_at",{ascending:false}).limit(30);setReviews(data||[])}
  async function review(value:string){const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:value})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Falló Compliance.");return d.items?.[0]||d.review||d}
  async function runStandalone(){if(!text.trim())return;setBusy(true);try{setResult(await review(text));await loadReviews()}finally{setBusy(false)}}
  async function recheckAlerts(){if(!alerts.length)return;setBusy(true);let next=[...items];try{for(const item of alerts.slice(0,20)){const c=await review(item.text);next=next.map(x=>x.id===item.id?{...x,compliance:c,status:c.status==="pass"&&x.status==="Borrador"?"Revisión":x.status}:x)}onChange(next);const db=supabase;if(db)await Promise.all(next.filter(x=>alerts.some(a=>a.id===x.id)).map(x=>db.from("efimero_scheduled_posts").update({compliance_data:x.compliance,status:x.status}).eq("id",x.id)));await loadReviews()}finally{setBusy(false)}}
  const passReviews=reviews.filter(r=>String(r.status).toLowerCase()==="pass").length;
  return <>
    <div className="pageIntro"><div><span className="overline">POLÍTICAS</span><h1>Compliance Meta</h1><p>Revisa copies antes de publicarlos, atiende las alertas en cola y consulta la auditoría. PASS significa que nuestras reglas no detectaron riesgo; no garantiza monetización.</p></div><button className="uiBtn uiBtnSecondary" onClick={recheckAlerts} disabled={busy||!alerts.length}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Revalidar alertas</button></div>
    <div className="setStack">
      <div className="setKpis"><Kpi label="Alertas en cola" value={alerts.length} tone={alerts.length?"isWarning":""}/><Kpi label="Revisiones recientes" value={reviews.length}/><Kpi label="PASS en la auditoría" value={passReviews}/></div>

      <div className="setSplit even">
        <section className="setCard">
          <div className="setCardTitle"><ShieldCheck size={18}/><div><h2>Probar un texto</h2><p>Comprueba un copy antes de incorporarlo a la cola.</p></div></div>
          <label className="setField"><span>Texto</span><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pega aquí un texto…"/></label>
          <button className="uiBtn uiBtnPrimary wide" onClick={runStandalone} disabled={busy||!text.trim()}>{busy?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar con Compliance</button>
          {result&&<ResultCard result={result}/>}
        </section>

        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><ShieldAlert size={18}/><div><h2>Alertas en cola</h2><p>Textos actuales que no están en PASS.</p></div></div><span className="setTag">{alerts.length}</span></div>
          {alerts.length?<div className="setRows setScroll">{alerts.slice(0,12).map(x=><div className="setRow top" key={x.id}><div className="setRowMain"><p className="setRowText clamp3">{x.text}</p><div className="setMeta"><span>{x.category}</span></div></div><span className={`statusPill tone-${statusTone(x.compliance?.status)}`}>{String(x.compliance?.status||"review").toUpperCase()}</span></div>)}</div>:<div className="setEmpty"><CheckCircle2 size={20}/><strong>Sin alertas activas</strong><span>Ningún texto en cola tiene observaciones de políticas.</span></div>}
        </section>
      </div>

      <section className="setCard flush">
        <div className="setCardHead"><div className="setCardTitle"><History size={18}/><div><h2>Auditoría reciente</h2><p>Últimas revisiones guardadas en Supabase.</p></div></div></div>
        {reviews.length?<div className="setRows">{reviews.map(r=><div className="setRow top" key={r.id}><div className="setRowMain"><p className="setRowText clamp2">{r.text}</p><div className="setMeta"><span>Score {Math.round(Number(r.score||0))}/100</span><span>{new Date(r.created_at).toLocaleString("es-MX")}</span></div></div><span className={`statusPill tone-${statusTone(r.status)}`}>{String(r.status||"review").toUpperCase()}</span></div>)}</div>:<div className="setEmpty"><History size={20}/><strong>Todavía no hay auditoría registrada</strong><span>Las revisiones aparecerán aquí cuando pruebes o revalides textos.</span></div>}
      </section>
    </div>
  </>;
}
function statusTone(status:unknown){const s=String(status||"").toLowerCase();if(s==="pass")return "success";if(["block","blocked","fail","failed","reject","rejected"].includes(s))return "danger";return "warning"}
function Kpi({label,value,tone=""}:{label:string;value:number;tone?:string}){return <div className={`setKpi ${tone}`}><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
function ResultCard({result}:{result:any}){const pass=result.status==="pass";return <div className={pass?"setNotice success":"setNotice warning"}>{pass?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}<div><strong>{result.status||"REVIEW"} · {Math.round(Number(result.score||0))}/100</strong><p>{result.summary||result.reason||"Revisión completada."}</p>{Array.isArray(result.issues)&&result.issues.length>0&&<ul>{result.issues.slice(0,5).map((x:any,i:number)=><li key={i}>{typeof x==="string"?x:x.message||x.rule||JSON.stringify(x)}</li>)}</ul>}</div></div>}
