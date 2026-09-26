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
    <div className="pageIntro"><div><span className="overline">BLOQUE 20 · OPERACIONES</span><h1>¿Está lista la máquina para publicar?</h1><p>Una vista de salud técnica para detectar conexiones rotas antes de que afecten la producción.</p></div><button className="uiBtn uiBtnSecondary" onClick={refresh}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar estado</button></div>
    <section className="opsHero"><div className="opsReadiness"><Activity size={27}/><span>Preparación operativa</span><strong>{readiness}%</strong><small>{readiness===100?"Todo lo esencial responde":"Hay servicios que requieren atención"}</small></div><div className="opsQueueSummary"><div><span>Borradores</span><strong>{queue.draft}</strong></div><div><span>Aprobados</span><strong>{queue.approved}</strong></div><div><span>Programados</span><strong>{queue.scheduled}</strong></div><div><span>Biblioteca</span><strong>{queue.library}</strong></div></div></section>
    <div className="healthGrid">{checks.map(({name,ok,icon:Icon,note})=><article className={ok?"healthCard ok":"healthCard bad"} key={name}><div>{ok?<CheckCircle2/>:<XCircle/>}</div><Icon size={20}/><span>{name}</span><strong>{ok?"Operativo":"Revisar"}</strong><small>{note}</small></article>)}</div>
    <section className="toolPanel"><div className="panelTitle"><div><Activity size={20}/><div><h2>Notas de producción</h2><p>Controles mínimos antes de activar automatizaciones más agresivas.</p></div></div></div><div className="opsChecklist"><p><CheckCircle2/> El login privado protege las rutas sensibles.</p><p><CheckCircle2/> Los Page Tokens se almacenan cifrados en servidor.</p><p><CheckCircle2/> Compliance debe estar en PASS antes de publicar.</p><p className={meta?.status==="reconnect_required"?"warning":""}>{meta?.status==="reconnect_required"?<XCircle/>:<CheckCircle2/>} Facebook: {meta?.status==="reconnect_required"?"reconexión requerida":"conexión vigente"}.</p></div></section>
  </>;
}
