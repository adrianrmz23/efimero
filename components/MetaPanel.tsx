"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudDownload, ExternalLink, Loader2, RadioTower, RefreshCw, ShieldCheck, Unplug, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { persistWorkingPage, resolveWorkingPageId } from "@/lib/workingPage";

type PageItem = { id:string; name:string; category?:string; fan_count?:number; picture?:{data?:{url?:string}}; tasks?:string[] };
type MetaPost = { id:string; message:string; createdTime?:string|null; permalinkUrl?:string|null; picture?:string|null; reactions:number; comments:number; shares:number; reach:number };
type Connection = { connected:boolean; status?:string; facebookUser?:{id:string;name:string}; connectedAt?:string; expiresAt?:string|null; lastVerifiedAt?:string; activePageId?:string|null; pageCount?:number; scopes?:string[] };
type ImportedItem = {
  id:string; text:string; category:string; format:string; createdAt:string; source:"historical"; sourceUrl?:string;
  reactions:number; comments:number; shares:number; reach:number; publishedAt?:string; performanceScore:number; favorite:boolean;
  platform:"facebook"; platformPostId:string; sourcePageId:string; sourcePageName:string;
};
type Props = { existingPostIds:string[]; onImported:(items:ImportedItem[])=>void };

const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function detectCategory(text:string){const t=normalize(text);if(/[?¿]/.test(text))return "Preguntas";if(/jaja|adulto|banco|dormir|cenar|vacaciones|trabajo|lunes|viernes|economia/.test(t))return "Humor";if(/noche|dormir|cama|madrugada|manana/.test(t))return "Pensamientos nocturnos";if(/recuerdo|recordar|antes|infancia|cancion|foto|epoca|volver|nostalgia/.test(t))return "Nostalgia";if(/amor|pareja|querer|carino|persona|relacion|corazon|quedar|irse|quedarse/.test(t))return "Relaciones";if(/avanzar|empezar|seguir|ritmo|puedes|lograr|paso|rendirse/.test(t))return "Motivación ligera";if(/cafe|casa|comer|dia|tiempo|plan|comprar|vida adulta/.test(t))return "Vida cotidiana";return "Frases identificables"}
function calcPerformance(reactions=0,comments=0,shares=0,reach=0){const weighted=reactions+comments*2+shares*4;if(reach>0)return Math.round((weighted/reach)*10000)/10;return Math.round(Math.log10(weighted+1)*100)/10}
function dateLabel(value?:string|null){if(!value)return "—";try{return new Intl.DateTimeFormat("es-MX",{dateStyle:"medium"}).format(new Date(value))}catch{return "—"}}

