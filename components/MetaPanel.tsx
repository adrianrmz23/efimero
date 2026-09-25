"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, CloudDownload, ExternalLink, Share2, Loader2, RadioTower, RefreshCw, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PageItem = { id:string; name:string; category?:string; fan_count?:number; picture?:{data?:{url?:string}} };
type MetaPost = { id:string; message:string; createdTime?:string|null; permalinkUrl?:string|null; picture?:string|null; reactions:number; comments:number; shares:number; reach:number };
type ImportedItem = {
  id:string; text:string; category:string; format:string; createdAt:string; source:"historical"; sourceUrl?:string;
  reactions:number; comments:number; shares:number; reach:number; publishedAt?:string; performanceScore:number; favorite:boolean;
  platform:"facebook"; platformPostId:string; sourcePageId:string; sourcePageName:string;
};

type Props = {
  existingPostIds: string[];
  onImported: (items: ImportedItem[]) => void;
};

const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function detectCategory(text:string){const t=normalize(text);if(/[?¿]/.test(text))return "Preguntas";if(/jaja|adulto|banco|dormir|cenar|vacaciones|trabajo|lunes|viernes|economia/.test(t))return "Humor";if(/noche|dormir|cama|madrugada|manana/.test(t))return "Pensamientos nocturnos";if(/recuerdo|recordar|antes|infancia|cancion|foto|epoca|volver|nostalgia/.test(t))return "Nostalgia";if(/amor|pareja|querer|carino|persona|relacion|corazon|quedar|irse|quedarse/.test(t))return "Relaciones";if(/avanzar|empezar|seguir|ritmo|puedes|lograr|paso|rendirse/.test(t))return "Motivación ligera";if(/cafe|casa|comer|dia|tiempo|plan|comprar|vida adulta/.test(t))return "Vida cotidiana";return "Frases identificables"}
function calcPerformance(reactions=0,comments=0,shares=0,reach=0){const weighted=reactions+comments*2+shares*4;if(reach>0)return Math.round((weighted/reach)*10000)/10;return Math.round(Math.log10(weighted+1)*100)/10}

