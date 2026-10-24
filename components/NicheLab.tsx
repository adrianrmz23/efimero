"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CircleHelp, FlaskConical, Info, Loader2, Plus, RefreshCw, Save, Trophy } from "lucide-react";

type Page={id:string;name:string;followers_count?:number|null;fan_count?:number|null};
type Experiment={id:string;niche:string;page_id:string|null;start_date:string;duration_days:number;phase:"testing"|"winner"|"promising"|"pivot"};
type Metric={id:string;experiment_id:string;recorded_date:string;reach:number|null;interactions:number|null;qualified_views:number|null;followers_net:number|null;production_cost:number|null;published_posts:number|null;published_reels:number|null;source:"manual"};
type Field= "reach"|"interactions"|"qualified_views"|"followers_net"|"production_cost"|"published_posts"|"published_reels";
type MetricsForm=Record<Field,string>;
const fields:{id:Field;label:string;hint:string}[]=[
  {id:"reach",label:"Alcance",hint:"Personas o cuentas alcanzadas"},
  {id:"interactions",label:"Interacciones",hint:"Reacciones + comentarios + compartidos"},
  {id:"qualified_views",label:"Qualified views",hint:"Solo si Meta proporciona el indicador"},
  {id:"followers_net",label:"Seguidores netos",hint:"Ganados menos perdidos; admite negativos"},
  {id:"production_cost",label:"Costo de producción (MXN)",hint:"Costo real del contenido producido ese día"},
  {id:"published_posts",label:"Posts publicados",hint:"Número publicado, no programado"},
  {id:"published_reels",label:"Reels publicados",hint:"Número publicado, no programado"},
];
const starter=[{niche:"Fe",icon:"🙏",description:"Reflexiones, esperanza y mensajes auténticos"},{niche:"Nostalgia",icon:"📼",description:"Recuerdos, épocas, música y experiencias"},{niche:"Humor cotidiano",icon:"😂",description:"Situaciones diarias reconocibles y originales"}];
const emptyForm=():MetricsForm=>({reach:"",interactions:"",qualified_views:"",followers_net:"",production_cost:"",published_posts:"",published_reels:""});
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isoDay=(date:string,n:number)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const daysPassed=(start:string)=>Math.floor((new Date(`${localDate()}T12:00:00`).getTime()-new Date(`${start}T12:00:00`).getTime())/86400000);
const fmt=(n:number)=>new Intl.NumberFormat("es-MX",{maximumFractionDigits:2}).format(n);
const phaseLabels:Record<Experiment["phase"],string>={testing:"En prueba",winner:"Ganadora",promising:"Prometedora",pivot:"Pivotar / cerrar"};