export default function MetaPanel({existingPostIds,onImported}:Props){
  const [connection,setConnection]=useState<Connection|null>(null);
  const [pages,setPages]=useState<PageItem[]>([]);
  const [pageId,setPageId]=useState("");
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadingPosts,setLoadingPosts]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [importing,setImporting]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [limit,setLimit]=useState(25);
  const [includeInsights,setIncludeInsights]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);

  const currentPage=pages.find(p=>p.id===pageId);
  const importedSet=useMemo(()=>new Set(existingPostIds),[existingPostIds]);
  const selectedPosts=posts.filter(p=>selected.includes(p.id));
  const newPosts=posts.filter(p=>!importedSet.has(p.id));
  const totals=useMemo(()=>posts.reduce((a,p)=>({reactions:a.reactions+p.reactions,comments:a.comments+p.comments,shares:a.shares+p.shares,reach:a.reach+p.reach}),{reactions:0,comments:0,shares:0,reach:0}),[posts]);

  useEffect(()=>{void loadConnection()},[]);

  async function loadConnection(){
    setLoading(true);setError("");
    try{
      const [cRes,pRes]=await Promise.all([fetch("/api/meta/connection",{cache:"no-store"}),fetch("/api/meta/pages",{cache:"no-store"})]);
      const c=await cRes.json();const p=await pRes.json();
      if(cRes.ok)setConnection(c); else if(cRes.status!==404)setError(c.error||"No fue posible comprobar Facebook.");
      const list=p.pages||[];setPages(list);
      const active=resolveWorkingPageId(list,p.activePageId||c.activePageId);setPageId(active);
      if(p.error&&!error)setError(p.error);
    }catch{setError("No fue posible conectar con las rutas privadas de Meta.")}
    finally{setLoading(false)}
  }

  function connect(){window.location.href="/api/auth/meta/start"}

  async function disconnect(){
    if(!confirm("¿Desconectar Facebook de Efímero Content Engine? Las publicaciones importadas permanecerán en tu Biblioteca."))return;
    setSyncing(true);setError("");
    try{const r=await fetch("/api/meta/connection",{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible desconectar.");setConnection({connected:false});setPages([]);setPageId("");setPosts([]);setMessage("Facebook se desconectó correctamente.")}
    catch(e:any){setError(e?.message||"No fue posible desconectar Facebook.")}
    finally{setSyncing(false)}
  }

  async function syncPages(){
    setSyncing(true);setError("");setMessage("");
    try{const r=await fetch("/api/meta/sync-pages",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible actualizar las páginas.");setMessage(`${d.count||0} páginas sincronizadas.`);await loadConnection()}
    catch(e:any){setError(e?.message||"No fue posible actualizar las páginas.")}
    finally{setSyncing(false)}
  }

  async function choosePage(value:string){
    setPageId(value);setPosts([]);setSelected([]);
    if(connection?.connected)await persistWorkingPage(value);
  }

  async function loadPosts(){
    if(!pageId)return;setLoadingPosts(true);setError("");setMessage("");
    try{
      const qs=new URLSearchParams({pageId,limit:String(limit),includeInsights:includeInsights?"1":"0"});
      const r=await fetch(`/api/meta/posts?${qs}`,{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error||"No fue posible traer publicaciones.");
      const clean=(data.posts||[]).filter((p:MetaPost)=>p.message?.trim());setPosts(clean);setSelected(clean.filter((p:MetaPost)=>!importedSet.has(p.id)).map((p:MetaPost)=>p.id));setMessage(clean.length?`${clean.length} publicaciones con texto cargadas.`:"Meta respondió, pero la muestra no contiene publicaciones con texto.")
    }catch(e:any){setError(e?.message||"Falló la consulta a Meta.");setPosts([])}finally{setLoadingPosts(false)}
  }

  async function importSelected(){
    if(!selectedPosts.length||!currentPage)return;setImporting(true);setError("");setMessage("");
    try{
      const items:ImportedItem[]=selectedPosts.filter(p=>!importedSet.has(p.id)).map(p=>({id:crypto.randomUUID(),text:p.message.trim(),category:detectCategory(p.message),format:p.picture?"Imagen":"Texto",createdAt:new Date().toISOString(),source:"historical",sourceUrl:p.permalinkUrl||undefined,reactions:p.reactions,comments:p.comments,shares:p.shares,reach:p.reach,publishedAt:p.createdTime||undefined,performanceScore:calcPerformance(p.reactions,p.comments,p.shares,p.reach),favorite:false,platform:"facebook",platformPostId:p.id,sourcePageId:currentPage.id,sourcePageName:currentPage.name}));
      let normalized=items;
      if(supabase&&items.length){
        const rows=items.map(i=>({text:i.text,category:i.category,format:i.format,status:"historical",source:"historical",source_url:i.sourceUrl||null,reactions:i.reactions,comments:i.comments,shares:i.shares,reach:i.reach,published_at:i.publishedAt||null,performance_score:i.performanceScore,favorite:false,platform:"facebook",platform_post_id:i.platformPostId,source_page_id:i.sourcePageId,source_page_name:i.sourcePageName,last_synced_at:new Date().toISOString()}));
        const {data,error}=await supabase.from("efimero_content_library").upsert(rows,{onConflict:"platform_post_id",ignoreDuplicates:true}).select("*");if(error)throw error;
        if(data?.length)normalized=data.map((x:any)=>({id:x.id,text:x.text,category:x.category,format:x.format,createdAt:x.created_at,source:"historical" as const,sourceUrl:x.source_url||undefined,reactions:Number(x.reactions||0),comments:Number(x.comments||0),shares:Number(x.shares||0),reach:Number(x.reach||0),publishedAt:x.published_at||undefined,performanceScore:Number(x.performance_score||0),favorite:Boolean(x.favorite),platform:"facebook" as const,platformPostId:x.platform_post_id,sourcePageId:x.source_page_id,sourcePageName:x.source_page_name}));
      }
      onImported(normalized);setSelected([]);setMessage(`${normalized.length} publicaciones se agregaron a la Biblioteca.`)
    }catch(e:any){setError(e?.message||"No fue posible guardar la importación.")}finally{setImporting(false)}
  }

  if(loading)return <div className="emptyState"><Loader2 className="spin"/> Comprobando conexión con Facebook…</div>;

  return <>
    <div className="pageIntro"><div><span className="overline">META CONNECTOR</span><h1>Facebook dentro de Efímero</h1><p>Conecta tu cuenta una sola vez. Efímero obtiene y cifra los tokens de las páginas en el servidor; ya no necesitas usar Graph API Explorer.</p></div></div>

    {!connection?.connected ? <section className="metaConnectHero">
      <div className="metaConnectIcon"><RadioTower size={28}/></div>
      <div className="metaConnectCopy"><span className="overline">CONEXIÓN OAUTH</span><h2>Conecta tus páginas de Facebook</h2><p>Inicia sesión con Meta, autoriza las páginas que administras y regresa automáticamente a Efímero. Los tokens se guardan cifrados y nunca se envían al navegador.</p><div className="metaConnectBadges"><span>✓ Login oficial de Meta</span><span>✓ Multipágina</span><span>✓ Tokens cifrados</span></div></div>
      <button className="uiBtn uiBtnPrimary" onClick={connect}>Conectar con Facebook</button>
    </section> : <section className={`metaConnectionCard ${connection.status==="reconnect_required"?"warning":""}`}>
      <div className="metaConnectionIdentity"><div className="metaConnectionIcon">{connection.status==="reconnect_required"?<AlertTriangle/>:<CheckCircle2/>}</div><div><span className="overline">{connection.status==="reconnect_required"?"RECONEXIÓN NECESARIA":"FACEBOOK CONECTADO"}</span><h2>{connection.facebookUser?.name||"Cuenta de Facebook"}</h2><p>{connection.pageCount||pages.length} páginas disponibles · conectado {dateLabel(connection.connectedAt)}</p></div></div>
      <div className="metaConnectionActions"><button className="uiBtn uiBtnSecondary" onClick={syncPages} disabled={syncing}>{syncing?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar páginas</button><button className="uiBtn uiBtnSecondary" onClick={connect}><RadioTower size={16}/> Reconectar</button><button className="uiBtn uiBtnDanger" onClick={disconnect}><Unplug size={16}/> Desconectar</button></div>
    </section>}

    {error&&<div className="alert error"><AlertTriangle size={17}/>{error}</div>}{message&&<div className="alert success"><CheckCircle2 size={17}/>{message}</div>}

    {pages.length>0&&<div className="metaGrid"><section className="panel"><div className="panelHead"><div><h2><CloudDownload/> Importar publicaciones</h2><p>La página elegida queda guardada como selección principal para el resto de la plataforma.</p></div></div>
      <div className="fieldGrid"><label>Página<select value={pageId} onChange={e=>choosePage(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Publicaciones<select value={limit} onChange={e=>setLimit(Number(e.target.value))}><option value={10}>10 recientes</option><option value={25}>25 recientes</option><option value={50}>50 recientes</option><option value={100}>100 recientes</option></select></label></div>
      {currentPage&&<div className="selectedPageMini">{currentPage.picture?.data?.url?<img src={currentPage.picture.data.url} alt=""/>:<Users/>}<div><strong>{currentPage.name}</strong><span>{currentPage.fan_count?`${Intl.NumberFormat("es-MX",{notation:"compact"}).format(currentPage.fan_count)} seguidores`:currentPage.category||"Página de Facebook"}</span></div></div>}
      <label className="checkRow"><input type="checkbox" checked={includeInsights} onChange={e=>setIncludeInsights(e.target.checked)}/><span>Intentar recuperar métricas adicionales de Insights</span></label>
      <button className="uiBtn uiBtnPrimary wide" onClick={loadPosts} disabled={loadingPosts}>{loadingPosts?<Loader2 className="spin" size={18}/>:<CloudDownload size={18}/>} Traer publicaciones</button>
    </section>

    <section className="panel"><div className="panelHead"><div><h2><ShieldCheck/> Conexión segura</h2><p>Información operativa de esta conexión.</p></div></div><div className="quickStats"><div><span>Páginas</span><strong>{pages.length}</strong></div><div><span>Token usuario</span><strong>{connection?.expiresAt?dateLabel(connection.expiresAt):connection?.connected?"Gestionado":"Legacy"}</strong></div><div><span>Reacciones</span><strong>{totals.reactions.toLocaleString("es-MX")}</strong></div><div><span>Compartidos</span><strong>{totals.shares.toLocaleString("es-MX")}</strong></div></div></section></div>}

    {posts.length>0&&<section className="panel metaPostsPanel"><div className="panelHead"><div><h2>Vista previa</h2><p>{newPosts.length} publicaciones nuevas de {posts.length} cargadas.</p></div><div className="rowActions"><button className="uiBtn uiBtnSecondary uiBtnSmall" onClick={()=>setSelected(newPosts.map(p=>p.id))}>Seleccionar nuevas</button><button className="uiBtn uiBtnPrimary uiBtnSmall" onClick={importSelected} disabled={importing||!selectedPosts.length}>{importing?<Loader2 className="spin" size={16}/>:null} Importar {selectedPosts.length}</button></div></div><div className="metaPostList">{posts.map(post=><label className={`metaPostRow ${importedSet.has(post.id)?"alreadyImported":""}`} key={post.id}><input type="checkbox" disabled={importedSet.has(post.id)} checked={selected.includes(post.id)} onChange={()=>setSelected(c=>c.includes(post.id)?c.filter(x=>x!==post.id):[...c,post.id])}/><div className="metaPostText"><p>{post.message}</p><span>👍 {post.reactions.toLocaleString("es-MX")} · 💬 {post.comments.toLocaleString("es-MX")} · ↗ {post.shares.toLocaleString("es-MX")}</span></div>{post.permalinkUrl&&<a href={post.permalinkUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}</label>)}</div></section>}
  </>;
}
