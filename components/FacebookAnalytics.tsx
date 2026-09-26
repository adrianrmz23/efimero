"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, Clock3, ExternalLink, Facebook,
  Flame, Loader2, MessageCircle, RadioTower, RefreshCw, Share2, Sparkles, ThumbsUp,
  TrendingUp, UsersRound, WandSparkles
} from "lucide-react";

type PageItem = { id:string; name:string; category?:string; fan_count?:number; picture?:{data?:{url?:string}} };
type MetaPost = {
  id:string; message:string; createdTime?:string|null; permalinkUrl?:string|null; picture?:string|null;
  reactions:number; comments:number; shares:number; reach:number;
};
type LibraryItem = { sourcePageId?:string; platformPostId?:string; platform?:string; text?:string; category?:string; extractionMetadata?:Record<string,unknown> };
type ToolStats = { calendars:number; scheduled:number; library:number; duplicates:number };

type Props = {
  library: LibraryItem[];
  toolStats: ToolStats;
  onOpenMeta: () => void;
};

type AggregateRow = { label:string; count:number; totalScore:number; avgScore:number; reactions:number; comments:number; shares:number };

const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function detectCategory(text:string){
  if(!text.trim())return "Visual / sin texto";
  const t=normalize(text);
  if(/[?¿]/.test(text))return "Preguntas";
  if(/jaja|adulto|banco|dormir|cenar|vacaciones|trabajo|lunes|viernes|economia|quincena/.test(t))return "Humor";
  if(/noche|dormir|cama|madrugada|insomnio/.test(t))return "Pensamientos nocturnos";
  if(/recuerdo|recordar|antes|infancia|cancion|foto|epoca|volver|nostalgia/.test(t))return "Nostalgia";
  if(/amor|pareja|querer|carino|persona|relacion|corazon|quedar|irse|quedarse|extrañar/.test(t))return "Relaciones";
  if(/avanzar|empezar|seguir|ritmo|puedes|lograr|paso|rendirse/.test(t))return "Motivación ligera";
  if(/cafe|casa|comer|dia|tiempo|plan|comprar|vida adulta/.test(t))return "Vida cotidiana";
  return "Frases identificables";
}
function rawEngagement(p:MetaPost){return Math.max(0,p.reactions)+Math.max(0,p.comments)*2+Math.max(0,p.shares)*4}
function performanceScore(p:MetaPost){const weighted=rawEngagement(p);if(p.reach>0)return Math.round((weighted/p.reach)*10000)/10;return Math.round(Math.log10(weighted+1)*100)/10}
function fmt(n:number){return new Intl.NumberFormat("es-MX",{notation:n>=1000000?"compact":"standard",maximumFractionDigits:1}).format(n)}
function avg(nums:number[]){return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0}
function localParts(iso:string|undefined|null,timeZone:string){
  if(!iso)return {hour:"—",day:"—"};
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return {hour:"—",day:"—"};
  const hour=new Intl.DateTimeFormat("es-MX",{timeZone,hour:"2-digit",hourCycle:"h23"}).format(d);
  const day=new Intl.DateTimeFormat("es-MX",{timeZone,weekday:"long"}).format(d);
  return {hour:`${hour}:00`,day:day.charAt(0).toUpperCase()+day.slice(1)};
}
function aggregate(posts:MetaPost[],key:(p:MetaPost)=>string){
  const map=new Map<string,{posts:MetaPost[]}>();
  posts.forEach(p=>{const k=key(p);if(!k||k==="—")return;const current=map.get(k)||{posts:[]};current.posts.push(p);map.set(k,current)});
  return [...map.entries()].map(([label,v]):AggregateRow=>({
    label,count:v.posts.length,totalScore:v.posts.reduce((n,p)=>n+performanceScore(p),0),avgScore:avg(v.posts.map(performanceScore)),
    reactions:v.posts.reduce((n,p)=>n+p.reactions,0),comments:v.posts.reduce((n,p)=>n+p.comments,0),shares:v.posts.reduce((n,p)=>n+p.shares,0)
  })).sort((a,b)=>b.avgScore-a.avgScore);
}

