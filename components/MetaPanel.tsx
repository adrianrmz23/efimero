"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CloudDownload, ExternalLink, Loader2, MessageCircle, RadioTower, RefreshCw, Share2, ShieldCheck, ThumbsUp, Unplug, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveWorkingPageId } from "@/lib/workingPage";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type PageItem = { id:string; name:string; category?:string; fan_count?:number; followers_count?:number; picture?:{data?:{url?:string}}; tasks?:string[] };
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
  // MetaPanel conserva su propia carga (OAuth, datos extendidos de cada página),
  // pero avisa al contexto global para que el resto de la app se actualice.
  const {refresh:refreshSharedPages,setActivePage}=usePages();
  const confirm=useConfirm();

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
    if(!await confirm({
      title:"¿Desconectar Facebook?",
      description:`Efímero Content Engine dejará de acceder a ${connection?.facebookUser?.name?`la cuenta de ${connection.facebookUser.name}`:"tu cuenta de Facebook"}${pages.length?` y a sus ${pages.length} páginas`:""}. Las publicaciones importadas permanecerán en tu Biblioteca.`,
      confirmLabel:"Desconectar",
      tone:"danger",
    }))return;
    setSyncing(true);setError("");
    try{const r=await fetch("/api/meta/connection",{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible desconectar.");setConnection({connected:false});setPages([]);setPageId("");setPosts([]);setMessage("Facebook se desconectó correctamente.");void refreshSharedPages()}
    catch(e:any){setError(e?.message||"No fue posible desconectar Facebook.")}
    finally{setSyncing(false)}
  }

  async function syncPages(){
    setSyncing(true);setError("");setMessage("");
    try{const r=await fetch("/api/meta/sync-pages",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible actualizar las páginas.");setMessage(`${d.count||0} páginas sincronizadas.`);await loadConnection();void refreshSharedPages()}
    catch(e:any){setError(e?.message||"No fue posible actualizar las páginas.")}
    finally{setSyncing(false)}
  }

  async function choosePage(value:string){
    setPageId(value);setPosts([]);setSelected([]);
    if(connection?.connected)await setActivePage(value);
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

  const intro=<div className="pageIntro"><div><span className="overline">META</span><h1>Conexión con Facebook</h1><p>Conecta tu cuenta una sola vez. Efímero obtiene y cifra los tokens de tus páginas en el servidor; no necesitas Graph API Explorer.</p></div></div>;

  if(loading)return <>
    {intro}
    <section className="setCard"><div className="setEmpty"><Loader2 className="spin" size={20}/><strong>Comprobando conexión con Facebook…</strong></div></section>
  </>;

  const reconnect=connection?.status==="reconnect_required";
  const audience=(p:PageItem)=>typeof p.followers_count==="number"?`${Intl.NumberFormat("es-MX").format(p.followers_count)} seguidores`:typeof p.fan_count==="number"?`${Intl.NumberFormat("es-MX").format(p.fan_count)} Me gusta`:"Métrica no disponible";

  return <>
    {intro}
    <div className="setStack">
      {!connection?.connected ? <section className="setCard">
        <div className="setCardHead">
          <div className="setIdentity"><span className="setIconBox lg"><RadioTower size={20}/></span><div><div className="setIdentityTitle"><h2>Conecta tus páginas de Facebook</h2><span className="statusPill tone-neutral">Sin conexión</span></div><p>Inicia sesión con Meta, autoriza las páginas que administras y vuelve a Efímero automáticamente.</p></div></div>
          <button className="uiBtn uiBtnPrimary" onClick={connect}><RadioTower size={16}/> Conectar con Facebook</button>
        </div>
        <ul className="setFeatureList"><li><Check size={14}/>Login oficial de Meta</li><li><Check size={14}/>Varias páginas</li><li><Check size={14}/>Tokens cifrados que nunca llegan al navegador</li></ul>
      </section> : <section className="setCard">
        <div className="setCardHead">
          <div className="setIdentity"><span className={`setIconBox lg ${reconnect?"warning":"success"}`}>{reconnect?<AlertTriangle size={20}/>:<CheckCircle2 size={20}/>}</span><div><div className="setIdentityTitle"><h2>{connection.facebookUser?.name||"Cuenta de Facebook"}</h2><span className={`statusPill ${reconnect?"tone-warning":"tone-success"}`}>{reconnect?"Requiere reconexión":"Conectado"}</span></div><p>{reconnect?"Meta pide volver a autorizar la cuenta. Reconecta para seguir publicando.":"Las páginas y sus tokens se gestionan desde el servidor."}</p></div></div>
          <div className="setCardActions"><button className="uiBtn uiBtnSecondary" onClick={syncPages} disabled={syncing}>{syncing?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Actualizar páginas</button><button className="uiBtn uiBtnSecondary" onClick={connect}><RadioTower size={16}/> Reconectar</button><button className="uiBtn uiBtnGhost setDanger" onClick={disconnect}><Unplug size={16}/> Desconectar</button></div>
        </div>
        <dl className="setDetails"><div><dt>Páginas disponibles</dt><dd>{connection.pageCount||pages.length}</dd></div><div><dt>Conectado desde</dt><dd>{dateLabel(connection.connectedAt)}</dd></div><div><dt>Token de usuario</dt><dd>{connection?.expiresAt?`Vence ${dateLabel(connection.expiresAt)}`:connection?.connected?"Gestionado":"Legacy"}</dd></div></dl>
      </section>}

      {error&&<div className="setNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
      {message&&<div className="setNotice success"><CheckCircle2 size={16}/><span>{message}</span></div>}

      {pages.length>0&&<div className="setSplit">
        <section className="setCard flush">
          <div className="setCardHead"><div className="setCardTitle"><div><h2>Página principal</h2><p>La página elegida queda como selección principal en el resto de la plataforma.</p></div></div><span className="setTag">{pages.length} {pages.length===1?"página":"páginas"}</span></div>
          <div className="setRows setScroll" role="radiogroup" aria-label="Página principal">
            {pages.map(p=>{const active=p.id===pageId;return <button type="button" role="radio" aria-checked={active} key={p.id} className={active?"setSelectRow active":"setSelectRow"} onClick={()=>{if(!active)void choosePage(p.id)}}>
              <span className="setRadio"/>
              <span className="setIconBox">{p.picture?.data?.url?<img src={p.picture.data.url} alt=""/>:<Users size={16}/>}</span>
              <span className="setNavCopy"><strong>{p.name}</strong><small>{[p.category,audience(p),`ID …${p.id.slice(-6)}`].filter(Boolean).join(" · ")}</small></span>
              {active&&<span className="statusPill tone-accent">Principal</span>}
            </button>})}
          </div>
        </section>

        <section className="setCard setSticky">
          <div className="setCardTitle"><CloudDownload size={18}/><div><h2>Importar publicaciones</h2><p>Trae publicaciones de {currentPage?.name||"la página principal"} a tu Biblioteca.</p></div></div>
          <label className="setField"><span>Cantidad</span><select value={limit} onChange={e=>setLimit(Number(e.target.value))}><option value={10}>10 recientes</option><option value={25}>25 recientes</option><option value={50}>50 recientes</option><option value={100}>100 recientes</option></select></label>
          <label className="setCheckRow"><input type="checkbox" checked={includeInsights} onChange={e=>setIncludeInsights(e.target.checked)}/><span>Intentar recuperar métricas adicionales de Insights</span></label>
          <button className={`uiBtn ${posts.length?"uiBtnSecondary":"uiBtnPrimary"} wide`} onClick={loadPosts} disabled={loadingPosts}>{loadingPosts?<Loader2 className="spin" size={16}/>:<CloudDownload size={16}/>} Traer publicaciones</button>
        </section>
      </div>}

      {posts.length>0&&<section className="setCard flush">
        <div className="setCardHead">
          <div className="setCardTitle"><div><h2>Vista previa</h2><p>{newPosts.length} nuevas de {posts.length} cargadas · {totals.reactions.toLocaleString("es-MX")} reacciones · {totals.shares.toLocaleString("es-MX")} compartidos</p></div></div>
          <div className="setCardActions"><button className="uiBtn uiBtnGhost setSmall" onClick={()=>setSelected(newPosts.map(p=>p.id))}>Seleccionar nuevas</button><button className="uiBtn uiBtnPrimary setSmall" onClick={importSelected} disabled={importing||!selectedPosts.length}>{importing?<Loader2 className="spin" size={16}/>:<CloudDownload size={16}/>} Importar {selectedPosts.length}</button></div>
        </div>
        <div className="setRows">{posts.map(post=>{const done=importedSet.has(post.id);return <label className={done?"setPostRow done":"setPostRow"} key={post.id}>
          <input type="checkbox" disabled={done} checked={selected.includes(post.id)} onChange={()=>setSelected(c=>c.includes(post.id)?c.filter(x=>x!==post.id):[...c,post.id])}/>
          <div className="setRowMain"><p className="setRowText clamp3">{post.message}</p><div className="setMeta"><span><ThumbsUp size={13}/>{post.reactions.toLocaleString("es-MX")}</span><span><MessageCircle size={13}/>{post.comments.toLocaleString("es-MX")}</span><span><Share2 size={13}/>{post.shares.toLocaleString("es-MX")}</span>{post.createdTime&&<span>{dateLabel(post.createdTime)}</span>}</div></div>
          <div className="setRowEnd">{done&&<span className="statusPill tone-muted">Importada</span>}{post.permalinkUrl&&<a className="uiIconBtn" href={post.permalinkUrl} target="_blank" rel="noreferrer" aria-label="Abrir en Facebook"><ExternalLink size={15}/></a>}</div>
        </label>})}</div>
      </section>}

      <p className="pageFootnote"><ShieldCheck size={14}/>Los tokens de página se guardan cifrados en el servidor y nunca se envían al navegador. Las publicaciones importadas permanecen en tu Biblioteca aunque desconectes Facebook.</p>
    </div>
  </>;
}
