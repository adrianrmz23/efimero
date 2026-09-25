"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, BookOpenCheck, BrainCircuit, CheckCircle2, Clock3, Loader2, RefreshCw, Share2, Sparkles, Target, Type, WandSparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PageItem = { id:string; name:string };
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
  const [pages,setPages]=useState<PageItem[]>([]);const [pageId,setPageId]=useState("");const [loadingPages,setLoadingPages]=useState(true);
  const [profile,setProfile]=useState<LearningProfile|null>(null);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState("");
  useEffect(()=>{void loadPages()},[]);
  useEffect(()=>{try{const raw=localStorage.getItem("efimero_learning_profiles");if(!raw||!pageId)return;const map=JSON.parse(raw);if(map?.[pageId])setProfile(map[pageId])}catch{}},[pageId]);
  async function loadPages(){setLoadingPages(true);try{const r=await fetch("/api/meta/pages",{cache:"no-store"});const d=await r.json();const list=d.pages||[];setPages(list);if(list.length)setPageId(x=>x||list[0].id)}finally{setLoadingPages(false)}}
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

  return <>
    <div className="pageIntro learningIntro"><div><span className="overline">BLOQUE 13 · TEXT LEARNING</span><h1>Aprendizaje por rendimiento</h1><p>Convierte métricas reales en reglas para producir mejores textos. No predice viralidad: identifica patrones observados en tu propio histórico.</p></div><button className="learningPrimary" onClick={analyze} disabled={!pageId||measured.length<3||saving}>{saving?<Loader2 className="spin"/>:<BrainCircuit/>} Analizar aprendizaje</button></div>
    <section className="learningToolbar"><label><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);setProfile(null)}} disabled={loadingPages}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div><b>{measured.length}</b><span>textos con métricas</span></div><div><b>{owned.length}</b><span>textos de memoria</span></div><button onClick={onOpenFactory}><WandSparkles size={16}/> Abrir Fábrica</button></section>
    {notice&&<div className="learningNotice"><CheckCircle2 size={17}/>{notice}</div>}
    {measured.length<3?<section className="emptyState"><BrainCircuit size={42}/><h2>Todavía faltan textos medibles</h2><p>Importa histórico o extrae texto de creatividades en Fábrica. Necesitamos al menos 3 piezas con reacciones, comentarios o compartidos.</p><button onClick={onOpenFactory}><Sparkles size={18}/> Ir a Fábrica</button></section>:<>
      <div className="learningKpis"><LearningKpi icon={<Activity/>} label="Benchmark" value={benchmark.toFixed(1)} note="señal media ponderada"/><LearningKpi icon={<Share2/>} label="Compartidos" value={fmt(measured.reduce((n,x)=>n+Number(x.shares||0),0))} note="histórico analizado"/><LearningKpi icon={<Type/>} label="Longitud media" value={`${Math.round(measured.reduce((n,x)=>n+words(x.text),0)/measured.length)} pal.`} note="solo textos medibles"/><LearningKpi icon={<Target/>} label="Top quartile" value={profile?profile.topQuartileThreshold.toFixed(1):"—"} note="umbral de la muestra"/></div>
      <div className="learningGrid"><LearningPanel title="Categorías" icon={<BarChart3/>} rows={categoryRows.slice(0,6)} max={maxAvg}/><LearningPanel title="Longitud" icon={<Type/>} rows={lengthRows} max={maxAvg}/><LearningPanel title="Hooks" icon={<Sparkles/>} rows={hookRows.slice(0,6)} max={maxAvg}/></div>
      {profile&&<section className="learningProfile"><div className="learningProfileHead"><div><span>PERFIL DE APRENDIZAJE ACTIVO</span><h2>{profile.pageName}</h2><p>{profile.generationInstruction}</p></div><div className="learningStamp"><BookOpenCheck/><span>{profile.sampleSize} piezas</span><small>{new Date(profile.analyzedAt).toLocaleString("es-MX")}</small></div></div><div className="learningRules">{profile.rules.map((r,i)=><article key={i}><i>{String(i+1).padStart(2,"0")}</i><p>{r}</p></article>)}</div></section>}
    </>}
  </>;
}
function LearningKpi({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <article className="learningKpi"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function LearningPanel({title,icon,rows,max}:{title:string;icon:React.ReactNode;rows:GroupRow[];max:number}){return <section className="learningPanel"><div className="learningPanelHead"><div>{icon}</div><h3>{title}</h3></div>{rows.map((r,i)=><div className="learningRow" key={r.label}><div><span>{r.label}</span><small>{r.count} piezas</small></div><div className="learningTrack"><i style={{width:`${Math.max(5,(r.avg/max)*100)}%`}}/></div><b>{r.avg.toFixed(1)}</b>{i===0&&<em>señal superior</em>}</div>)}</section>}
