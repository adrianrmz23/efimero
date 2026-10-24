"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useState } from "react";
import { Archive, Info, Loader2, MessageCircle, MessagesSquare, RefreshCw, Sparkles, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePages } from "@/lib/pagesContext";

type Props={onSaveItems:(items:any[])=>Promise<void>|void};
type Post={id:string;message:string;createdTime?:string;comments:number;reactions:number;shares:number};
type Comment={id:string;message:string;createdTime?:string;likeCount:number};
export default function AudienceVoice({onSaveItems}:Props){
 const {pages,activePageId}=usePages();
 // Selección local: elegir otra página aquí no cambia la página activa global.
 const [localPageId,setPageId]=useState("");
 const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
 const[posts,setPosts]=useState<Post[]>([]);const[postId,setPostId]=useState("");const[comments,setComments]=useState<Comment[]>([]);const[loading,setLoading]=useState(false);const[analyzing,setAnalyzing]=useState(false);const[result,setResult]=useState<any>(null);const[notice,setNotice]=useState("");
 const page=pages.find(p=>p.id===pageId);const post=posts.find(p=>p.id===postId);
 async function loadPosts(){if(!pageId)return;setLoading(true);setResult(null);setComments([]);try{const r=await fetch(`/api/meta/posts?pageId=${encodeURIComponent(pageId)}&limit=50&includeInsights=0`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);const list=d.posts||[];setPosts(list);if(list.length)setPostId(list[0].id);setNotice(`${list.length} publicaciones disponibles.`)}catch(e:any){setNotice(e.message||"No fue posible cargar publicaciones.")}finally{setLoading(false)}}
 async function loadComments(){if(!pageId||!postId)return;setLoading(true);setResult(null);try{const r=await fetch(`/api/meta/comments?pageId=${encodeURIComponent(pageId)}&postId=${encodeURIComponent(postId)}&limit=100`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setComments(d.comments||[]);setNotice(`${(d.comments||[]).length} comentarios listos para analizar.`)}catch(e:any){setNotice(e.message||"No fue posible leer comentarios.")}finally{setLoading(false)}}
 async function analyze(){if(!comments.length)return;setAnalyzing(true);try{const r=await fetch("/api/comments/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageName:page?.name,postText:post?.message,comments:comments.map(c=>c.message).filter(Boolean).slice(0,100)})});const d=await r.json();if(!r.ok)throw new Error(d.error);setResult(d);if(supabase)await supabase.from("efimero_audience_analyses").insert({page_id:pageId,page_name:page?.name,post_id:postId,sample_size:comments.length,analysis:d});setNotice("Voz de audiencia analizada. Las ideas ya pasaron por Compliance Meta.")}catch(e:any){setNotice(e.message||"No fue posible analizar comentarios.")}finally{setAnalyzing(false)}}
 async function saveIdeas(){if(!result?.ideas?.length)return;await onSaveItems(result.ideas.map((x:any)=>({id:crypto.randomUUID(),text:x.text,category:x.category||"Audiencia",format:"Texto",createdAt:new Date().toISOString(),source:"generated",sourcePageId:pageId,sourcePageName:page?.name,notes:`Voz de audiencia · ${x.reason||"tema detectado"}`,generationBatch:`audience-${Date.now()}`,extractionMetadata:{audienceTheme:x.theme,compliance:x.compliance}})));setNotice(`${result.ideas.length} ideas guardadas en Biblioteca.`)}
 return <>
  <div className="pageIntro"><div><span className="overline">INTELIGENCIA</span><h1>Voz de audiencia</h1><p>La audiencia también escribe el brief. Analiza comentarios reales para detectar lenguaje, temas y preguntas recurrentes, y conviértelos en textos nuevos sin copiar a nadie ni pedir interacción.</p></div></div>
  <div className="setStack">
   <section className="setCard">
    <div className="setCardTitle"><MessagesSquare size={18}/><div><h2>Elige qué estudiar</h2><p>Carga las publicaciones de una página y lee hasta 100 comentarios de una de ellas.</p></div></div>
    <div className="setFormRow">
     <label className="setField"><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);setPosts([]);setComments([]);setResult(null)}}>{pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>)}</select></label>
     <button className="uiBtn uiBtnSecondary" onClick={loadPosts} disabled={!pageId||loading}>{loading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Cargar posts</button>
    </div>
    {posts.length>0&&<div className="setFormRow">
     <label className="setField"><span>Publicación a estudiar</span><select value={postId} onChange={e=>{setPostId(e.target.value);setComments([]);setResult(null)}}>{posts.map(p=><option key={p.id} value={p.id}>{(p.message||"Publicación visual / sin caption").slice(0,110)} · {p.comments} comentarios</option>)}</select></label>
     <button className="uiBtn uiBtnSecondary" onClick={loadComments} disabled={!postId||loading}><MessageCircle size={16}/> Leer comentarios</button>
    </div>}
   </section>

   {notice&&<div className="setNotice"><Info size={16}/><span>{notice}</span></div>}

   {comments.length>0&&<section className="setCard flush">
    <div className="setCardHead">
     <div className="setCardTitle"><UsersRound size={18}/><div><h2>{comments.length} comentarios recuperados</h2><p>Muestra de los primeros 12. El análisis usa hasta 100.</p></div></div>
     <button className={`uiBtn ${result?"uiBtnSecondary":"uiBtnPrimary"}`} onClick={analyze} disabled={analyzing}>{analyzing?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} {analyzing?"Analizando…":"Analizar voz"}</button>
    </div>
    <div className="setRows setScroll">{comments.slice(0,12).map(c=><div className="setRow" key={c.id}><p className="setRowNote setRowNoteStrong">{c.message}</p></div>)}</div>
   </section>}

   {result&&<>
    <section className="setCard">
     <span className="overline">LECTURA DE AUDIENCIA</span>
     <p className="setLead">{result.summary}</p>
     {(result.themes||[]).length>0&&<div className="setRowsBox">{(result.themes||[]).map((t:any)=><div className="setRow top" key={t.label}><div className="setRowMain"><span className="setRowTitle">{t.label}</span><span className="setRowNote">{t.signal}</span></div></div>)}</div>}
     {(result.language||[]).length>0&&<div className="setField"><span className="setFieldLabel">Lenguaje que se repite</span><div className="setChips">{(result.language||[]).map((x:string)=><span className="setTag" key={x}>{x}</span>)}</div></div>}
    </section>

    <section className="setCard flush">
     <div className="setCardHead">
      <div className="setCardTitle"><Sparkles size={18}/><div><h2>Ideas nuevas, no respuestas copiadas</h2><p>Textos derivados del insight. Ya pasaron por Compliance Meta.</p></div></div>
      <button className="uiBtn uiBtnPrimary" onClick={saveIdeas}><Archive size={16}/> Guardar ideas</button>
     </div>
     {(result.ideas||[]).length?<div className="setRows">{(result.ideas||[]).map((x:any,i:number)=><div className="setRow top" key={i}>
      <span className="setIndex">{i+1}</span>
      <div className="setRowMain"><p className="setRowText">{x.text}</p>{x.reason&&<span className="setRowNote">{x.reason}</span>}<div className="setMeta"><span>{x.category}</span></div></div>
      <span className="statusPill tone-neutral">Meta {x.compliance?.score??"—"}/100</span>
     </div>)}</div>:<div className="setEmpty"><span>El análisis no devolvió ideas nuevas.</span></div>}
    </section>
   </>}
  </div>
 </>
}
