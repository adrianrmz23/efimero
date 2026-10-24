"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Status={services?:Record<string,any>;counts?:any;legal?:Record<string,string>;checkedAt?:string};
export default function ProductionReadiness(){
  const [status,setStatus]=useState<Status>({});const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function load(){setBusy(true);setError("");try{const r=await fetch("/api/production/status",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo comprobar producción.");setStatus(d)}catch(e:any){setError(e?.message||"Error") }finally{setBusy(false)}}
  useEffect(()=>{void load()},[]);
  const s=status.services||{};const checks=[
    ["Supabase service role",s.serviceRole],["OAuth de Meta",s.metaOauth],["Facebook conectado",s.metaConnected],["Token Meta saludable",s.metaStatus==="connected"],["OpenAI",s.openai],["CheapestInference",s.cheapestInference],["Bright Data Radar",s.brightData],["CRON_SECRET",s.cronSecret],["Sin token manual antiguo",!s.legacyMetaUserToken],
  ] as [string,boolean][];
  const ready=checks.filter(x=>x[1]).length;
  const percent=Math.round((ready/checks.length)*100);
  const failedJobs=Number(status.counts?.jobs?.failed||0);
  const legal=Object.entries(status.legal||{});
  return <>
    <div className="pageIntro"><div><span className="overline">SISTEMA</span><h1>Producción</h1><p>Que la automatización sea observable: comprueba secretos, Meta, cron, dataset, métricas y páginas legales antes de dejar el sistema trabajando solo.</p></div><button className="uiBtn uiBtnSecondary" onClick={load} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Revalidar</button></div>
    <div className="setStack">
      {error&&<div className="setNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
      <div className="setKpis">
        <div className={`setKpi ${ready===checks.length?"isSuccess":"isWarning"}`}><span>Preparación operativa</span><strong>{percent}%</strong><small>{ready}/{checks.length} controles listos</small></div>
        <div className="setKpi"><span>Dataset</span><strong>{Number(status.counts?.datasetItems||0).toLocaleString("es-MX")}</strong></div>
        <div className="setKpi"><span>Snapshots</span><strong>{Number(status.counts?.metricSnapshots||0).toLocaleString("es-MX")}</strong></div>
        <div className={failedJobs?"setKpi isDanger":"setKpi"}><span>Jobs fallidos</span><strong>{failedJobs.toLocaleString("es-MX")}</strong></div>
      </div>

      <div className="setSplit">
        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><ShieldCheck size={18}/><div><h2>Infraestructura</h2><p>Configuración que debe permanecer en verde.</p></div></div></div>
          <div className="setRows">{checks.map(([label,ok])=><div className="setRow" key={label}>
            <span className={`setIconBox ${ok?"success":"warning"}`}>{ok?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}</span>
            <div className="setRowMain"><span className="setRowTitle">{label}</span></div>
            <span className={`statusPill ${ok?"tone-success":"tone-warning"}`}>{ok?"Listo":"Revisar"}</span>
          </div>)}</div>
        </section>

        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><ExternalLink size={18}/><div><h2>Páginas legales</h2><p>Son públicas y puedes registrarlas en Meta Developers.</p></div></div></div>
          {legal.length?<div className="setRows">{legal.map(([k,v])=><a className="setRow setRowLink" key={k} href={v} target="_blank" rel="noreferrer"><div className="setRowMain"><span className="setRowTitle">{k}</span><span className="setRowNote">{v}</span></div><ExternalLink size={14}/></a>)}</div>:<div className="setEmpty"><ExternalLink size={20}/><strong>Sin páginas registradas</strong><span>Revalida para cargar los enlaces legales.</span></div>}
        </section>
      </div>
    </div>
  </>;
}
