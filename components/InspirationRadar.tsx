"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookmarkPlus, BrainCircuit, Check, ExternalLink, FileText, Image as ImageIcon, Info, Loader2, MessageCircle, Plus, RefreshCw, Share2, ShieldCheck, Sparkles, ThumbsUp, Trash2, Upload, RadioTower, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LibrarySource="manual"|"historical"|"generated"|"reference";
type LibraryItem={id:string;text:string;category:string;format:string;createdAt:string;source?:LibrarySource;sourceUrl?:string;notes?:string;reactions?:number;comments?:number;shares?:number;reach?:number;performanceScore?:number;favorite?:boolean;generationBatch?:string;sourcePageName?:string;sourceImageUrl?:string;extractionMetadata?:Record<string,unknown>;factoryScore?:number};
type Watch={id:string;name:string;page_url:string;notes?:string;enabled:boolean;created_at:string;provider?:string;last_synced_at?:string;sync_status?:string;last_sync_error?:string;last_snapshot_id?:string};
type ExternalPost={id:string;watchlist_id:string;provider_post_id:string;post_url?:string;text:string;posted_at?:string;reactions:number;comments:number;shares:number;captured_at:string};
type Analysis={text:string;category:string;tone:string;hook:string;structure:string;theme:string;mechanism:string;summary:string;confidence:number};
type Generated={text:string;category:string;patternKept:string;changed:string;novelty:number;maxSimilarity:number;sourceSimilarity:number;datasetSimilarity:number;compliance:any;nearest?:any[];selected:boolean};
type Props={library:LibraryItem[];onSaveItems:(items:LibraryItem[])=>Promise<void>|void;onOpenLearningAgent?:()=>void};

