"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CircleAlert, ClipboardCheck, ExternalLink, Film, Globe2, Image as ImageIcon, Loader2, MessageCircle, Plus, Radar, RefreshCw, Search, Send, Share2, Sparkles, ThumbsUp } from "lucide-react";
import { metaOnly, useMetaQueue } from "@/lib/metaQueue";

type Status = "Borrador"|"Revisión"|"Aprobado"|"Programado"|"Publicado"|"Error";
type HomePost = { id:string; date:string; time:string; category:string; text:string; format:string; status:Status; imageUrl?:string; imageDataUrl?:string; metaPostId?:string };
type TimelinePost = HomePost & { fromMeta?:boolean };
type Props = {
  schedule:HomePost[];
  pageName?:string;
  pageId?:string;
  onNavigate:(tab:string)=>void;
  onOpenSearch:()=>void;
};

const pad=(n:number)=>String(n).padStart(2,"0");
const toISODate=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const statusTone:Record<Status,string>={Borrador:"neutral",Revisión:"warning",Aprobado:"success",Programado:"accent",Publicado:"muted",Error:"danger"};

function relativeDay(iso:string,today:string){
  if(iso===today)return "Hoy";
  const diff=Math.round((new Date(`${iso}T12:00:00`).getTime()-new Date(`${today}T12:00:00`).getTime())/86400000);
  if(diff===1)return "Mañana";
  return new Intl.DateTimeFormat("es-MX",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${iso}T12:00:00`));
}

export default function HomeDashboard({schedule,pageName,pageId="",onNavigate,onOpenSearch}:Props){
  const meta=useMetaQueue(pageId);
  const results=useRecentResults(pageId);
  const now=new Date();
  const today=toISODate(now);
  const nowKey=`${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const weekEnd=toISODate(new Date(now.getTime()+6*86400000));
  const greeting=now.getHours()<12?"Buenos días":now.getHours()<19?"Buenas tardes":"Buenas noches";
  const dateLabel=new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long"}).format(now);

  // Lo programado directo en Facebook (p. ej. en bulk) se suma a lo que vive en la app, sin duplicar.
  const fromMeta:TimelinePost[]=metaOnly(meta.posts,schedule).map(p=>({id:`meta-${p.id}`,date:p.date,time:p.time,category:p.category||"Programada en Facebook",text:p.text,format:p.format||"Texto",status:"Programado",fromMeta:true}));
  const pending:TimelinePost[]=[...schedule.filter(p=>p.status!=="Publicado"),...fromMeta];
  const todayCount=pending.filter(p=>p.date===today&&`${p.date} ${p.time}`>=nowKey).length;
  const weekCount=pending.filter(p=>p.date>=today&&p.date<=weekEnd).length;
  const reviewCount=schedule.filter(p=>p.status==="Borrador"||p.status==="Revisión").length;
  const errorCount=schedule.filter(p=>p.status==="Error").length;
  const upcoming=pending.filter(p=>`${p.date} ${p.time}`>=nowKey).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0,8);

  const quickActions=[
    {tab:"creator",icon:Sparkles,title:"Escribir un post",note:"Genera y edita un texto en segundos"},
    {tab:"bulkTexts",icon:Send,title:"Programar en bulk",note:"Carga muchos textos a la vez"},
    {tab:"radar",icon:Radar,title:"Buscar inspiración",note:"Analiza páginas de referencia"},
    {tab:"reels",icon:Film,title:"Gestionar Reels",note:"Prepara y programa video"},
  ];

  return <div className="home">
    <header className="homeHeader">
      <div>
        <span className="homeDate">{dateLabel}{pageName?` · ${pageName}`:""}</span>
        <h1>{greeting}</h1>
      </div>
      <div className="homeHeaderActions">
        <button className="uiBtn uiBtnSecondary" onClick={onOpenSearch}><Search size={16}/> Buscar <kbd>Ctrl K</kbd></button>
        <button className="uiBtn uiBtnPrimary" onClick={()=>onNavigate("creator")}><Plus size={16}/> Nuevo post</button>
      </div>
    </header>

    <section className="homeKpis">
      <HomeKpi label="Pendientes hoy" value={todayCount} onClick={()=>onNavigate("calendar")}/>
      <HomeKpi label="Próximos 7 días" value={weekCount} onClick={()=>onNavigate("calendar")}/>
      <HomeKpi label="Por revisar" value={reviewCount} tone={reviewCount?"warning":undefined} onClick={()=>onNavigate("queue")}/>
      <HomeKpi label="Con error" value={errorCount} tone={errorCount?"danger":undefined} onClick={()=>onNavigate("queue")}/>
    </section>

    <div className="homeGrid">
      <section className="homeCard">
        <div className="homeCardHead"><h2>Próximas publicaciones</h2><div className="homeCardTools"><button className="uiIconBtn homeRefresh" onClick={()=>void meta.refresh()} disabled={meta.loading} title="Actualizar cola de Facebook" aria-label="Actualizar cola de Facebook">{meta.loading?<Loader2 className="spin" size={15}/>:<RefreshCw size={15}/>}</button><button className="homeLink" onClick={()=>onNavigate("calendar")}>Ver calendario <ArrowRight size={14}/></button></div></div>
        {meta.error&&<p className="homeMetaError"><CircleAlert size={14}/> No se pudo leer la cola de Facebook: {meta.error}</p>}
        {meta.loading&&!upcoming.length?<div className="homeEmpty"><Loader2 className="spin" size={20}/><span>Consultando la cola de Facebook…</span></div>:upcoming.length?<ul className="homeTimeline">{upcoming.map(post=>{const thumb=post.imageUrl||post.imageDataUrl;return <li key={post.id}>
          <div className="homeWhen"><strong>{post.time}</strong><span>{relativeDay(post.date,today)}</span></div>
          <div className="homeThumb">{thumb?<img src={thumb} alt=""/>:post.fromMeta?<Globe2 size={16}/>:post.format==="Imagen"?<ImageIcon size={16}/>:<span>Aa</span>}</div>
          <div className="homePostBody"><p>{post.text||"Publicación sin texto (solo imagen)"}</p><span>{post.category}</span></div>
          <span className={`statusPill tone-${post.fromMeta?"accent":statusTone[post.status]||"neutral"}`}>{post.fromMeta?"En Facebook":post.status}</span>
        </li>})}</ul>:<div className="homeEmpty"><CalendarDays size={22}/><strong>No hay publicaciones próximas</strong><span>Programa un post o carga varios en bulk para llenar la semana.</span><button className="uiBtn uiBtnSecondary" onClick={()=>onNavigate("publisher")}>Programar post</button></div>}
      </section>

      <aside className="homeSide">
        <section className="homeCard">
          <div className="homeCardHead"><h2>Últimos 7 días</h2><button className="homeLink" onClick={()=>onNavigate("analytics")}>Ver resultados <ArrowRight size={14}/></button></div>
          {results.loading?<div className="homeEmpty compact"><Loader2 className="spin" size={18}/><span>Leyendo publicaciones de Facebook…</span></div>
          :results.error?<p className="homeMetaError"><CircleAlert size={14}/> {results.error}</p>
          :!results.count?<div className="homeEmpty compact"><span>No hay publicaciones en los últimos 7 días.</span></div>
          :<>
            <div className="homeStats">
              <div><span>Publicadas</span><strong>{results.count.toLocaleString("es-MX")}</strong></div>
              <div><span>Reacciones</span><strong>{results.reactions.toLocaleString("es-MX")}</strong></div>
              <div><span>Comentarios</span><strong>{results.comments.toLocaleString("es-MX")}</strong></div>
              <div><span>Compartidos</span><strong>{results.shares.toLocaleString("es-MX")}</strong></div>
            </div>
            {results.best&&<div className="homeBest">
              <span className="homeBestLabel">Mejor publicación</span>
              <div className="homeBestBody">{results.best.picture&&<img src={results.best.picture} alt=""/>}<p>{results.best.message||"Publicación sin texto"}</p></div>
              <div className="homeBestMeta"><span><ThumbsUp size={13}/> {results.best.reactions.toLocaleString("es-MX")}</span><span><MessageCircle size={13}/> {results.best.comments.toLocaleString("es-MX")}</span><span><Share2 size={13}/> {results.best.shares.toLocaleString("es-MX")}</span>{results.best.permalinkUrl&&<a href={results.best.permalinkUrl} target="_blank" rel="noreferrer" aria-label="Abrir en Facebook"><ExternalLink size={13}/></a>}</div>
            </div>}
          </>}
        </section>
        <section className="homeCard">
          <div className="homeCardHead"><h2>Accesos rápidos</h2></div>
          <div className="homeActions">{quickActions.map(action=>{const Icon=action.icon;return <button key={action.tab} className="homeAction" onClick={()=>onNavigate(action.tab)}><span className="homeActionIcon"><Icon size={17}/></span><span><strong>{action.title}</strong><small>{action.note}</small></span><ArrowRight size={15}/></button>})}</div>
        </section>
        {(reviewCount>0||errorCount>0)&&<section className="homeCard homeAttention">
          <div className="homeCardHead"><h2>Requiere atención</h2></div>
          {errorCount>0&&<button className="homeNotice danger" onClick={()=>onNavigate("queue")}><CircleAlert size={16}/><span>{errorCount} {errorCount===1?"publicación falló":"publicaciones fallaron"} al publicarse</span></button>}
          {reviewCount>0&&<button className="homeNotice warning" onClick={()=>onNavigate("queue")}><ClipboardCheck size={16}/><span>{reviewCount} {reviewCount===1?"borrador espera":"borradores esperan"} revisión</span></button>}
        </section>}
      </aside>
    </div>
  </div>;
}

function HomeKpi({label,value,tone,onClick}:{label:string;value:number;tone?:string;onClick:()=>void}){
  return <button className={`homeKpi ${tone?`tone-${tone}`:""}`} onClick={onClick}><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></button>;
}

type RecentPost = { id:string; message:string; createdTime:string|null; permalinkUrl:string|null; picture:string|null; reactions:number; comments:number; shares:number };

// Resultados reales de Facebook de la última semana para la página activa.
function useRecentResults(pageId:string){
  const [state,setState]=useState({loading:false,error:"",count:0,reactions:0,comments:0,shares:0,best:null as RecentPost|null});
  useEffect(()=>{
    if(!pageId)return;
    let current=true;
    setState(s=>({...s,loading:true,error:""}));
    fetch(`/api/meta/posts?pageId=${encodeURIComponent(pageId)}&limit=100&includeInsights=0`,{cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron leer los resultados.");return d.posts as RecentPost[]})
      .then(posts=>{
        if(!current)return;
        const since=Date.now()-7*86400000;
        const week=(posts||[]).filter(p=>p.createdTime&&new Date(p.createdTime).getTime()>=since);
        const score=(p:RecentPost)=>p.reactions+p.comments*2+p.shares*4;
        const best=week.reduce<RecentPost|null>((b,p)=>!b||score(p)>score(b)?p:b,null);
        setState({loading:false,error:"",count:week.length,reactions:week.reduce((n,p)=>n+p.reactions,0),comments:week.reduce((n,p)=>n+p.comments,0),shares:week.reduce((n,p)=>n+p.shares,0),best:best&&score(best)>0?best:null});
      })
      .catch(e=>{if(current)setState(s=>({...s,loading:false,error:e?.message||"No se pudieron leer los resultados."}))});
    return()=>{current=false};
  },[pageId]);
  return state;
}