export default function NicheLab({pages,activePageId,onChoosePage}:{pages:Page[];activePageId:string;onChoosePage:(id:string)=>void}){
  const [experiments,setExperiments]=useState<Experiment[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [editingDate,setEditingDate]=useState(localDate());
  const [form,setForm]=useState<MetricsForm>(emptyForm);
  const [plannedStart,setPlannedStart]=useState(localDate());
  const [chosenPages,setChosenPages]=useState<Record<string,string>>({});
  const [newNiche,setNewNiche]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const r=await fetch("/api/niches",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron consultar los experimentos.");setExperiments(d.experiments||[]);setMetrics(d.metrics||[]);}
    catch(e:any){setError(e?.message||"Error de conexión. Ejecuta la migración de Supabase.");}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{void load()},[load]);

  const list=useMemo(()=>{
    const defaults=starter.map(s=>({...s,experiment:experiments.find(e=>e.niche===s.niche)}));
    const extras=experiments.filter(e=>!starter.some(s=>s.niche===e.niche)).map(e=>({niche:e.niche,icon:"✨",description:"Nicho adicional · fase 4",experiment:e}));
    return [...defaults,...extras];
  },[experiments]);
  const finished=experiments.some(e=>daysPassed(e.start_date)>=e.duration_days&&e.phase!=="testing");

  async function save(action:Record<string,unknown>,key:string){
    setBusy(key);setError("");setMessage("");
    try{
      const r=await fetch("/api/niches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible guardar el registro.");
      await load();setMessage("Cambios guardados correctamente.");return true;
    }catch(e:any){setError(e?.message||"No se pudieron guardar los cambios.");return false}
    finally{setBusy("")}
  }
  async function start(niche:string){
    const pageId=chosenPages[niche]??"";
    await save({action:"experiment",niche,pageId,startDate:plannedStart},`start-${niche}`);
  }
  async function updateMapping(exp:Experiment,pageId:string){
    setChosenPages(x=>({...x,[exp.niche]:pageId}));
    await save({action:"experiment",niche:exp.niche,pageId,startDate:exp.start_date},`map-${exp.id}`);
  }
  function openEntry(exp:Experiment){
    const today=localDate();
    const date=today<exp.start_date?exp.start_date:today>isoDay(exp.start_date,exp.duration_days-1)?isoDay(exp.start_date,exp.duration_days-1):today;
    changeDate(exp.id,date);
  }
  function changeDate(id:string,date:string){
    setEditing(id);setEditingDate(date);
    const existing=metrics.find(m=>m.experiment_id===id&&m.recorded_date===date);
    setForm(existing?Object.fromEntries(fields.map(({id})=>[id,existing[id]===null?"":String(existing[id])])) as MetricsForm:emptyForm());
  }
  async function submitMetric(exp:Experiment){
    const ok=await save({action:"metrics",experimentId:exp.id,date:editingDate,...form},`metric-${exp.id}`);
    if(ok)setEditing(null);
  }
  const configured=experiments.filter(x=>starter.some(s=>s.niche===x.niche)).length;
  const scores=experiments.map(e=>{
    const rows=metrics.filter(m=>m.experiment_id===e.id);
    const total=(key:Field)=>rows.reduce((sum,m)=>sum+(m[key]===null?0:Number(m[key])),0);
    const sumReach=total("reach"),sumEngagement=total("interactions"),sumViews=total("qualified_views");
    const paired=rows.filter(x=>x.reach!==null&&x.interactions!==null);const pairedReach=paired.reduce((n,x)=>n+Number(x.reach),0);const rate=pairedReach>0?paired.reduce((n,x)=>n+Number(x.interactions),0)/pairedReach*100:null;
    return {e,rows,total,rate,hasViews:rows.some(x=>x.qualified_views!==null),hasCost:rows.some(x=>x.production_cost!==null),sumViews};
  });

  return <div className="insp">
    <div className="pageIntro">
      <div><span className="overline">INSPIRACIÓN · NICHOS</span><h1>Laboratorio de nichos</h1><p>Prueba cada nicho durante 30 días, registra resultados reales y decide cuál escalar. Sin métricas inventadas ni publicaciones automáticas.</p></div>
      <span className="inspPill"><FlaskConical size={14}/> {configured}/3 nichos configurados</span>
    </div>

    <ol className="inspSteps" aria-label="Fases del laboratorio">{steps.map(([title,detail],i)=><li key={title}><span className="inspStepNum">{i+1}</span><div><strong>{title}</strong><small>{detail}</small></div></li>)}</ol>

    {error&&<div className="quickNotice error inspNotice" role="alert"><AlertTriangle size={16}/><span>{error}</span><button type="button" className="linkButton" onClick={()=>void load()}><RefreshCw size={14}/> Reintentar</button></div>}
    {message&&<div className="scheduleValidity ok inspNotice" role="status"><Check size={16}/><span>{message}</span></div>}

    {loading?<div className="inspEmpty"><Loader2 className="spin" size={18}/><span>Cargando experimentos…</span></div>:<>
      <section className="inspToolbar">
        <label className="field"><span>Inicio de nuevas pruebas</span><input type="date" value={plannedStart} onChange={e=>setPlannedStart(e.target.value)}/></label>
        <p className="inspHint"><CalendarDays size={14}/><span>Vincular una página de Meta es opcional al empezar, pero necesario para publicar desde Efímero.</span></p>
      </section>

      <div className="nicheList">
        {list.map(({niche,icon,description,experiment:exp})=>{
          const summary=scores.find(s=>s.e.id===exp?.id);
          const elapsed=exp?Math.max(0,Math.min(exp.duration_days,daysPassed(exp.start_date)+1)):0;
          const completed=exp?daysPassed(exp.start_date)>=exp.duration_days:false;
          const end=exp?isoDay(exp.start_date,exp.duration_days-1):"";
          const pageSelect=<label className="field"><span>Página de Facebook</span><select disabled={busy!==""} value={chosenPages[niche]??exp?.page_id??""} onChange={e=>exp?void updateMapping(exp,e.target.value):setChosenPages(x=>({...x,[niche]:e.target.value}))}><option value="">Sin vincular todavía</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>;
          return <article className="inspCard nicheItem" key={niche}>
            <div className="nicheItemHead">
              <span className="nicheGlyphBox" aria-hidden="true">{icon}</span>
              <div><h2>{niche}</h2><p>{description}</p></div>
              <span className={`statusPill tone-${exp?phaseTones[exp.phase]:"neutral"}`}>{exp?phaseLabels[exp.phase]:"Por iniciar"}</span>
            </div>

            {!exp?<div className="nicheStart">
              <div className="nicheStartRow">{pageSelect}<button type="button" className="uiBtn uiBtnSecondary" disabled={!!busy} onClick={()=>void start(niche)}>{busy===`start-${niche}`?<Loader2 className="spin" size={16}/>:<Plus size={16}/>} Iniciar prueba de 30 días</button></div>
              <p className="inspHint">Vincula una página existente o empieza registrando métricas a mano. No se crea ninguna página en Meta.</p>
            </div>:<>
              <div className="nicheOverview">
                {pageSelect}
                <div className="nicheProgress">
                  <div className="nicheProgressTop"><strong>Día {elapsed} de {exp.duration_days}</strong><span>{exp.start_date} → {end}</span></div>
                  <div className="nicheBar" role="progressbar" aria-label="Progreso de la prueba" aria-valuemin={0} aria-valuemax={exp.duration_days} aria-valuenow={elapsed}><i className={completed?"done":undefined} style={{width:`${elapsed/exp.duration_days*100}%`}}/></div>
                </div>
              </div>

              <div className="inspStats cols-6">
                <Stat label="Alcance" value={summary?.rows.some(x=>x.reach!==null)?fmt(summary.total("reach")):"—"}/>
                <Stat label="Engagement" value={summary?.rate!==null&&summary?.rate!==undefined?`${fmt(summary.rate)}%`:"—"}/>
                <Stat label="Qualified views" value={summary?.hasViews?fmt(summary.sumViews):"—"}/>
                <Stat label="Seguidores netos" value={summary?.rows.some(x=>x.followers_net!==null)?fmt(summary.total("followers_net")):"—"}/>
                <Stat label="Costo de producción" value={summary?.hasCost?`$${fmt(summary.total("production_cost"))}`:"—"}/>
                <Stat label="Días con datos" value={`${summary?.rows.length||0}/${exp.duration_days}`}/>
              </div>

              <div className="nicheFoot">
                <button type="button" className="uiBtn uiBtnSecondary" onClick={()=>editing===exp.id?setEditing(null):openEntry(exp)}><Save size={16}/> {editing===exp.id?"Cerrar registro":"Registrar métricas del día"}</button>
                {completed?<label className="inspInline"><Trophy size={16}/><span>Decisión</span><select value={exp.phase} disabled={!!busy} onChange={e=>void save({action:"phase",experimentId:exp.id,phase:e.target.value},`phase-${exp.id}`)}><option value="testing">Pendiente de evaluación</option><option value="winner">Ganadora · escalar</option><option value="promising">Prometedora · experimentar</option><option value="pivot">Pivotar / cerrar</option></select></label>:<span className="inspHint"><CircleHelp size={14}/><span>La decisión se habilita al completar los 30 días.</span></span>}
                {exp.page_id&&exp.page_id!==activePageId&&<button type="button" className="linkButton nicheGo" onClick={()=>onChoosePage(exp.page_id!)}>Trabajar en esta página <ArrowRight size={14}/></button>}
              </div>

              {editing===exp.id&&<div className="nicheLog">
                <div className="nicheLogHead">
                  <label className="field"><span>Fecha del registro</span><input type="date" min={exp.start_date} max={localDate()<end?localDate():end} value={editingDate} onChange={e=>changeDate(exp.id,e.target.value)}/></label>
                  <p className="inspHint">Deja en blanco lo que no tengas disponible. Cero significa que verificaste un valor de cero.</p>
                </div>
                <div className="nicheLogGrid">{fields.map(f=><label className="field" key={f.id}><span>{f.label}</span><input type="number" step={f.id==="production_cost"?"0.01":"1"} min={f.id==="followers_net"?undefined:0} placeholder="Sin dato" value={form[f.id]} onChange={e=>setForm(x=>({...x,[f.id]:e.target.value}))}/><small>{f.hint}</small></label>)}</div>
                <div className="inspFormActions"><button type="button" className="uiBtn uiBtnPrimary" disabled={!!busy} onClick={()=>void submitMetric(exp)}>{busy===`metric-${exp.id}`?<Loader2 className="spin" size={16}/>:<Check size={16}/>} Guardar registro</button></div>
              </div>}
            </>}
          </article>
        })}
      </div>

      {finished&&experiments.length<5&&<section className="inspCard">
        <div className="inspCardHead"><div><h2>Fase 4: explorar otro nicho</h2><p>Agrega hasta dos nichos más después de concluir y clasificar la primera ronda.</p></div></div>
        <div className="nicheStartRow"><label className="field"><span>Nombre del nicho</span><input value={newNiche} maxLength={75} placeholder="Ej. Recetas de la abuela" onChange={e=>setNewNiche(e.target.value)}/></label><button type="button" className="uiBtn uiBtnSecondary" disabled={!!busy||!newNiche.trim()} onClick={async()=>{if(await save({action:"experiment",niche:newNiche.trim(),pageId:"",startDate:plannedStart},"new"))setNewNiche("")}}><Plus size={16}/> Agregar nicho</button></div>
      </section>}

      <p className="pageFootnote"><Info size={14}/><span>Los valores son acumulados de los días capturados, no estadísticas automáticas de Meta. Engagement = interacciones ÷ alcance × 100 cuando ambos están registrados. «Qualified views» puede no estar disponible para todas las páginas o formatos. La comparación es orientativa hasta completar la ventana de 30 días.</span></p>
    </>}
  </div>;
}

const steps:[string,string][]=[["Validar","30 días por página"],["Medir","7 indicadores"],["Decidir","Escalar, probar o pivotar"],["Expandir","1 o 2 nichos más"]];
const phaseTones:Record<Experiment["phase"],string>={testing:"accent",winner:"success",promising:"warning",pivot:"danger"};
function Stat({label,value}:{label:string;value:string}){return <div className="inspStat"><span>{label}</span><strong>{value}</strong></div>}