export default function MetaPanel({existingPostIds,onImported}:Props){
  const [pages,setPages]=useState<PageItem[]>([]);
  const [pageId,setPageId]=useState("");
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [loadingPages,setLoadingPages]=useState(true);
  const [loadingPosts,setLoadingPosts]=useState(false);
  const [importing,setImporting]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [limit,setLimit]=useState(25);
  const [includeInsights,setIncludeInsights]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);

  const currentPage=pages.find(p=>p.id===pageId);
  const selectedPosts=posts.filter(p=>selected.includes(p.id));
  const importedSet=useMemo(()=>new Set(existingPostIds),[existingPostIds]);
  const newPosts=posts.filter(p=>!importedSet.has(p.id));
  const totals=useMemo(()=>posts.reduce((acc,p)=>({reactions:acc.reactions+p.reactions,comments:acc.comments+p.comments,shares:acc.shares+p.shares,reach:acc.reach+p.reach}),{reactions:0,comments:0,shares:0,reach:0}),[posts]);
  const topPost=useMemo(()=>[...posts].sort((a,b)=>calcPerformance(b.reactions,b.comments,b.shares,b.reach)-calcPerformance(a.reactions,a.comments,a.shares,a.reach))[0],[posts]);

  useEffect(()=>{void loadPages()},[]);

  async function loadPages(){
    setLoadingPages(true);setError("");setMessage("");
    try{
      const r=await fetch("/api/meta/pages",{cache:"no-store"});const data=await r.json();
      setConfigured(Boolean(data.configured));
      if(!r.ok){setError(data.error||"No fue posible comprobar Meta.");setPages([]);return}
      setPages(data.pages||[]);if(data.pages?.length)setPageId((old:string)=>old||data.pages[0].id);
      if(!data.configured)setMessage(data.message||"Configura las credenciales de Meta en .env.local.");
    }catch{setConfigured(false);setError("No fue posible conectar con el endpoint local de Meta.")}
    finally{setLoadingPages(false)}
  }

  async function loadPosts(){
    if(!pageId)return;setLoadingPosts(true);setError("");setMessage("");
    try{
      const qs=new URLSearchParams({pageId,limit:String(limit),includeInsights:includeInsights?"1":"0"});
      const r=await fetch(`/api/meta/posts?${qs.toString()}`,{cache:"no-store"});const data=await r.json();
      if(!r.ok){setError(data.error||"No fue posible traer publicaciones.");setPosts([]);return}
      const clean=(data.posts||[]).filter((p:MetaPost)=>p.message?.trim());setPosts(clean);setSelected(clean.filter((p:MetaPost)=>!importedSet.has(p.id)).map((p:MetaPost)=>p.id));
      setMessage(clean.length?`${clean.length} publicaciones cargadas desde Facebook.`:"Meta respondió correctamente, pero no llegaron publicaciones con texto.");
    }catch{setError("Falló la consulta a Meta.")}
    finally{setLoadingPosts(false)}
  }

  function togglePost(id:string){setSelected(c=>c.includes(id)?c.filter(x=>x!==id):[...c,id])}
  function selectNew(){setSelected(newPosts.map(p=>p.id))}

  async function importSelected(){
    if(!selectedPosts.length||!currentPage)return;setImporting(true);setError("");setMessage("");
    try{
      const items:ImportedItem[]=selectedPosts.filter(p=>!importedSet.has(p.id)).map(p=>({
        id:crypto.randomUUID(),text:p.message.trim(),category:detectCategory(p.message),format:p.picture?"Imagen":"Texto",createdAt:new Date().toISOString(),source:"historical",sourceUrl:p.permalinkUrl||undefined,
        reactions:p.reactions,comments:p.comments,shares:p.shares,reach:p.reach,publishedAt:p.createdTime||undefined,performanceScore:calcPerformance(p.reactions,p.comments,p.shares,p.reach),favorite:false,
        platform:"facebook",platformPostId:p.id,sourcePageId:currentPage.id,sourcePageName:currentPage.name,
      }));
      if(!items.length){setMessage("Todo lo seleccionado ya existe en la Biblioteca.");return}
      let normalized=items;
      if(supabase){
        const rows=items.map(i=>({text:i.text,category:i.category,format:i.format,status:"historical",source:"historical",source_url:i.sourceUrl||null,reactions:i.reactions,comments:i.comments,shares:i.shares,reach:i.reach,published_at:i.publishedAt||null,performance_score:i.performanceScore,favorite:false,platform:"facebook",platform_post_id:i.platformPostId,source_page_id:i.sourcePageId,source_page_name:i.sourcePageName,last_synced_at:new Date().toISOString()}));
        const {data,error}=await supabase.from("efimero_content_library").upsert(rows,{onConflict:"platform_post_id",ignoreDuplicates:true}).select("id,text,category,format,created_at,source_url,reactions,comments,shares,reach,published_at,performance_score,favorite,platform,platform_post_id,source_page_id,source_page_name");
        if(error)throw error;
        if(data?.length)normalized=data.map((x:any)=>({id:x.id,text:x.text,category:x.category,format:x.format,createdAt:x.created_at,source:"historical" as const,sourceUrl:x.source_url||undefined,reactions:Number(x.reactions||0),comments:Number(x.comments||0),shares:Number(x.shares||0),reach:Number(x.reach||0),publishedAt:x.published_at||undefined,performanceScore:Number(x.performance_score||0),favorite:Boolean(x.favorite),platform:"facebook" as const,platformPostId:x.platform_post_id,sourcePageId:x.source_page_id,sourcePageName:x.source_page_name}));
        await supabase.from("efimero_meta_sync_runs").insert({page_id:currentPage.id,page_name:currentPage.name,requested_posts:selectedPosts.length,imported_posts:normalized.length,include_insights:includeInsights});
      }
      onImported(normalized);setSelected([]);setMessage(`${normalized.length} publicaciones se agregaron a la Biblioteca de Efímero.`);
    }catch(e:any){setError(e?.message||"No fue posible guardar la importación.")}
    finally{setImporting(false)}
  }

  return <>
    <div className="pageIntro"><div><span className="overline">META CONNECTOR</span><h1>Sincroniza tus páginas con Facebook</h1><p>Elige cualquiera de tus páginas administradas, revisa sus publicaciones y agrega a la Biblioteca solo lo que quieras conservar como memoria editorial.</p></div><div className={`metaConnectionBadge ${configured?"connected":""}`}><RadioTower size={18}/><span>{loadingPages?"Comprobando…":configured?"Credenciales detectadas":"Sin configurar"}</span></div></div>

    <section className="metaHero">
      <div className="metaHeroIcon"><Share2 size={30}/></div><div><span className="metaKicker">CONEXIÓN SEGURA</span><h2>Los tokens viven únicamente en el servidor</h2><p>El navegador nunca recibe el Page Access Token. La web llama a rutas internas de Next.js y esas rutas consultan Graph API por ti.</p></div><ShieldCheck size={34}/>
    </section>

    {!configured&&!loadingPages&&<section className="metaSetupCard"><AlertTriangle size={22}/><div><h2>Falta configurar Meta</h2><p>Agrega las variables de Meta en <code>.env.local</code>, reinicia <code>npm run dev</code> y vuelve a comprobar.</p><pre>{`META_USER_ACCESS_TOKEN=\nMETA_GRAPH_VERSION=v26.0\nMETA_POST_REACH_METRIC=`}</pre><small>La opción multipágina obtiene el Page Access Token en el servidor cuando eliges una página; nunca se expone al navegador.</small></div><button onClick={loadPages}><RefreshCw size={16}/> Reintentar</button></section>}

    <div className="metaGrid">
      <section className="toolPanel metaControlPanel"><div className="panelTitle"><div><CloudDownload size={20}/><div><h2>Importar publicaciones</h2><p>Selecciona la página, cantidad de posts y si quieres intentar recuperar alcance.</p></div></div></div>
        <div className="metaFormGrid"><label><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)} disabled={!pages.length}>{pages.length?pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>):<option>Sin páginas</option>}</select></label><label><span>Publicaciones</span><select value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} recientes</option>)}</select></label></div>
        <label className="metaCheck"><input type="checkbox" checked={includeInsights} onChange={e=>setIncludeInsights(e.target.checked)}/><span><strong>Intentar recuperar alcance</strong><small>Hace consultas adicionales de Insights y puede ser más lento. Si Meta no permite la métrica, la importación continúa con alcance en 0.</small></span></label>
        <button className="metaPrimaryButton" onClick={loadPosts} disabled={!configured||!pageId||loadingPosts}>{loadingPosts?<Loader2 className="spin" size={18}/>:<CloudDownload size={18}/>} {loadingPosts?"Consultando Facebook…":"Traer publicaciones"}</button>
        {message&&<div className="metaNotice success"><CheckCircle2 size={16}/>{message}</div>}{error&&<div className="metaNotice error"><AlertTriangle size={16}/>{error}</div>}
      </section>

      <section className="toolPanel metaStatsPanel"><div className="panelTitle"><div><BarChart3 size={20}/><div><h2>Vista rápida</h2><p>Resumen de lo cargado antes de guardarlo.</p></div></div></div><div className="metaStats"><article><span>Cargados</span><strong>{posts.length}</strong><small>{newPosts.length} nuevos</small></article><article><span>Reacciones</span><strong>{totals.reactions.toLocaleString("es-MX")}</strong><small>en la muestra</small></article><article><span>Compartidos</span><strong>{totals.shares.toLocaleString("es-MX")}</strong><small>señal prioritaria</small></article><article><span>Alcance</span><strong>{totals.reach.toLocaleString("es-MX")}</strong><small>{includeInsights?"si está disponible":"no solicitado"}</small></article></div>{topPost&&<div className="topMetaPost"><TrendingUp size={18}/><div><span>Mejor señal de la muestra</span><p>{topPost.message}</p></div></div>}</section>
    </div>

    {posts.length>0&&<section className="toolPanel metaPostsPanel"><div className="metaPostsHeader"><div><span className="metaKicker">PREVISUALIZACIÓN</span><h2>{selected.length} seleccionadas de {posts.length}</h2><p>Las publicaciones ya importadas se marcan y no se duplican.</p></div><div className="metaHeaderActions"><button onClick={selectNew}>Seleccionar nuevas</button><button className="metaImportButton" onClick={importSelected} disabled={!selected.length||importing}>{importing?<Loader2 className="spin" size={17}/>:<Sparkles size={17}/>} Importar {selected.length}</button></div></div><div className="metaPostList">{posts.map(post=>{const imported=importedSet.has(post.id);const score=calcPerformance(post.reactions,post.comments,post.shares,post.reach);return <article key={post.id} className={`metaPostRow ${selected.includes(post.id)?"selected":""} ${imported?"imported":""}`}><button className="metaSelect" onClick={()=>!imported&&togglePost(post.id)} disabled={imported}>{imported?<CheckCircle2 size={18}/>:<span>{selected.includes(post.id)?"✓":""}</span>}</button><div className="metaPostBody"><div className="metaPostMeta"><span>{post.createdTime?new Date(post.createdTime).toLocaleString("es-MX"):"Sin fecha"}</span><b>{detectCategory(post.message)}</b>{score>0&&<em><TrendingUp size={12}/>{score}</em>}</div><p>{post.message}</p><div className="metaMetrics"><span>👍 {post.reactions.toLocaleString("es-MX")}</span><span>💬 {post.comments.toLocaleString("es-MX")}</span><span>↗ {post.shares.toLocaleString("es-MX")}</span>{post.reach>0&&<span>◎ {post.reach.toLocaleString("es-MX")}</span>}{imported&&<strong>Ya está en Biblioteca</strong>}</div></div>{post.permalinkUrl&&<a href={post.permalinkUrl} target="_blank" rel="noreferrer" aria-label="Abrir en Facebook"><ExternalLink size={17}/></a>}</article>})}</div></section>}
  </>
}
