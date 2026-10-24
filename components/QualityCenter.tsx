"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Settings2, ShieldCheck, Wrench } from "lucide-react";

export default function QualityCenter(){
  const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{void run()},[]);
  async function run(){setBusy(true);setError("");try{const r=await fetch("/api/quality/audit",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo ejecutar la auditoría.");setResult(d.result)}catch(e:any){setError(e?.message||"Falló la auditoría.")}finally{setBusy(false)}}
  const checks=result?.checks||[];
  const passCount=checks.filter((x:any)=>x.status==="pass").length;const warnCount=checks.filter((x:any)=>x.status==="warn").length;const failCount=checks.filter((x:any)=>x.status==="fail").length;
  return <>
    <div className="pageIntro"><div><span className="overline">SISTEMA</span><h1>QA final</h1><p>La V1 debe ser operable, no solo bonita. Audita autenticación, tokens, publicación, Compliance, automatización, dataset y deuda de configuración antes de dejar que el sistema trabaje solo.</p></div><button className="uiBtn uiBtnPrimary" onClick={run} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Ejecutar auditoría</button></div>
    <div className="setStack">
      {error&&<div className="setNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
      {result&&<>
        <div className="setKpis">
          <div className={`setKpi ${result.level==="ready"?"isSuccess":result.level==="good"?"":"isWarning"}`}><span>Preparación V1</span><strong>{result.score}/100</strong><small>{result.level==="ready"?"Lista":result.level==="good"?"Buena, con detalles":"Necesita atención"}</small></div>
          <div className="setKpi"><span>Correctos</span><strong>{passCount}</strong></div>
          <div className={warnCount?"setKpi isWarning":"setKpi"}><span>Advertencias</span><strong>{warnCount}</strong></div>
          <div className={failCount?"setKpi isDanger":"setKpi"}><span>Críticos</span><strong>{failCount}</strong></div>
        </div>
        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><ShieldCheck size={18}/><div><h2>Resultado de la auditoría</h2><p>Cada control con su estado y el detalle para corregirlo.</p></div></div></div>
          <div className="setRows">{checks.map((x:any)=><div className="setRow top" key={x.id}>
            <span className={`setIconBox ${x.status==="pass"?"success":x.status==="warn"?"warning":"danger"}`}>{x.status==="pass"?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}</span>
            <div className="setRowMain"><span className="setRowTitle">{x.label}</span>{x.detail&&<span className="setRowNote">{x.detail}</span>}</div>
            <span className={`statusPill ${x.status==="pass"?"tone-success":x.status==="warn"?"tone-warning":"tone-danger"}`}>{x.status==="pass"?"OK":x.status==="warn"?"Revisar":"Crítico"}</span>
          </div>)}</div>
        </section>
      </>}

      <div className="setSplit">
        <section className="setCard">
          <div className="setCardTitle"><Wrench size={18}/><div><h2>Checklist de cierre</h2><p>Decisiones que dejamos explícitas para producción.</p></div></div>
          <ul className="setList success">
            <li><CheckCircle2 size={16}/>Text-first: las imágenes siguen siendo una herramienta secundaria.</li>
            <li><CheckCircle2 size={16}/>Compliance obligatorio antes de publicar.</li>
            <li><CheckCircle2 size={16}/>Facebook OAuth sustituye a Graph API Explorer.</li>
            <li><CheckCircle2 size={16}/>Los tokens de página se almacenan cifrados en el servidor.</li>
            <li><CheckCircle2 size={16}/>El score editorial no se presenta como predicción de viralidad.</li>
            <li><CheckCircle2 size={16}/>El aprendizaje usa métricas reales cuando existen.</li>
          </ul>
        </section>
        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><Settings2 size={18}/><div><h2>Páginas y operación</h2><p>Accesos útiles para la última revisión.</p></div></div></div>
          <div className="setRows">
            <a className="setRow setRowLink" href="/privacy" target="_blank"><span className="setRowTitle">Política de privacidad</span><ExternalLink size={14}/></a>
            <a className="setRow setRowLink" href="/terms" target="_blank"><span className="setRowTitle">Condiciones</span><ExternalLink size={14}/></a>
            <a className="setRow setRowLink" href="/data-deletion" target="_blank"><span className="setRowTitle">Eliminación de datos</span><ExternalLink size={14}/></a>
          </div>
          <div className="setCardBody setRowsDivided"><button className="uiBtn uiBtnSecondary wide" onClick={()=>location.reload()}>Recargar aplicación</button></div>
        </section>
      </div>
    </div>
  </>;
}