function normalize(text:string){return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function similarity(a:string,b:string){const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const i=[...A].filter(x=>B.has(x)).length;return i/new Set([...A,...B]).size}
function compactNumber(value:number){return new Intl.NumberFormat("es-MX",{notation:"compact",maximumFractionDigits:1}).format(value||0)}

export default function InspirationRadar({library,onSaveItems,onOpenLearningAgent}:Props){
  const [watchlist,setWatchlist]=useState<Watch[]>([]);const [watchName,setWatchName]=useState("");const [watchUrl,setWatchUrl]=useState("");const [watchNotes,setWatchNotes]=useState("");
  const [sourceId,setSourceId]=useState("");const [sourceUrl,setSourceUrl]=useState("");const [text,setText]=useState("");const [imageDataUrl,setImageDataUrl]=useState("");const [imageName,setImageName]=useState("");const [analysis,setAnalysis]=useState<Analysis|null>(null);const [analyzing,setAnalyzing]=useState(false);const [message,setMessage]=useState("");
  const [mode,setMode]=useState("pattern-new-theme");const [count,setCount]=useState(6);const [generating,setGenerating]=useState(false);const [generated,setGenerated]=useState<Generated[]>([]);const [saving,setSaving]=useState(false);const [generationNotice,setGenerationNotice]=useState("");const [generationProvider,setGenerationProvider]=useState("");
  const [externalPosts,setExternalPosts]=useState<ExternalPost[]>([]);const [syncingId,setSyncingId]=useState("");const [syncLimit,setSyncLimit]=useState(25);
  const references=useMemo(()=>library.filter(x=>x.source==="reference").slice(0,60),[library]);
  const selectedSource=watchlist.find(x=>x.id===sourceId)||null;
  useEffect(()=>{void loadWatchlist()},[]);

  async function loadWatchlist(){const db=supabase;if(!db)return;const {data}=await db.from("efimero_inspiration_watchlist").select("*").order("created_at",{ascending:false});setWatchlist((data||[]) as Watch[])}
  async function loadExternalPosts(watchId:string){const db=supabase;if(!db||!watchId){setExternalPosts([]);return}const {data}=await db.from("efimero_inspiration_posts").select("id,watchlist_id,provider_post_id,post_url,text,posted_at,reactions,comments,shares,captured_at").eq("watchlist_id",watchId).order("posted_at",{ascending:false}).limit(100);setExternalPosts((data||[]) as ExternalPost[])}
  async function selectWatch(w:Watch){setSourceId(w.id);setSourceUrl(w.page_url);setMessage("");await loadExternalPosts(w.id)}
  async function addWatch(){const name=watchName.trim(),url=watchUrl.trim();if(!name||!url)return;const db=supabase;if(!db){setMessage("Supabase no está configurado.");return}const {data,error}=await db.from("efimero_inspiration_watchlist").insert({name,page_url:url,notes:watchNotes.trim()||null,provider:"brightdata"}).select("*").single();if(error){setMessage(error.message);return}setWatchlist(c=>[data as Watch,...c]);setWatchName("");setWatchUrl("");setWatchNotes("");await selectWatch(data as Watch)}
  async function removeWatch(id:string){const db=supabase;if(db)await db.from("efimero_inspiration_watchlist").delete().eq("id",id);setWatchlist(c=>c.filter(x=>x.id!==id));if(sourceId===id){setSourceId("");setExternalPosts([])}}

  async function syncWatch(w:Watch){
    setSyncingId(w.id);setMessage("");await selectWatch(w);
    try{
      const resume=w.sync_status==="processing"&&w.last_snapshot_id;
      let r=await fetch("/api/inspiration/brightdata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(resume?{watchlistId:w.id,action:"poll",snapshotId:w.last_snapshot_id}:{watchlistId:w.id,numPosts:syncLimit})});
      let d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo sincronizar con Bright Data.");
      if(d.status==="processing"&&d.snapshotId){
        setMessage("Bright Data está preparando los posts…");
        for(let attempt=0;attempt<12;attempt++){
          await new Promise(resolve=>setTimeout(resolve,3500));
          r=await fetch("/api/inspiration/brightdata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({watchlistId:w.id,action:"poll",snapshotId:d.snapshotId})});
          d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo recuperar el snapshot.");
          if(d.status==="ready")break;
        }
      }
      await loadExternalPosts(w.id);await loadWatchlist();
      setMessage(d.status==="ready"?`${Number(d.count||0)} posts sincronizados desde Bright Data.`:"La extracción sigue procesándose. Puedes volver a pulsar Sincronizar en unos segundos.");
    }catch(e:any){setMessage(e?.message||"No se pudo sincronizar.");await loadWatchlist()}finally{setSyncingId("")}
  }

  async function handleFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!file.type.startsWith("image/")){setMessage("Para esta entrada usa una captura de pantalla en JPG, PNG o WebP.");return}if(file.size>2_500_000){setMessage("La captura debe pesar menos de 2.5 MB para enviarla de forma segura al análisis.");return}const reader=new FileReader();reader.onload=()=>{setImageDataUrl(String(reader.result||""));setImageName(file.name);setAnalysis(null);setMessage("")};reader.readAsDataURL(file)}

  async function analyzeValues(textValue:string,imageValue:string,urlValue:string,sourceName:string){
    if(!textValue.trim()&&!imageValue){setMessage("Pega un texto o sube una captura.");return}
    setAnalyzing(true);setMessage("");
    try{const r=await fetch("/api/inspiration/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:textValue,imageDataUrl:imageValue,sourceName,sourceUrl:urlValue})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo analizar la referencia.");setAnalysis(d.analysis);if(!textValue.trim()&&d.analysis?.text)setText(d.analysis.text)}catch(e:any){setMessage(e?.message||"No se pudo analizar.")}finally{setAnalyzing(false)}
  }
  async function analyze(){await analyzeValues(text,imageDataUrl,sourceUrl||selectedSource?.page_url||"",selectedSource?.name||"Referencia externa")}
  async function applyExternalPost(post:ExternalPost){setText(post.text);setSourceUrl(post.post_url||selectedSource?.page_url||"");setImageDataUrl("");setImageName("");setGenerated([]);setAnalysis(null);window.scrollTo({top:0,behavior:"smooth"});await analyzeValues(post.text,"",post.post_url||selectedSource?.page_url||"",selectedSource?.name||"Página monitorizada")}

  async function saveReference(){if(!analysis?.text)return;const item:LibraryItem={id:crypto.randomUUID(),text:analysis.text,category:analysis.category||"Otros",format:"Texto",createdAt:new Date().toISOString(),source:"reference",sourceUrl:sourceUrl||selectedSource?.page_url||undefined,sourcePageName:selectedSource?.name||undefined,notes:`${analysis.structure} · ${analysis.mechanism}`,favorite:false,extractionMetadata:{inspirationAnalysis:analysis,watchlistId:sourceId||null,sourceName:selectedSource?.name||null,capturedFrom:imageDataUrl?"screenshot":externalPosts.some(p=>p.text===analysis.text)?"brightdata":"text"}};await onSaveItems([item]);setMessage("Referencia guardada en Biblioteca como fuente externa.")}
  async function generate(){if(!analysis?.text){setGenerationNotice("Analiza primero una referencia antes de generar variaciones.");return}setGenerating(true);setGenerated([]);setGenerationNotice("");setGenerationProvider("");setMessage("");try{const r=await fetch("/api/inspiration/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference:analysis,count,mode})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error([d.error,d.detail,Array.isArray(d.details)?d.details.join(" · "):""].filter(Boolean).join(" · ")||"No se pudieron generar variaciones.");let items=(Array.isArray(d.items)?d.items:[]) as any[];if(!items.length)throw new Error("La IA respondió, pero no devolvió variaciones utilizables. Vuelve a intentar.");if(items.length){try{const cr=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:items.map(x=>x.text)})});const cd=await cr.json();if(cr.ok&&Array.isArray(cd.items))items=items.map((x,i)=>({...x,compliance:cd.items[i]||x.compliance}))}catch{}}
      const currentTexts=library.map(x=>x.text);const mapped=items.map(x=>{const lexical=Math.max(0,...currentTexts.slice(0,1500).map(t=>similarity(t,x.text)));const novelty=Math.min(Number(x.novelty??100),Math.round((1-lexical)*100));return {...x,novelty,selected:x.compliance?.status==="pass"&&novelty>=40}});setGenerated(mapped);setGenerationProvider(`${String(d.model||"IA")} · ${String(d.source||"proveedor")}`);setGenerationNotice(`${mapped.length} variaciones generadas. ${mapped.filter(x=>x.compliance?.status==="pass"&&x.novelty>=40).length} están listas para seleccionar.`);
      const db=supabase;if(db)await db.from("efimero_inspiration_runs").insert({watchlist_id:sourceId||null,source_text:analysis.text,mode,result:{items:mapped,source:d.source||null,model:d.model||null}});
    }catch(e:any){setGenerationNotice(e?.message||"No se pudo generar.")}finally{setGenerating(false)}}
  async function saveGenerated(){const chosen=generated.filter(x=>x.selected&&x.compliance?.status==="pass"&&x.novelty>=40);if(!chosen.length){setMessage("Selecciona al menos un texto con Compliance PASS y novedad suficiente.");return}setSaving(true);try{const batch=`inspiration-${Date.now()}`;const items:LibraryItem[]=chosen.map(x=>({id:crypto.randomUUID(),text:x.text,category:x.category||analysis?.category||"General",format:"Texto",createdAt:new Date().toISOString(),source:"generated",favorite:false,generationBatch:batch,notes:`Radar de inspiración · patrón: ${x.patternKept} · cambio: ${x.changed}`,factoryScore:x.novelty,extractionMetadata:{inspiration:{sourceText:analysis?.text,sourceName:selectedSource?.name||null,sourceUrl:sourceUrl||selectedSource?.page_url||null,mode,novelty:x.novelty,sourceSimilarity:x.sourceSimilarity,datasetSimilarity:x.datasetSimilarity,patternKept:x.patternKept,changed:x.changed},compliance:x.compliance}}));await onSaveItems(items);setMessage(`${items.length} textos nuevos guardados en Biblioteca.`)}finally{setSaving(false)}}
  function applyReference(item:LibraryItem){const meta:any=item.extractionMetadata||{};const a=meta.inspirationAnalysis as Analysis|undefined;setText(item.text);setSourceUrl(item.sourceUrl||"");setAnalysis(a||{text:item.text,category:item.category||"Otros",tone:"Referencia histórica",hook:item.text.split(/\s+/).slice(0,6).join(" "),structure:item.notes||"Patrón externo",theme:item.category||"General",mechanism:item.notes||"Identificación",summary:"Referencia guardada anteriormente.",confidence:.6});setImageDataUrl("");setImageName("");setGenerated([]);window.scrollTo({top:0,behavior:"smooth"})}
  const passCount=generated.filter(x=>x.compliance?.status==="pass"&&x.novelty>=40).length;
  const selectedCount=generated.filter(x=>x.selected).length;

  return <div className="insp">
    <div className="pageIntro">
      <div><span className="overline">INSPIRACIÓN · RADAR</span><h1>Radar de inspiración</h1><p>Vigila páginas públicas, analiza el patrón de sus publicaciones y conviértelo en ideas nuevas sin copiar la redacción.</p></div>
      <div className="inspIntroActions"><span className="inspPill"><RadioTower size={14}/> Bright Data · IA · Compliance</span>{onOpenLearningAgent&&<button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenLearningAgent}><BrainCircuit size={16}/> Entrenar Learning Agent</button>}</div>
    </div>

    <div className="inspStats cols-3"><Metric label="Páginas vigiladas" value={watchlist.length}/><Metric label="Posts sincronizados" value={externalPosts.length} hint="De la página seleccionada"/><Metric label="Variaciones listas" value={passCount} hint="PASS y novedad ≥ 40%"/></div>

    {message&&<div className="quickNotice inspNotice" role="status"><Info size={16}/><span>{message}</span></div>}

    <div className="inspColumns">
      <section className="inspCard">
        <div className="inspCardHead"><div><h2>Watchlist</h2><p>Páginas públicas de Facebook que quieres vigilar. Sincroniza sus posts cuando lo necesites.</p></div></div>
        <div className="inspSettingRow">
          <div><strong>Posts por sincronización</strong><span>Publicaciones recientes que se traen de cada página.</span></div>
          <div className="segmented compact" role="group" aria-label="Posts por sincronización">{[10,25,50,100].map(n=><button type="button" key={n} className={syncLimit===n?"active":""} onClick={()=>setSyncLimit(n)}>{n}</button>)}</div>
        </div>
        {watchlist.length?<ul className="inspWatchList">{watchlist.map(w=><li key={w.id} className={sourceId===w.id?"inspWatch active":"inspWatch"}>
          <button type="button" className="inspWatchMain" onClick={()=>void selectWatch(w)}>
            <span className="inspAvatar" aria-hidden="true">{(w.name||"?").charAt(0).toUpperCase()}</span>
            <span className="inspWatchText"><strong>{w.name}</strong><small>{w.last_synced_at?`Última sincronización: ${new Date(w.last_synced_at).toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"})}`:w.notes||"Sin sincronizar"}</small></span>
          </button>
          {w.sync_status==="processing"&&<span className="statusPill tone-warning">Procesando</span>}
          {w.sync_status==="error"&&<span className="statusPill tone-danger" title={w.last_sync_error||undefined}>Error</span>}
          <div className="inspRowActions">
            <button type="button" className="uiIconBtn" onClick={()=>void syncWatch(w)} disabled={syncingId===w.id} title="Sincronizar posts públicos" aria-label={`Sincronizar ${w.name}`}>{syncingId===w.id?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>}</button>
            <a className="uiIconBtn" href={w.page_url} target="_blank" rel="noreferrer" title="Abrir página" aria-label={`Abrir ${w.name}`}><ExternalLink size={16}/></a>
            <button type="button" className="uiIconBtn danger" onClick={()=>removeWatch(w.id)} title="Eliminar" aria-label={`Eliminar ${w.name}`}><Trash2 size={16}/></button>
          </div>
        </li>)}</ul>:<div className="inspEmpty"><BookmarkPlus size={18}/><span>Agrega una página pública para empezar a vigilarla.</span></div>}
        <div className="inspSubsection">
          <h3>Agregar página</h3>
          <div className="inspForm">
            <div className="fieldRow">
              <label className="field"><span>Nombre</span><input value={watchName} onChange={e=>setWatchName(e.target.value)} placeholder="Nombre de la página"/></label>
              <label className="field"><span>URL de la página</span><input value={watchUrl} onChange={e=>setWatchUrl(e.target.value)} placeholder="https://facebook.com/…"/></label>
            </div>
            <label className="field"><span>Qué observar <small>Opcional</small></span><input value={watchNotes} onChange={e=>setWatchNotes(e.target.value)} placeholder="Tono, formatos, temas…"/></label>
            <div className="inspFormActions"><button type="button" className="uiBtn uiBtnSecondary" onClick={addWatch} disabled={!watchName.trim()||!watchUrl.trim()}><Plus size={16}/> Agregar página</button></div>
          </div>
        </div>
      </section>

      <section className="inspCard">
        <div className="inspCardHead"><div><h2>Capturar referencia</h2><p>Pega el copy de una publicación o sube una captura para analizar su patrón.</p></div></div>
        <div className="inspForm">
          <div className="fieldRow">
            <label className="field"><span>Fuente</span><select value={sourceId} onChange={e=>{const id=e.target.value;setSourceId(id);const w=watchlist.find(x=>x.id===id);if(w){setSourceUrl(w.page_url);void loadExternalPosts(w.id)}else setExternalPosts([])}}><option value="">Sin Watchlist</option>{watchlist.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select></label>
            <label className="field"><span>URL de la publicación <small>Opcional</small></span><input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://facebook.com/…"/></label>
          </div>
          <label className="field"><span>Texto de la publicación</span><textarea className="inspTextarea" value={text} onChange={e=>{setText(e.target.value);setAnalysis(null)}} placeholder="Pega aquí el texto de otra publicación…"/></label>
          <div className="inspUploadRow">
            <label className="uiBtn uiBtnSecondary inspFileBtn"><Upload size={16}/> Subir captura<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile}/></label>
            {imageDataUrl?<span className="inspAttachment"><ImageIcon size={16}/><span>{imageName}</span><button type="button" onClick={()=>{setImageDataUrl("");setImageName("")}} aria-label="Quitar captura" title="Quitar captura"><X size={14}/></button></span>:<small className="inspHint">JPG, PNG o WebP · máximo 2.5 MB</small>}
          </div>
        </div>
        <div className="inspCardFooter"><button type="button" className={analysis?"uiBtn uiBtnSecondary":"uiBtn uiBtnPrimary"} onClick={analyze} disabled={analyzing||(!text.trim()&&!imageDataUrl)}>{analyzing?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Analizar patrón</button></div>
      </section>
    </div>

    {sourceId&&<section className="inspCard">
      <div className="inspCardHead"><div><h2>Posts de {selectedSource?.name||"la página"}</h2><p>El engagement visible es una señal exploratoria: no equivale a alcance ni garantiza rendimiento.</p></div><div className="inspHeadActions"><button type="button" className="uiBtn uiBtnSecondary" disabled={!selectedSource||syncingId===sourceId} onClick={()=>selectedSource&&void syncWatch(selectedSource)}>{syncingId===sourceId?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Sincronizar</button></div></div>
      {externalPosts.length?<div className="inspPostGrid">{externalPosts.map(post=><article className="inspPost" key={post.id}>
        <div className="inspPostMeta"><span>{post.posted_at?new Date(post.posted_at).toLocaleDateString("es-MX",{dateStyle:"medium"}):"Fecha no disponible"}</span>{post.post_url&&<a className="linkButton" href={post.post_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Ver post</a>}</div>
        <p className="inspPostText">{post.text||"Publicación sin copy textual."}</p>
        <div className="inspPostFoot">
          <div className="inspPostStats"><span title="Reacciones"><ThumbsUp size={14}/>{compactNumber(post.reactions)}</span><span title="Comentarios"><MessageCircle size={14}/>{compactNumber(post.comments)}</span><span title="Compartidos"><Share2 size={14}/>{compactNumber(post.shares)}</span></div>
          <button type="button" className="uiBtn uiBtnSecondary inspBtnSm" disabled={!post.text||analyzing} onClick={()=>void applyExternalPost(post)}><Sparkles size={14}/> Analizar</button>
        </div>
      </article>)}</div>:<div className="inspEmpty"><RadioTower size={18}/><span>Todavía no hay posts guardados para esta página. Pulsa <strong>Sincronizar</strong>.</span></div>}
    </section>}

    {analysis&&<section className="inspCard">
      <div className="inspCardHead"><div><h2>Patrón detectado</h2><p>Esto es lo que se usará como inspiración, no la redacción literal.</p></div><div className="inspHeadActions"><button type="button" className="uiBtn uiBtnSecondary" onClick={saveReference}><BookmarkPlus size={16}/> Guardar referencia</button></div></div>
      <div className="inspAnalysis">
        <div className="inspTags"><span className="statusPill tone-neutral">{analysis.category}</span><span className="statusPill tone-neutral">{analysis.tone}</span><span className="statusPill tone-neutral">{Math.round((analysis.confidence||0)*100)}% de confianza</span></div>
        {analysis.summary&&<p className="inspLead">{analysis.summary}</p>}
        <dl className="inspPatternGrid"><Pattern label="Hook" value={analysis.hook}/><Pattern label="Estructura" value={analysis.structure}/><Pattern label="Tema" value={analysis.theme}/><Pattern label="Mecanismo" value={analysis.mechanism}/></dl>
        <figure className="inspQuote"><figcaption>Texto analizado</figcaption><blockquote>{analysis.text}</blockquote></figure>
      </div>
    </section>}

    {analysis&&<section className="inspCard">
      <div className="inspCardHead"><div><h2>Generar variaciones</h2><p>Elige cuánto conservar del original. Solo se guardan textos con Compliance PASS y al menos 40% de novedad.</p></div></div>
      <div className="inspControls">
        <label className="field"><span>Enfoque</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="pattern-new-theme">Mismo patrón · tema nuevo</option><option value="same-theme-new-structure">Mismo tema · estructura nueva</option><option value="mechanism-only">Solo mecanismo psicológico</option></select></label>
        <label className="field"><span>Cantidad</span><select value={count} onChange={e=>setCount(Number(e.target.value))}>{[3,6,9,12].map(n=><option value={n} key={n}>{n} textos</option>)}</select></label>
        <button type="button" className={generated.length?"uiBtn uiBtnSecondary":"uiBtn uiBtnPrimary"} onClick={generate} disabled={generating}>{generating?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Generar</button>
      </div>
      {generationNotice&&<div className={generated.length?"quickNotice inspNotice":"scheduleValidity warn inspNotice"} role="status">{generated.length?<Info size={16}/>:<AlertTriangle size={16}/>}<span>{generationNotice}{generationProvider&&<small className="inspNoticeMeta">{generationProvider}</small>}</span></div>}
      {generated.length?<>
        <ul className="inspResults">{generated.map((item,i)=>{const safe=item.compliance?.status==="pass"&&item.novelty>=40;const pass=item.compliance?.status==="pass";return <li className={safe?"inspResult":"inspResult blocked"} key={i}>
          <input type="checkbox" className="inspCheck" checked={item.selected} disabled={!safe} aria-label={`Seleccionar variación ${i+1}`} onChange={e=>setGenerated(c=>c.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/>
          <div className="inspResultBody">
            <div className="inspTags"><span className={`statusPill ${pass?"tone-success":"tone-warning"}`}>{pass?<ShieldCheck size={13}/>:<AlertTriangle size={13}/>} {String(item.compliance?.status||"review").toUpperCase()}</span><span className="statusPill tone-neutral">{item.novelty}% novedad</span>{item.category&&<span className="statusPill tone-neutral">{item.category}</span>}</div>
            <p>{item.text}</p>
            <small>Conserva: {item.patternKept} · Cambia: {item.changed}</small>
            {item.novelty<40&&<small className="inspWarnText"><AlertTriangle size={13}/> Demasiado parecido a una referencia o al dataset; no se puede guardar.</small>}
          </div>
        </li>})}</ul>
        <div className="inspCardFooter between"><span className="inspFooterNote">{selectedCount} seleccionados · {passCount} aptos</span><button type="button" className="uiBtn uiBtnPrimary" onClick={saveGenerated} disabled={saving||!generated.some(x=>x.selected)}>{saving?<Loader2 className="spin" size={16}/>:<Check size={16}/>} Guardar textos nuevos</button></div>
      </>:<div className="inspEmpty"><Sparkles size={18}/><span>Todavía no hay variaciones. El Radar prioriza novedad y Compliance antes de dejarlas entrar a tu Biblioteca.</span></div>}
    </section>}

    <section className="inspCard">
      <div className="inspCardHead"><div><h2>Referencias guardadas</h2><p>Fuentes externas para estudiar patrones. No se usan como ejemplos literales en la Fábrica.</p></div></div>
      {references.length?<div className="inspRefGrid">{references.slice(0,18).map(r=><article key={r.id} className="inspRef">
        <div className="inspRefTop"><span>{r.sourcePageName||"Referencia externa"}</span>{r.sourceUrl&&<a className="linkButton" href={r.sourceUrl} target="_blank" rel="noreferrer" title="Abrir fuente" aria-label="Abrir fuente"><ExternalLink size={14}/></a>}</div>
        <p>{r.text}</p>
        <small>{r.category} · {r.notes||"Patrón pendiente"}</small>
        <button type="button" className="uiBtn uiBtnSecondary inspBtnSm" onClick={()=>applyReference(r)}>Usar patrón</button>
      </article>)}</div>:<div className="inspEmpty"><FileText size={18}/><span>Todavía no hay referencias externas guardadas.</span></div>}
    </section>
  </div>;
}
function Metric({label,value,hint}:{label:string;value:number;hint?:string}){return <div className="inspStat"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>}
function Pattern({label,value}:{label:string;value:string}){return <div className="inspPatternItem"><dt>{label}</dt><dd>{value||"—"}</dd></div>}
