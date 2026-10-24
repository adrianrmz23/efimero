"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, CalendarDays, Clock3, ExternalLink, Facebook,
  Flame, Loader2, RadioTower, RefreshCw, Sparkles, WandSparkles
} from "lucide-react";
import { usePages, type MetaPage } from "@/lib/pagesContext";

// El contexto no garantiza la foto; si llega, se usa como avatar.
type PageItem = MetaPage & { picture?:{data?:{url?:string}} };
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
  const {pages,activePageId,loading:loadingPages,error:pagesError}=usePages();
  // Selección local: elegir otra página aquí no cambia la página activa global.
  const [localPageId,setPageId]=useState("");
  const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [limit,setLimit]=useState(100);
  const [timeZone,setTimeZone]=useState("America/Mexico_City");
  const [loading,setLoading]=useState(false);
  const [analyticsError,setError]=useState("");
  const error=analyticsError||pagesError;
  // /api/meta/pages solo responde sin páginas y sin error cuando Meta no está configurado.
  const configured=loadingPages?null:pages.length>0||Boolean(pagesError);
  const [lastUpdated,setLastUpdated]=useState<string>("");

  const page=pages.find(p=>p.id===pageId) as PageItem|undefined;
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

  const pageAvatar=page?.picture?.data?.url;
  const pageSub=[page?.fan_count?`${fmt(page.fan_count)} seguidores`:"",page?.category||""].filter(Boolean).join(" · ")||"Página de Facebook";

  return <div className="ins">
    <div className="pageIntro">
      <div><span className="overline">RENDIMIENTO</span><h1>Qué está funcionando</h1><p>Compara categorías, horarios y formatos con publicaciones reales de la página. Son señales de la muestra cargada, no predicciones.</p></div>
      <button className="uiBtn uiBtnSecondary" onClick={onOpenMeta}><RadioTower size={16}/> Sincronizar con Meta</button>
    </div>

    {!configured&&!loadingPages&&<div className="scheduleValidity warn"><AlertTriangle size={16}/><span><b>Meta todavía no está configurado.</b> Agrega META_USER_ACCESS_TOKEN y reinicia Next.js.</span></div>}
    {error&&<div className="quickNotice error"><AlertTriangle size={16}/><span><b>No pudimos completar el análisis.</b> {error}</span></div>}

    <section className="insToolbar">
      <div className="insIdentity">
        <span className="insAvatar">{pageAvatar?<img src={pageAvatar} alt=""/>:<Facebook size={18}/>}</span>
        <div><strong>{page?.name||"Selecciona una página"}</strong><small>{pageSub}</small></div>
      </div>
      <div className="insControls">
        <label className="insControl insControlWide"><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)} disabled={loadingPages||!pages.length}>{pages.length?pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>):<option>Sin páginas</option>}</select></label>
        <div className="insControl"><span className="insControlLabel">Muestra</span><div className="segmented compact" role="group" aria-label="Tamaño de muestra">{[25,50,100].map(n=><button key={n} type="button" className={limit===n?"active":""} onClick={()=>setLimit(n)}>{n}</button>)}</div></div>
        <label className="insControl"><span>Zona horaria</span><select value={timeZone} onChange={e=>setTimeZone(e.target.value)}><option value="America/Mexico_City">CDMX</option><option value="America/Cancun">Cancún</option><option value="America/Tijuana">Tijuana</option><option value="America/New_York">Nueva York</option><option value="America/Los_Angeles">Los Ángeles</option><option value="Europe/Madrid">Madrid</option><option value="UTC">UTC</option></select></label>
        <button className="uiBtn uiBtnSecondary insRefresh" onClick={()=>loadAnalytics()} disabled={loading||!pageId}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar</button>
      </div>
    </section>

    <section className="insKpis">
      <Kpi label="Publicaciones" value={posts.length.toLocaleString("es-MX")} note={`Confianza ${recommendationConfidence.toLowerCase()}`}/>
      <Kpi label="Reacciones" value={fmt(totalReactions)} note={`${fmt(Math.round(avg(posts.map(p=>p.reactions))))} por post`}/>
      <Kpi label="Comentarios" value={fmt(totalComments)} note={`${fmt(Math.round(avg(posts.map(p=>p.comments))))} por post`}/>
      <Kpi label="Compartidos" value={fmt(totalShares)} note={`${fmt(Math.round(avg(posts.map(p=>p.shares))))} por post`}/>
      <Kpi label="Score medio" value={posts.length?avgScore.toFixed(1):"0"} note="Compartidos pesan más"/>
      {totalReach>0&&<Kpi label="Alcance" value={fmt(totalReach)} note="Solo posts con Insights"/>}
    </section>

    <section className="insCard insHighlight">
      <div className="insHighlightIcon"><WandSparkles size={18}/></div>
      <div className="insHighlightBody">
        <span className="insEyebrow">Qué probar hoy</span>
        {posts.length?<>
          <h2>{bestCategory?.label||"Contenido identificable"}{bestHour?` alrededor de las ${bestHour.label}`:""}</h2>
          <p>En esta muestra, <b>{bestCategory?.label||"esa categoría"}</b>{bestDay?` destaca sobre todo los ${bestDay.label.toLowerCase()}`:""}{bestFormat?` y el formato ${bestFormat.label.toLowerCase()} muestra una señal favorable`:""}. Tómalo como punto de partida y valídalo con nuevas publicaciones.</p>
          <div className="insTags"><span className="statusPill tone-accent">Confianza {recommendationConfidence.toLowerCase()}</span>{bestCategory&&<span className="statusPill tone-neutral">{bestCategory.count} posts comparados</span>}{bestHour&&<span className="statusPill tone-neutral"><Clock3 size={12}/> {bestHour.label}</span>}</div>
        </>:<>
          <h2>Carga publicaciones para generar una recomendación</h2>
          <p>Con la muestra de Meta compararemos categorías, horarios, días y formatos.</p>
        </>}
      </div>
    </section>

    <div className="insGrid2">
      <section className="insCard"><CardHead icon={<BarChart3 size={16}/>} title="Por categoría" note="Score promedio por publicación."/>{categoryRows.length?<div className="insBars">{categoryRows.slice(0,8).map((r,i)=><BarRow key={r.label} row={r} max={maxCategory} lead={i===0}/>)}</div>:<EmptyAnalytics/>}</section>
      <section className="insCard"><CardHead icon={<Clock3 size={16}/>} title="Por hora" note="Hora local de la zona seleccionada."/>{hourRows.length?<div className="insBars">{hourRows.slice(0,8).map((r,i)=><BarRow key={r.label} row={r} max={maxHour} lead={i===0}/>)}</div>:<EmptyAnalytics/>}</section>
    </div>

    <div className="insGrid2">
      <section className="insCard"><CardHead icon={<CalendarDays size={16}/>} title="Por día de la semana" note="Ordenado por score promedio."/>{dayRows.length?<RankTable rows={dayRows}/>:<EmptyAnalytics/>}</section>
      <section className="insCard"><CardHead icon={<Sparkles size={16}/>} title="Por formato" note="Texto frente a piezas con imagen."/>{formatRows.length?<RankTable rows={formatRows}/>:<EmptyAnalytics/>}</section>
    </div>

    <section className="insCard insFlush">
      <CardHead icon={<Flame size={16}/>} title="Mejores publicaciones" note="Si la Fábrica ya leyó la creatividad, usamos ese texto y su categoría."/>
      {topPosts.length?<div className="insPostTable">
        <div className="insPostRow insPostHead" aria-hidden="true"><span>#</span><span>Publicación</span><span className="insPostMetrics"><span>Reacc.</span><span>Coment.</span><span>Compart.</span><span>Score</span></span><span/></div>
        {topPosts.map((p,i)=>{const memory=libraryByPostId.get(p.id);const resolvedText=memory?.text?.trim()||p.message||"Publicación visual pendiente de lectura en Fábrica.";const resolvedCategory=memory?.category||detectCategory(p.message);return <article className="insPostRow" key={p.id}>
          <span className="insRank">{i+1}</span>
          <div className="insPostText"><p>{resolvedText}</p><small>{resolvedCategory}{p.createdTime?` · ${new Date(p.createdTime).toLocaleDateString("es-MX")}`:""}{memory?.extractionMetadata&&<span className="statusPill tone-success">Visión IA</span>}</small></div>
          <span className="insPostMetrics"><span data-label="Reacc.">{fmt(p.reactions)}</span><span data-label="Coment.">{fmt(p.comments)}</span><span data-label="Compart.">{fmt(p.shares)}</span><b data-label="Score">{performanceScore(p).toFixed(1)}</b></span>
          {p.permalinkUrl?<a className="insRowLink" href={p.permalinkUrl} target="_blank" rel="noreferrer" aria-label="Ver en Facebook" title="Ver en Facebook"><ExternalLink size={14}/></a>:<span/>}
        </article>})}
      </div>:<EmptyAnalytics/>}
    </section>

    <section className="insMetaStrip">
      <div className="insMetaTitle"><strong>Actividad de la herramienta</strong><small>{lastUpdated?`Meta actualizado a las ${new Date(lastUpdated).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}`:"Independiente del rendimiento en Facebook"}</small></div>
      <dl>
        <div><dt>En biblioteca</dt><dd>{importedCount.toLocaleString("es-MX")}</dd></div>
        <div><dt>Con texto recuperado</dt><dd>{enrichedCount.toLocaleString("es-MX")}</dd></div>
        <InternalMetric label="Calendarios" value={toolStats.calendars}/>
        <InternalMetric label="Posts en calendario" value={toolStats.scheduled}/>
        <InternalMetric label="Memoria editorial" value={toolStats.library}/>
        <InternalMetric label="Similitud alta" value={toolStats.duplicates}/>
      </dl>
    </section>
  </div>;
}

