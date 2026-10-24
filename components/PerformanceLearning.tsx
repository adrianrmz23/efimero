"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpenCheck, BrainCircuit, CheckCircle2, Loader2, Sparkles, Type, WandSparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePages } from "@/lib/pagesContext";

type LibraryItem = {
  id:string; text:string; category:string; source?:string; reactions?:number; comments?:number; shares?:number; reach?:number;
  performanceScore?:number; sourcePageId?:string; sourcePageName?:string; publishedAt?:string; extractionMetadata?:Record<string,unknown>;
};
type Props = { library:LibraryItem[]; onOpenFactory:()=>void };
type GroupRow = { label:string; count:number; avg:number; shares:number; comments:number };

type LearningProfile = {
  pageId:string; pageName:string; sampleSize:number; analyzedAt:string; benchmark:number;
  bestCategory?:GroupRow; bestLength?:GroupRow; bestHook?:GroupRow; bestFormat?:GroupRow;
  questionCommentLift:number; topQuartileThreshold:number; rules:string[]; generationInstruction:string;
};

const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const weighted=(x:LibraryItem)=>Number(x.reactions||0)+Number(x.comments||0)*2+Number(x.shares||0)*4;
const score=(x:LibraryItem)=>{const w=weighted(x),reach=Number(x.reach||0);return reach>0?(w/reach)*10000:Math.log10(w+1)*100};
const words=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
const lengthBucket=(s:string)=>{const n=words(s);return n<=12?"5–12 palabras":n<=25?"13–25 palabras":n<=45?"26–45 palabras":"46+ palabras"};
const hook=(s:string)=>{const t=norm(s.trim());if(/[?¿]/.test(s))return "Pregunta natural";if(t.startsWith("a veces"))return "A veces…";if(t.startsWith("que ")||t.startsWith("qué "))return "Qué…";if(t.startsWith("hay "))return "Hay…";if(t.startsWith("no "))return "No…";if(t.startsWith("cuando "))return "Cuando…";return "Afirmación directa"};
function group(items:LibraryItem[],key:(x:LibraryItem)=>string):GroupRow[]{
  const map=new Map<string,LibraryItem[]>();
  items.forEach(x=>{const k=key(x)||"Sin clasificar";map.set(k,[...(map.get(k)||[]),x])});
  return [...map.entries()].map(([label,list])=>({label,count:list.length,avg:list.reduce((n,x)=>n+score(x),0)/Math.max(1,list.length),shares:list.reduce((n,x)=>n+Number(x.shares||0),0),comments:list.reduce((n,x)=>n+Number(x.comments||0),0)})).sort((a,b)=>b.avg-a.avg);
}
const fmt=(n:number)=>new Intl.NumberFormat("es-MX",{maximumFractionDigits:1,notation:n>=1000000?"compact":"standard"}).format(n);

