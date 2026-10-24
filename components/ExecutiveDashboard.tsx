"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, BrainCircuit, Clock3, Loader2, RadioTower, RefreshCw, Sparkles, TrendingUp, WandSparkles } from "lucide-react";
import { usePages } from "@/lib/pagesContext";

type LibraryItem={id:string;text:string;source?:string;sourcePageId?:string;platformPostId?:string;category?:string;reactions?:number;comments?:number;shares?:number;factoryScore?:number};
type ScheduleItem={status:string;compliance?:any;pageId?:string;autopilot?:boolean};
type Props={library:LibraryItem[];schedule:ScheduleItem[];onOpenFactory:()=>void;onOpenLearning:()=>void};
type Post={id:string;message:string;createdTime?:string;reactions:number;comments:number;shares:number;reach:number};
const raw=(p:Post)=>p.reactions+p.comments*2+p.shares*4;const fmt=(n:number)=>new Intl.NumberFormat("es-MX",{notation:n>=1000000?"compact":"standard",maximumFractionDigits:1}).format(n);
export default function ExecutiveDashboard({library,schedule,onOpenFactory,onOpenLearning}:Props){
 const {pages,activePageId}=usePages();
 // Selección local: elegir otra página aquí no cambia la página activa global.
 const [localPageId,setPageId]=useState("");
 const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
 const[posts,setPosts]=useState<Post[]>([]);const[loading,setLoading]=useState(false);const[updated,setUpdated]=useState("");
 useEffect(()=>{if(pageId)void refresh()},[pageId]);
 async function refresh(){setLoading(true);try{const r=await fetch(`/api/meta/posts?pageId=${encodeURIComponent(pageId)}&limit=100&includeInsights=0`,{cache:"no-store"});const d=await r.json();setPosts(r.ok?d.posts||[]:[]);setUpdated(new Date().toISOString())}finally{setLoading(false)}}
 const page=pages.find(p=>p.id===pageId);const lib=library.filter(x=>!pageId||x.sourcePageId===pageId);const enriched=new Set(lib.map(x=>x.platformPostId).filter(Boolean));const coverage=posts.length?Math.round(posts.filter(p=>p.message?.trim()||enriched.has(p.id)).length/posts.length*100):0;const totalShares=posts.reduce((n,p)=>n+p.shares,0),totalComments=posts.reduce((n,p)=>n+p.comments,0),totalReactions=posts.reduce((n,p)=>n+p.reactions,0);const best=[...posts].sort((a,b)=>raw(b)-raw(a))[0];const scheduled=schedule.filter(x=>!pageId||x.pageId===pageId);const pass=scheduled.filter(x=>x.compliance?.status==="pass").length;const complianceRate=scheduled.length?Math.round(pass/scheduled.length*100):100;
 const learning=useMemo(()=>{try{const m=JSON.parse(localStorage.getItem("efimero_learning_profiles")||"{}");return m?.[pageId]||null}catch{return null}},[pageId,lib.length]);
 const brief=[learning?.bestCategory?.label?`Generar una tanda de ${learning.bestCategory.label} usando ${learning.bestLength?.label||"la longitud aprendida"}.`:"Analizar aprendizaje para convertir el histórico en reglas de copy.",coverage<70?`La cobertura textual es ${coverage}%. Conviene seguir extrayendo texto de creatividades antes de sacar conclusiones fuertes.`:`Cobertura textual ${coverage}%: ya hay base suficiente para comparar patrones de copy.`,complianceRate<100?`Hay ${scheduled.length-pass} piezas del calendario que no están en PASS; revisarlas antes de publicar.`:"Las piezas revisadas del calendario no muestran bloqueos de Compliance Meta."];
 const updatedLabel=updated?`Actualizado a las ${new Date(updated).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}`:"Sin actualizar";
 return <div className="ins">
  <div className="pageIntro"><div><span className="overline">RESUMEN</span><h1>Estado de la máquina de textos</h1><p>Qué producir hoy, qué está aprendiendo la plataforma y dónde faltan datos.</p></div><div className="insIntroActions"><select aria-label="Página" value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="uiBtn uiBtnSecondary" onClick={refresh} disabled={loading}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar</button></div></div>
  <section className="insKpis">
   <Kpi label="Cobertura textual" value={`${coverage}%`} note={`${posts.length} posts revisados`} tone={posts.length&&coverage<50?"warning":undefined}/>
   <Kpi label="Compartidos" value={fmt(totalShares)} note="Última muestra"/>
   <Kpi label="Comentarios" value={fmt(totalComments)} note="Última muestra"/>
   <Kpi label="Compliance" value={`${complianceRate}%`} note={`${scheduled.length} piezas en calendario`} tone={complianceRate<100?"warning":undefined}/>
  </section>
  <section className="insCard">
   <div className="insCardHead"><div><Sparkles size={16}/><div><h2>Brief de hoy</h2><p>{page?.name||"Página"} · {updatedLabel}</p></div></div><div className="insHeadActions"><button className="uiBtn uiBtnSecondary" onClick={onOpenLearning}><BrainCircuit size={16}/> Aprendizaje</button><button className="uiBtn uiBtnPrimary" onClick={onOpenFactory}><WandSparkles size={16}/> Abrir Fábrica</button></div></div>
   <ol className="insSteps">{brief.map((x,i)=><li key={i}><span>{i+1}</span><p>{x}</p></li>)}</ol>
  </section>
  <div className="insGrid2">
   <section className="insCard"><div className="insCardHead"><div><TrendingUp size={16}/><div><h2>Señal editorial</h2><p>Último perfil de aprendizaje guardado.</p></div></div></div>{learning?<div className="insSignal"><strong>{learning.bestCategory?.label||"Mezcla abierta"}</strong><div className="insTags"><span className="statusPill tone-neutral">{learning.bestLength?.label||"Longitud variable"}</span><span className="statusPill tone-neutral">{learning.bestHook?.label||"Hooks variados"}</span></div><p>{learning.generationInstruction}</p></div>:<div className="insEmpty"><BookOpenCheck size={18}/><span>Analiza el histórico en Aprendizaje para ver la señal editorial.</span><button className="uiBtn uiBtnSecondary" onClick={onOpenLearning}>Ir a Aprendizaje</button></div>}</section>
   <section className="insCard"><div className="insCardHead"><div><RadioTower size={16}/><div><h2>Salud de datos</h2><p>Qué tan bien podemos estudiar los textos.</p></div></div></div><dl className="insDefList"><div><dt>Posts de Meta</dt><dd>{posts.length}</dd></div><div><dt>Textos en Biblioteca</dt><dd>{lib.length}</dd></div><div><dt>Posts enriquecidos</dt><dd>{posts.filter(p=>enriched.has(p.id)).length}</dd></div><div><dt>Reacciones</dt><dd>{fmt(totalReactions)}</dd></div></dl>{coverage<50&&<div className="scheduleValidity warn insCardFoot"><AlertTriangle size={16}/><span>Aún hay muchas piezas visuales sin texto extraído.</span></div>}</section>
  </div>
  {best&&<section className="insCard"><div className="insCardHead"><div><Clock3 size={16}/><div><h2>Publicación con mayor señal</h2><p>La de mejor rendimiento en la muestra actual.</p></div></div></div><blockquote className="insQuote">{best.message?.trim()||lib.find(x=>x.platformPostId===best.id)?.text||"Publicación visual pendiente de texto"}</blockquote><dl className="insInlineStats"><div><dt>Reacciones</dt><dd>{fmt(best.reactions)}</dd></div><div><dt>Comentarios</dt><dd>{fmt(best.comments)}</dd></div><div><dt>Compartidos</dt><dd>{fmt(best.shares)}</dd></div></dl></section>}
 </div>
}
function Kpi({label,value,note,tone}:{label:string;value:string;note:string;tone?:string}){return <div className={tone?`insKpi tone-${tone}`:"insKpi"}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