function Kpi({label,value,note}:{label:string;value:string;note:string}){return <div className="insKpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function CardHead({icon,title,note}:{icon:React.ReactNode;title:string;note:string}){return <div className="insCardHead"><div>{icon}<div><h2>{title}</h2><p>{note}</p></div></div></div>}
function BarRow({row,max,lead}:{row:AggregateRow;max:number;lead:boolean}){const width=Math.max(4,(row.avgScore/max)*100);return <div className={lead?"insBar lead":"insBar"}><div className="insBarLabel"><span>{row.label}</span><small>{row.count} posts · {fmt(row.shares)} compartidos</small></div><div className="insBarTrack"><i style={{width:`${width}%`}}/></div><strong>{row.avgScore.toFixed(1)}</strong></div>}
function RankTable({rows}:{rows:AggregateRow[]}){return <table className="insTable"><thead><tr><th>#</th><th>Segmento</th><th className="num">Posts</th><th className="num">Score</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.label}><td className="insMuted">{i+1}</td><td>{r.label}</td><td className="num insMuted">{r.count}</td><td className="num"><b>{r.avgScore.toFixed(1)}</b></td></tr>)}</tbody></table>}
function EmptyAnalytics(){return <div className="insEmpty"><BarChart3 size={18}/><span>Sin datos suficientes todavía.</span></div>}
function InternalMetric({label,value}:{label:string;value:number}){return <div><dt>{label}</dt><dd>{value.toLocaleString("es-MX")}</dd></div>}