export default function PerformanceLearning({library,onOpenFactory}:Props){
  const {pages,activePageId,loading:loadingPages}=usePages();
  // Selección local: elegir otra página aquí no cambia la página activa global.
  const [localPageId,setPageId]=useState("");
  const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
  const [profile,setProfile]=useState<LearningProfile|null>(null);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState("");
  useEffect(()=>{try{const raw=localStorage.getItem("efimero_learning_profiles");if(!raw||!pageId)return;const map=JSON.parse(raw);if(map?.[pageId])setProfile(map[pageId])}catch{}},[pageId]);
  const page=pages.find(p=>p.id===pageId);
  const owned=useMemo(()=>library.filter(x=>x.text?.trim()&&x.source!=="reference"&&(!pageId||x.sourcePageId===pageId||(!x.sourcePageId&&pages.length===1))),[library,pageId,pages.length]);
  const measured=useMemo(()=>owned.filter(x=>weighted(x)>0),[owned]);
  const categoryRows=useMemo(()=>group(measured,x=>x.category||"Sin categoría"),[measured]);
  const lengthRows=useMemo(()=>group(measured,x=>lengthBucket(x.text)),[measured]);
  const hookRows=useMemo(()=>group(measured,x=>hook(x.text)),[measured]);
  const questionRows=useMemo(()=>group(measured,x=>/[?¿]/.test(x.text)?"Pregunta":"Afirmación"),[measured]);
  const benchmark=measured.length?measured.reduce((n,x)=>n+score(x),0)/measured.length:0;
  const maxAvg=Math.max(1,...categoryRows.map(x=>x.avg),...lengthRows.map(x=>x.avg),...hookRows.map(x=>x.avg));

  async function analyze(){
    if(!page||measured.length<3)return;
    const scores=measured.map(score).sort((a,b)=>a-b);const threshold=scores[Math.max(0,Math.floor(scores.length*.75)-1)]||0;
    const reliable=(rows:GroupRow[])=>rows.find(x=>x.count>=Math.min(3,Math.max(2,Math.floor(measured.length*.08))))||rows[0];
    const q=questionRows.find(x=>x.label==="Pregunta"),a=questionRows.find(x=>x.label==="Afirmación");
    const lift=q&&a&&a.comments>0?((q.comments/Math.max(1,q.count))/(a.comments/Math.max(1,a.count))-1)*100:0;
    const bestCategory=reliable(categoryRows),bestLength=reliable(lengthRows),bestHook=reliable(hookRows);
    const rules=[
      bestCategory?`Priorizar ${bestCategory.label} como una de las líneas a probar; en ${bestCategory.count} piezas su señal media fue ${bestCategory.avg.toFixed(1)}.`:"Mantener mezcla editorial hasta reunir más datos.",
      bestLength?`Usar ${bestLength.label} como rango de referencia, sin forzarlo en todos los textos.`:"Conservar longitudes variadas.",
      bestHook?`Probar con mayor frecuencia el arranque “${bestHook.label}”, manteniendo variaciones reales.`:"Variar hooks de forma orgánica.",
      Math.abs(lift)>=10?`${lift>0?"Las preguntas muestran más comentarios":"Las afirmaciones muestran más comentarios"} en esta muestra; usarlo como señal, no como regla absoluta.`:"No hay una diferencia clara entre preguntas y afirmaciones todavía.",
      "Todo texto sigue pasando por Compliance Meta; nunca pedir comentarios, shares, likes, etiquetas ni follows."
    ];
    const next:LearningProfile={pageId:page.id,pageName:page.name,sampleSize:measured.length,analyzedAt:new Date().toISOString(),benchmark,topQuartileThreshold:threshold,bestCategory,bestLength,bestHook,bestFormat:questionRows[0],questionCommentLift:lift,rules,generationInstruction:`Para ${page.name}: toma como referencia ${bestCategory?.label||"la mezcla histórica"}, longitud ${bestLength?.label||"variable"} y hook ${bestHook?.label||"variado"}. Optimiza originalidad y claridad; no copies históricos ni uses engagement bait.`};
    setProfile(next);setNotice("Aprendizaje recalculado con el histórico medible de la página.");
    try{const raw=localStorage.getItem("efimero_learning_profiles");const map=raw?JSON.parse(raw):{};map[page.id]=next;localStorage.setItem("efimero_learning_profiles",JSON.stringify(map))}catch{}
    if(supabase){setSaving(true);try{await supabase.from("efimero_learning_profiles").insert({page_id:page.id,page_name:page.name,sample_size:next.sampleSize,profile:next,is_active:true})}finally{setSaving(false)}}
  }

  return <div className="ins">
    <div className="pageIntro"><div><span className="overline">APRENDIZAJE</span><h1>Aprendizaje por rendimiento</h1><p>Convierte métricas reales en reglas para escribir mejores textos. No predice viralidad: resume patrones observados en tu propio histórico.</p></div><button className="uiBtn uiBtnPrimary" onClick={analyze} disabled={!pageId||measured.length<3||saving}>{saving?<Loader2 className="spin" size={16}/>:<BrainCircuit size={16}/>} {profile?"Recalcular aprendizaje":"Analizar aprendizaje"}</button></div>
    <section className="insToolbar">
      <label className="insControl insControlWide"><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);setProfile(null)}} disabled={loadingPages}>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
      <dl className="insInlineStats"><div><dt>Con métricas</dt><dd>{measured.length.toLocaleString("es-MX")}</dd></div><div><dt>En memoria</dt><dd>{owned.length.toLocaleString("es-MX")}</dd></div></dl>
      <button className="uiBtn uiBtnSecondary" onClick={onOpenFactory}><WandSparkles size={16}/> Abrir Fábrica</button>
    </section>
    {notice&&<div className="scheduleValidity ok"><CheckCircle2 size={16}/><span>{notice}</span></div>}
    {measured.length<3?<section className="insCard"><div className="insEmpty insEmptyLarge"><BrainCircuit size={22}/><strong>Todavía faltan textos medibles</strong><span>Importa histórico o extrae texto de creatividades en Fábrica. Se necesitan al menos 3 piezas con reacciones, comentarios o compartidos.</span><button className="uiBtn uiBtnSecondary" onClick={onOpenFactory}><Sparkles size={16}/> Ir a Fábrica</button></div></section>:<>
      <section className="insKpis">
        <Kpi label="Benchmark" value={benchmark.toFixed(1)} note="Señal media ponderada"/>
        <Kpi label="Compartidos" value={fmt(measured.reduce((n,x)=>n+Number(x.shares||0),0))} note="Histórico analizado"/>
        <Kpi label="Longitud media" value={`${Math.round(measured.reduce((n,x)=>n+words(x.text),0)/measured.length)} palabras`} note="Solo textos medibles"/>
        <Kpi label="Umbral top 25%" value={profile?profile.topQuartileThreshold.toFixed(1):"—"} note={profile?"Cuartil superior de la muestra":"Se calcula al analizar"}/>
      </section>
      <div className="insGrid3"><LearningPanel title="Categorías" icon={<BarChart3 size={16}/>} rows={categoryRows.slice(0,6)} max={maxAvg}/><LearningPanel title="Longitud" icon={<Type size={16}/>} rows={lengthRows} max={maxAvg}/><LearningPanel title="Inicio del texto" icon={<Sparkles size={16}/>} rows={hookRows.slice(0,6)} max={maxAvg}/></div>
      {profile&&<section className="insCard">
        <div className="insCardHead"><div><BookOpenCheck size={16}/><div><h2>Perfil activo · {profile.pageName}</h2><p>{profile.sampleSize} piezas · {new Date(profile.analyzedAt).toLocaleString("es-MX")}</p></div></div><span className="statusPill tone-success">Activo</span></div>
        <p className="insLead">{profile.generationInstruction}</p>
        <ol className="insSteps">{profile.rules.map((r,i)=><li key={i}><span>{i+1}</span><p>{r}</p></li>)}</ol>
      </section>}
    </>}
  </div>;
}
function Kpi({label,value,note}:{label:string;value:string;note:string}){return <div className="insKpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function LearningPanel({title,icon,rows,max}:{title:string;icon:React.ReactNode;rows:GroupRow[];max:number}){return <section className="insCard"><div className="insCardHead"><div>{icon}<div><h2>{title}</h2><p>Señal media por grupo.</p></div></div></div><div className="insBars">{rows.map((r,i)=><div className={i===0?"insBar lead":"insBar"} key={r.label}><div className="insBarLabel"><span>{r.label}</span><small>{r.count} piezas{i===0?" · señal superior":""}</small></div><div className="insBarTrack"><i style={{width:`${Math.max(4,(r.avg/max)*100)}%`}}/></div><strong>{r.avg.toFixed(1)}</strong></div>)}</div></section>}
