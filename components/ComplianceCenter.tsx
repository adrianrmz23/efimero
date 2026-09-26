"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
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
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 19 · COMPLIANCE META</span><h1>Un guardrail visible, no escondido</h1><p>Centraliza revisiones de políticas, alertas y auditoría. PASS significa que nuestras reglas no detectaron riesgo; no es una garantía de monetización.</p></div><button className="uiBtn uiBtnSecondary" onClick={recheckAlerts} disabled={busy||!alerts.length}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Revalidar alertas</button></div>
    <div className="complianceGrid"><section className="toolPanel"><div className="panelTitle"><div><ShieldCheck size={20}/><div><h2>Probar un texto</h2><p>Comprueba un copy antes de incorporarlo a la cola.</p></div></div></div><textarea className="complianceTextarea" value={text} onChange={e=>setText(e.target.value)} placeholder="Pega aquí un texto…"/><button className="uiBtn uiBtnPrimary wide" onClick={runStandalone} disabled={busy||!text.trim()}>{busy?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar con Compliance</button>{result&&<ResultCard result={result}/>}</section>
      <section className="toolPanel"><div className="panelTitle"><div><ShieldAlert size={20}/><div><h2>Alertas en cola</h2><p>Textos actuales que no están en PASS.</p></div></div><strong className="countPill">{alerts.length}</strong></div><div className="alertQueue">{alerts.length?alerts.slice(0,12).map(x=><article key={x.id}><span>{x.category}</span><p>{x.text}</p><b>{x.compliance?.status||"REVIEW"}</b></article>):<div className="emptyInline">No hay alertas activas.</div>}</div></section></div>
    <section className="toolPanel"><div className="panelTitle"><div><CheckCircle2 size={20}/><div><h2>Auditoría reciente</h2><p>Últimas revisiones persistidas en Supabase.</p></div></div></div><div className="auditTable">{reviews.length?reviews.map(r=><div className="auditRow" key={r.id}><span className={`auditStatus ${String(r.status).toLowerCase()}`}>{r.status}</span><p>{r.text}</p><strong>{Math.round(Number(r.score||0))}</strong><small>{new Date(r.created_at).toLocaleString("es-MX")}</small></div>):<div className="emptyInline">Todavía no hay auditoría registrada.</div>}</div></section>
  </>;
}
function ResultCard({result}:{result:any}){const pass=result.status==="pass";return <div className={pass?"complianceResult pass":"complianceResult warn"}>{pass?<CheckCircle2/>:<AlertTriangle/>}<div><strong>{result.status||"REVIEW"} · {Math.round(Number(result.score||0))}/100</strong><p>{result.summary||result.reason||"Revisión completada."}</p>{Array.isArray(result.issues)&&result.issues.length>0&&<ul>{result.issues.slice(0,5).map((x:any,i:number)=><li key={i}>{typeof x==="string"?x:x.message||x.rule||JSON.stringify(x)}</li>)}</ul>}</div></div>}
