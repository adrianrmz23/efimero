"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, Loader2, RadioTower, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react";

type Props={schedule:any[];library:any[]};
export default function OperationsCenter({schedule,library}:Props){
  const [health,setHealth]=useState<any>(null);const [meta,setMeta]=useState<any>(null);const [loading,setLoading]=useState(true);
  async function refresh(){setLoading(true);try{const [h,m]=await Promise.all([fetch("/api/health",{cache:"no-store"}),fetch("/api/meta/connection",{cache:"no-store"})]);setHealth(await h.json());setMeta(await m.json())}finally{setLoading(false)}}
  useEffect(()=>{void refresh()},[]);
  const queue=useMemo(()=>({draft:schedule.filter(x=>x.status==="Borrador"||x.status==="Revisión").length,approved:schedule.filter(x=>x.status==="Aprobado").length,scheduled:schedule.filter(x=>x.status==="Programado").length,library:library.length}),[schedule,library]);
  const checks=[{name:"Sesión privada",ok:health?.auth?.session,icon:ShieldCheck,note:health?.auth?.email||"Sin sesión"},{name:"Supabase servidor",ok:health?.services?.supabaseAdmin,icon:Database,note:"service_role"},{name:"OpenAI",ok:health?.services?.openai,icon:Sparkles,note:health?.services?.openaiModel||"Sin modelo"},{name:"Meta OAuth",ok:health?.services?.metaOauth&&meta?.connected,icon:RadioTower,note:meta?.connected?`${meta.pageCount||0} páginas · ${meta.status||"connected"}`:"Sin conexión"}];
  const readiness=Math.round((checks.filter(x=>x.ok).length/checks.length)*100);
  return <>
    <div className="pageIntro"><div><span className="overline">SISTEMA</span><h1>Operaciones</h1><p>Salud técnica de las conexiones para detectar fallos antes de que afecten la producción.</p></div><button className="uiBtn uiBtnSecondary" onClick={refresh}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar estado</button></div>
    <div className="setStack">
      <div className="setKpis">
        <div className={`setKpi ${readiness===100?"isSuccess":"isWarning"}`}><span>Preparación operativa</span><strong>{readiness}%</strong><small>{readiness===100?"Todo lo esencial responde":"Hay servicios que requieren atención"}</small></div>
        <div className="setKpi"><span>Borradores</span><strong>{queue.draft}</strong></div>
        <div className="setKpi"><span>Aprobados</span><strong>{queue.approved}</strong></div>
        <div className="setKpi"><span>Programados</span><strong>{queue.scheduled}</strong></div>
        <div className="setKpi"><span>Biblioteca</span><strong>{queue.library}</strong></div>
      </div>

      <div className="setSplit even">
        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><Activity size={18}/><div><h2>Servicios</h2><p>Conexiones que necesita la publicación automática.</p></div></div></div>
          <div className="setRows">{checks.map(({name,ok,icon:Icon,note})=><div className="setRow" key={name}>
            <span className="setIconBox"><Icon size={16}/></span>
            <div className="setRowMain"><span className="setRowTitle">{name}</span><span className="setRowNote">{note}</span></div>
            <span className={`statusPill ${ok?"tone-success":"tone-danger"}`}>{ok?"Operativo":"Revisar"}</span>
          </div>)}</div>
        </section>

        <section className="setCard">
          <div className="setCardTitle"><ShieldCheck size={18}/><div><h2>Notas de producción</h2><p>Controles mínimos antes de activar automatizaciones más agresivas.</p></div></div>
          <ul className="setList success">
            <li><CheckCircle2 size={16}/>El login privado protege las rutas sensibles.</li>
            <li><CheckCircle2 size={16}/>Los tokens de página se almacenan cifrados en el servidor.</li>
            <li><CheckCircle2 size={16}/>Compliance debe estar en PASS antes de publicar.</li>
            <li className={meta?.status==="reconnect_required"?"isWarning":""}>{meta?.status==="reconnect_required"?<XCircle size={16}/>:<CheckCircle2 size={16}/>}Facebook: {meta?.status==="reconnect_required"?"reconexión requerida":"conexión vigente"}.</li>
          </ul>
        </section>
      </div>
    </div>
  </>;
}