export default function FacebookAnalytics({library,toolStats,onOpenMeta}:Props){
  const [pages,setPages]=useState<PageItem[]>([]);
  const [pageId,setPageId]=useState("");
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [limit,setLimit]=useState(100);
  const [timeZone,setTimeZone]=useState("America/Mexico_City");
  const [loadingPages,setLoadingPages]=useState(true);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [lastUpdated,setLastUpdated]=useState<string>("");

  const page=pages.find(p=>p.id===pageId);
  const textPosts=posts.filter(p=>p.message?.trim());
  const totalReactions=posts.reduce((n,p)=>n+p.reactions,0);
  const totalComments=posts.reduce((n,p)=>n+p.comments,0);
  const totalShares=posts.reduce((n,p)=>n+p.shares,0);
  const totalReach=posts.reduce((n,p)=>n+p.reach,0);
  const avgScore=avg(posts.map(performanceScore));
  const importedCount=library.filter(x=>x.platform==="facebook"&&x.sourcePageId===pageId).length;
  const libraryByPostId=useMemo(()=>new Map(library.filter(x=>x.platformPostId).map(x=>[String(x.platformPostId),x])),[library]);
  const enrichedCount=posts.filter(p=>Boolean(libraryByPostId.get(p.id)?.text?.trim())).length;

  const categoryRows=useMemo(()=>aggregate(posts,p=>libraryByPostId.get(p.id)?.category||detectCategory(p.message)),[posts,libraryByPostId]);
  const hourRows=useMemo(()=>aggregate(posts,p=>localParts(p.createdTime,timeZone).hour),[posts,timeZone]);
  const dayRows=useMemo(()=>aggregate(posts,p=>localParts(p.createdTime,timeZone).day),[posts,timeZone]);
  const formatRows=useMemo(()=>aggregate(posts,p=>p.picture?"Imagen / visual":"Texto"),[posts]);
  const topPosts=useMemo(()=>[...posts].sort((a,b)=>performanceScore(b)-performanceScore(a)).slice(0,5),[posts]);

  const reliableCategories=categoryRows.filter(r=>r.count>=3);
  const reliableHours=hourRows.filter(r=>r.count>=2);
  const reliableDays=dayRows.filter(r=>r.count>=2);
  const bestCategory=(reliableCategories[0]||categoryRows[0]);
  const bestHour=(reliableHours[0]||hourRows[0]);
  const bestDay=(reliableDays[0]||dayRows[0]);
  const bestFormat=(formatRows.filter(r=>r.count>=3)[0]||formatRows[0]);
  const recommendationConfidence=posts.length>=75?"Alta":posts.length>=30?"Media":"Exploratoria";

  useEffect(()=>{void loadPages()},[]);

  async function loadPages(){
    setLoadingPages(true);setError("");
    try{
      const r=await fetch("/api/meta/pages",{cache:"no-store"});const data=await r.json();setConfigured(Boolean(data.configured));
      if(!r.ok){setError(data.error||"No fue posible consultar tus páginas.");return}
      const list=data.pages||[];setPages(list);if(list.length)setPageId(old=>old||data.activePageId||list[0].id);
    }catch{setConfigured(false);setError("No fue posible conectar con Meta desde el servidor.")}
    finally{setLoadingPages(false)}
  }

  async function loadAnalytics(explicitPageId?:string){
    const target=explicitPageId||pageId;if(!target)return;
    setLoading(true);setError("");
    try{
      const qs=new URLSearchParams({pageId:target,limit:String(limit),includeInsights:"0"});
      const r=await fetch(`/api/meta/posts?${qs.toString()}`,{cache:"no-store"});const data=await r.json();
      if(!r.ok)throw new Error(data.error||"No fue posible cargar las publicaciones.");
      setPosts(data.posts||[]);setLastUpdated(new Date().toISOString());
    }catch(e:any){setPosts([]);setError(e?.message||"No fue posible analizar Facebook.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{if(pageId)void loadAnalytics(pageId)},[pageId]);

  const maxCategory=Math.max(1,...categoryRows.map(x=>x.avgScore));
  const maxHour=Math.max(1,...hourRows.map(x=>x.avgScore));

  return <>
    <div className="pageIntro analyticsIntro">
      <div><span className="overline">FACEBOOK INTELLIGENCE</span><h1>Qué está funcionando realmente</h1><p>Analiza publicaciones reales de la página seleccionada. Las recomendaciones se basan en la muestra cargada, no en predicciones garantizadas.</p></div>
      <div className="analyticsActions">
        <select value={pageId} onChange={e=>setPageId(e.target.value)} disabled={loadingPages||!pages.length}>{pages.length?pages.map(p=><option value={p.id} key={p.id}>{p.name}</option>):<option>Sin páginas</option>}</select>
        <select value={limit} onChange={e=>setLimit(Number(e.target.value))}><option value={25}>25 posts</option><option value={50}>50 posts</option><option value={100}>100 posts</option></select>
        <button onClick={()=>loadAnalytics()} disabled={loading||!pageId}>{loading?<Loader2 className="spin" size={18}/>:<RefreshCw size={18}/>} Actualizar</button>
      </div>
    </div>

    {!configured&&!loadingPages&&<section className="analyticsWarning"><AlertTriangle size={22}/><div><strong>Meta todavía no está configurado</strong><span>Agrega tu META_USER_ACCESS_TOKEN y reinicia Next.js.</span></div></section>}
    {error&&<section className="analyticsWarning error"><AlertTriangle size={22}/><div><strong>No pudimos completar el análisis</strong><span>{error}</span></div></section>}

    <section className="analyticsPageStrip">
      <div className="analyticsPageIdentity">{page?.picture?.data?.url?<img src={page.picture.data.url} alt=""/>:<span><Facebook size={22}/></span>}<div><small>PÁGINA ANALIZADA</small><strong>{page?.name||"Selecciona una página"}</strong><em>{page?.fan_count?`${fmt(page.fan_count)} seguidores`:page?.category||"Facebook Page"}</em></div></div>
      <div><span>Muestra</span><strong>{posts.length}</strong><small>publicaciones</small></div>
      <div><span>En biblioteca</span><strong>{importedCount}</strong><small>{enrichedCount} con texto recuperado</small></div>
      <div><span>Confianza</span><strong>{recommendationConfidence}</strong><small>según tamaño de muestra</small></div>
      <div className="analyticsTimezone"><span>Zona horaria</span><select value={timeZone} onChange={e=>setTimeZone(e.target.value)}><option value="America/Mexico_City">CDMX</option><option value="America/Cancun">Cancún</option><option value="America/Tijuana">Tijuana</option><option value="America/New_York">Nueva York</option><option value="America/Los_Angeles">Los Ángeles</option><option value="Europe/Madrid">Madrid</option><option value="UTC">UTC</option></select></div>
    </section>

    <div className="facebookMetricGrid">
      <MetricCard icon={<ThumbsUp/>} label="Reacciones" value={fmt(totalReactions)} note={`${fmt(Math.round(avg(posts.map(p=>p.reactions))))} promedio/post`}/>
      <MetricCard icon={<MessageCircle/>} label="Comentarios" value={fmt(totalComments)} note={`${fmt(Math.round(avg(posts.map(p=>p.comments))))} promedio/post`}/>
      <MetricCard icon={<Share2/>} label="Compartidos" value={fmt(totalShares)} note={`${fmt(Math.round(avg(posts.map(p=>p.shares))))} promedio/post`} accent/>
      <MetricCard icon={<TrendingUp/>} label="Score histórico" value={posts.length?avgScore.toFixed(1):"0"} note="shares ponderan más"/>
      {totalReach>0&&<MetricCard icon={<UsersRound/>} label="Alcance acumulado" value={fmt(totalReach)} note="solo posts con Insights"/>}
    </div>

    <section className="todayRecommendation">
      <div className="recommendationIcon"><WandSparkles size={28}/></div>
      <div className="recommendationCopy"><span>QUÉ PROBAR HOY</span>{posts.length?<><h2>{bestCategory?.label||"Contenido identificable"} {bestHour?`alrededor de ${bestHour.label}`:""}</h2><p>En esta muestra, <strong>{bestCategory?.label||"esa categoría"}</strong>{bestDay?` destaca especialmente en ${bestDay.label.toLowerCase()}`:""}{bestFormat?` y el formato ${bestFormat.label.toLowerCase()} muestra una señal favorable`:""}. Úsalo como punto de partida editorial y valida el resultado con nuevas publicaciones.</p><div className="recommendationTags"><span><Sparkles size={14}/> {recommendationConfidence}</span>{bestCategory&&<span>{bestCategory.count} posts comparados</span>}{bestHour&&<span><Clock3 size={14}/> {bestHour.label}</span>}</div></>:<><h2>Carga publicaciones para construir la recomendación</h2><p>Cuando Meta devuelva la muestra podremos comparar categorías, horarios, días y formatos.</p></>}</div>
      <button onClick={onOpenMeta}><RadioTower size={17}/> Abrir sincronización</button>
    </section>

    <div className="analyticsTwoCols">
      <section className="toolPanel performancePanel"><div className="panelTitle"><div><BarChart3 size={20}/><div><h2>Rendimiento por categoría</h2><p>Score promedio; los compartidos tienen mayor peso.</p></div></div></div><div className="performanceRows">{categoryRows.slice(0,8).map(r=><PerformanceRow key={r.label} row={r} max={maxCategory}/>) }{!categoryRows.length&&<EmptyAnalytics/>}</div></section>
      <section className="toolPanel performancePanel"><div className="panelTitle"><div><Clock3 size={20}/><div><h2>Mejores horas</h2><p>Hora local según la zona seleccionada.</p></div></div></div><div className="performanceRows">{hourRows.slice(0,8).map(r=><PerformanceRow key={r.label} row={r} max={maxHour}/>) }{!hourRows.length&&<EmptyAnalytics/>}</div></section>
    </div>

    <div className="analyticsTwoCols">
      <section className="toolPanel miniLeaderboard"><div className="panelTitle"><div><CalendarDays size={20}/><div><h2>Días de la semana</h2><p>Comparación del score promedio por día.</p></div></div></div>{dayRows.map((r,i)=><div className="leaderRow" key={r.label}><b>{i+1}</b><span>{r.label}<small>{r.count} posts</small></span><strong>{r.avgScore.toFixed(1)}</strong></div>)}{!dayRows.length&&<EmptyAnalytics/>}</section>
      <section className="toolPanel miniLeaderboard"><div className="panelTitle"><div><Sparkles size={20}/><div><h2>Formato</h2><p>Texto contra piezas con componente visual.</p></div></div></div>{formatRows.map((r,i)=><div className="leaderRow" key={r.label}><b>{i+1}</b><span>{r.label}<small>{r.count} posts</small></span><strong>{r.avgScore.toFixed(1)}</strong></div>)}{!formatRows.length&&<EmptyAnalytics/>}</section>
    </div>

    <section className="toolPanel topFacebookPosts"><div className="panelTitle"><div><Flame size={20}/><div><h2>Top publicaciones de la muestra</h2><p>Si la Fábrica ya leyó una creatividad, usamos ese texto y su categoría para enriquecer Analytics.</p></div></div></div><div className="topPostList">{topPosts.map((p,i)=>{const memory=libraryByPostId.get(p.id);const resolvedText=memory?.text?.trim()||p.message||"Publicación visual pendiente de lectura en Fábrica.";const resolvedCategory=memory?.category||detectCategory(p.message);return <article key={p.id}><div className="topRank">#{i+1}</div><div className="topPostBody"><div className="topPostMeta"><span>{resolvedCategory}</span>{memory?.extractionMetadata&&<b>Visión IA</b>}<small>{p.createdTime?new Date(p.createdTime).toLocaleDateString("es-MX"):""}</small></div><p>{resolvedText}</p><div className="topPostMetrics"><span>👍 {fmt(p.reactions)}</span><span>💬 {fmt(p.comments)}</span><span>↗ {fmt(p.shares)}</span><strong>Score {performanceScore(p).toFixed(1)}</strong>{p.permalinkUrl&&<a href={p.permalinkUrl} target="_blank" rel="noreferrer">Ver en Facebook <ExternalLink size={13}/></a>}</div></div></article>})}{!topPosts.length&&<EmptyAnalytics/>}</div></section>

    <section className="toolPanel internalAnalytics"><div className="panelTitle"><div><RadioTower size={20}/><div><h2>Estado de Efímero Content Engine</h2><p>Actividad interna de la herramienta, separada del rendimiento de Facebook.</p></div></div>{lastUpdated&&<span className="lastUpdated">Meta actualizado {new Date(lastUpdated).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</span>}</div><div className="internalMetricRow"><InternalMetric label="Calendarios" value={toolStats.calendars}/><InternalMetric label="Posts en calendario" value={toolStats.scheduled}/><InternalMetric label="Memoria editorial" value={toolStats.library}/><InternalMetric label="Similitud alta" value={toolStats.duplicates}/></div></section>
  </>;
}

function MetricCard({icon,label,value,note,accent=false}:{icon:React.ReactNode;label:string;value:string;note:string;accent?:boolean}){return <article className={accent?"facebookMetric accent":"facebookMetric"}><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function PerformanceRow({row,max}:{row:AggregateRow;max:number}){const width=Math.max(5,(row.avgScore/max)*100);return <div className="performanceRow"><div className="performanceLabel"><span>{row.label}</span><small>{row.count} posts · ↗ {fmt(row.shares)}</small></div><div className="performanceBar"><i style={{width:`${width}%`}}/></div><strong>{row.avgScore.toFixed(1)}</strong></div>}
function EmptyAnalytics(){return <div className="analyticsEmpty"><BarChart3 size={24}/><span>Sin datos suficientes todavía.</span></div>}
function InternalMetric({label,value}:{label:string;value:number}){return <div><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
