"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Status={services?:Record<string,any>;counts?:any;legal?:Record<string,string>;checkedAt?:string};
export default function ProductionReadiness(){
  const [status,setStatus]=useState<Status>({});const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function load(){setBusy(true);setError("");try{const r=await fetch("/api/production/status",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo comprobar producción.");setStatus(d)}catch(e:any){setError(e?.message||"Error") }finally{setBusy(false)}}
  useEffect(()=>{void load()},[]);
  const s=status.services||{};const checks=[
    ["Supabase service role",s.serviceRole],["OAuth de Meta",s.metaOauth],["Facebook conectado",s.metaConnected],["Token Meta saludable",s.metaStatus==="connected"],["OpenAI",s.openai],["CRON_SECRET",s.cronSecret],["Sin token manual antiguo",!s.legacyMetaUserToken],
  ] as [string,boolean][];
  const ready=checks.filter(x=>x[1]).length;
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 24 · PRODUCCIÓN FINAL</span><h1>Que la automatización sea observable</h1><p>Comprueba secretos, Meta, cron, dataset, métricas y páginas legales antes de dejar el sistema trabajando solo.</p></div><button className="uiBtn uiBtnSecondary" onClick={load} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Revalidar</button></div>
    {error&&<div className="calendarNotice error"><AlertTriangle size={17}/>{error}</div>}
    <div className="productionScore"><ShieldCheck size={28}/><div><span>Preparación operativa</span><strong>{Math.round((ready/checks.length)*100)}%</strong><small>{ready}/{checks.length} controles listos</small></div></div>
    <div className="productionGrid"><section className="toolPanel"><div className="panelTitle"><div><CheckCircle2 size={20}/><div><h2>Infraestructura</h2><p>Configuración que debe permanecer verde.</p></div></div></div><div className="readinessList">{checks.map(([label,ok])=><div key={label} className={ok?"ready":"notReady"}>{ok?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}<span>{label}</span><b>{ok?"LISTO":"REVISAR"}</b></div>)}</div></section><section className="toolPanel"><div className="panelTitle"><div><ExternalLink size={20}/><div><h2>Meta legal</h2><p>Estas páginas son públicas y pueden registrarse en Meta Developers.</p></div></div></div><div className="legalLinks">{Object.entries(status.legal||{}).map(([k,v])=><a key={k} href={v} target="_blank" rel="noreferrer">{k}<ExternalLink size={14}/></a>)}</div><div className="productionCounts"><div><span>Dataset</span><strong>{Number(status.counts?.datasetItems||0)}</strong></div><div><span>Snapshots</span><strong>{Number(status.counts?.metricSnapshots||0)}</strong></div><div><span>Jobs fallidos</span><strong>{Number(status.counts?.jobs?.failed||0)}</strong></div></div></section></div>
  </>;
}
