"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Archive, Check, CheckCircle2, Copy, Eye,
  Facebook, Image as ImageIcon, Layers3, Library, Loader2,
  RefreshCw, Save, Share2, ShieldCheck, Sparkles, Target, ThumbsUp, WandSparkles, Zap
} from "lucide-react";
import { usePages } from "@/lib/pagesContext";

type MetaPost = {
  id:string; message:string; createdTime?:string|null; permalinkUrl?:string|null; picture?:string|null;
  reactions:number; comments:number; shares:number; reach:number;
};

type LibrarySource = "manual"|"historical"|"generated"|"reference";
type LibraryItem = {
  id:string; text:string; category:string; format:string; createdAt:string; source?:LibrarySource;
  sourceUrl?:string; notes?:string; reactions?:number; comments?:number; shares?:number; reach?:number;
  publishedAt?:string; performanceScore?:number; favorite?:boolean; generationBatch?:string;
  platform?:string; platformPostId?:string; sourcePageId?:string; sourcePageName?:string;
  sourceImageUrl?:string; extractionMetadata?:Record<string,unknown>; factoryScore?:number;
};

type Extracted = {
  postId:string; text:string; category:string; tone:string; structure:string; hook:string;
  visualSummary:string; confidence:number; hasReadableText:boolean;
};

type FactoryGenerated = {
  id:string; text:string; category:string; pattern:string; alignment:number; novelty:number; selected:boolean; compliance?:any;
};

type Props = {
  library: LibraryItem[];
  editorialProfile?: any;
  onSaveItems: (items: LibraryItem[]) => Promise<void> | void;
  onOpenLibrary: () => void;
};

const categories = ["Automática","Frases identificables","Relaciones","Nostalgia","Preguntas","Humor","Pensamientos nocturnos","Motivación ligera","Vida cotidiana"];
const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const similarity=(a:string,b:string)=>{const A=new Set(normalize(a).split(" ").filter(Boolean));const B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const intersection=[...A].filter(w=>B.has(w)).length;return intersection/new Set([...A,...B]).size};
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const fmt=(n:number)=>new Intl.NumberFormat("es-MX",{notation:n>=1000000?"compact":"standard",maximumFractionDigits:1}).format(n);
const performanceScore=(p:{reactions?:number;comments?:number;shares?:number;reach?:number})=>{const weighted=Number(p.reactions||0)+Number(p.comments||0)*2+Number(p.shares||0)*4;const reach=Number(p.reach||0);return reach>0?Math.round((weighted/reach)*10000)/10:Math.round(Math.log10(weighted+1)*100)/10};

function factoryAlignment(text:string,category:string,library:LibraryItem[],profile:any,objective:string){
  const owned=library.filter(x=>x.source!=="reference"&&x.text?.trim());
  const maxSim=owned.reduce((m,x)=>Math.max(m,similarity(text,x.text)),0);
  const novelty=clamp(Math.round((1-maxSim)*100));
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  const targetWords=Number(profile?.avgWords || (owned.length?Math.round(owned.reduce((n,x)=>n+x.text.split(/\s+/).length,0)/owned.length):18));
  const lengthScore=clamp(100-Math.abs(words-targetWords)*4,45,100);
  const categoryBonus=category&&category!=="Automática"?100:88;
  let objectiveScore=84;
  if(objective==="Comentarios")objectiveScore=/[?¿]/.test(text)?100:72;
  if(objective==="Compartibilidad")objectiveScore=words>=7&&words<=32&&!/[?¿]/.test(text)?96:82;
  const alignment=Math.round(lengthScore*.32+novelty*.34+categoryBonus*.18+objectiveScore*.16);
  return {alignment:clamp(alignment),novelty};
}

export default function TextFactory({library,editorialProfile,onSaveItems,onOpenLibrary}:Props){
  const {pages,activePageId,loading:loadingPages,error:pagesError}=usePages();
  // Selección local: elegir otra página aquí no cambia la página activa global.
  const [localPageId,setPageId]=useState("");
  const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [postLimit,setPostLimit]=useState(50);
  const [selectedPostIds,setSelectedPostIds]=useState<string[]>([]);
  const [extracted,setExtracted]=useState<Extracted[]>([]);
  const [loadingPosts,setLoadingPosts]=useState(false);
  const [extracting,setExtracting]=useState(false);
  const [savingExtracted,setSavingExtracted]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [savingGenerated,setSavingGenerated]=useState(false);
  const [factoryError,setError]=useState("");
  const error=factoryError||pagesError;
  const [notice,setNotice]=useState("");
  const [category,setCategory]=useState("Automática");
  const [objective,setObjective]=useState("Compartibilidad");
  const [length,setLength]=useState("Automática");
  const [count,setCount]=useState(10);
  const [generated,setGenerated]=useState<FactoryGenerated[]>([]);
  const [learningProfile,setLearningProfile]=useState<any>(null);

  const currentPage=pages.find(p=>p.id===pageId);
  const visualPosts=posts.filter(p=>Boolean(p.picture));
  const selectedPosts=visualPosts.filter(p=>selectedPostIds.includes(p.id));
  const extractedMap=useMemo(()=>new Map(extracted.map(x=>[x.postId,x])),[extracted]);
  const readable=extracted.filter(x=>x.hasReadableText&&x.text.trim());
  const historicalTexts=library.filter(x=>x.source==="historical"&&x.text?.trim()&&(!pageId||!x.sourcePageId||x.sourcePageId===pageId));
  const generatedTexts=library.filter(x=>x.source==="generated"&&x.text?.trim()&&(!pageId||!x.sourcePageId||x.sourcePageId===pageId));
  const factoryHistorical=library.filter(x=>x.source==="historical"&&x.extractionMetadata?.method==="vision-ai"&&(!pageId||x.sourcePageId===pageId));

  useEffect(()=>{try{const map=JSON.parse(localStorage.getItem("efimero_learning_profiles")||"{}");setLearningProfile(map?.[pageId]||null)}catch{setLearningProfile(null)}},[pageId]);

  async function loadVisualPosts(){
    if(!pageId)return;setLoadingPosts(true);setError("");setNotice("");setExtracted([]);
    try{
      const qs=new URLSearchParams({pageId,limit:String(postLimit),includeInsights:"0"});
      const r=await fetch(`/api/meta/posts?${qs.toString()}`,{cache:"no-store"});const data=await r.json();
      if(!r.ok)throw new Error(data.error||"No fue posible traer las publicaciones.");
      const loaded:MetaPost[]=data.posts||[];setPosts(loaded);
      const candidates=loaded.filter(p=>p.picture).slice(0,24).map(p=>p.id);setSelectedPostIds(candidates);
      setNotice(`${loaded.filter(p=>p.picture).length} publicaciones visuales encontradas en la muestra.`);
    }catch(e:any){setPosts([]);setError(e?.message||"No fue posible cargar las publicaciones.")}
    finally{setLoadingPosts(false)}
  }

  function togglePost(id:string){setSelectedPostIds(c=>c.includes(id)?c.filter(x=>x!==id):[...c,id])}
  function selectTopVisuals(){
    const top=[...visualPosts].sort((a,b)=>performanceScore(b)-performanceScore(a)).slice(0,24).map(p=>p.id);setSelectedPostIds(top);
  }

  async function extractVisualTexts(){
    if(!selectedPosts.length)return;setExtracting(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/text-factory/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({posts:selectedPosts})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||"No fue posible leer las imágenes.");
      setExtracted(data.items||[]);setNotice(`${(data.items||[]).filter((x:Extracted)=>x.hasReadableText&&x.text.trim()).length} textos recuperados de ${selectedPosts.length} creatividades.`);
    }catch(e:any){setError(e?.message||"No fue posible analizar las imágenes.")}
    finally{setExtracting(false)}
  }

  async function saveExtracted(){
    if(!currentPage||!readable.length)return;setSavingExtracted(true);setError("");
    try{
      const now=new Date().toISOString();
      const items:LibraryItem[]=readable.map(x=>{const post=posts.find(p=>p.id===x.postId)!;return {
        id:crypto.randomUUID(),text:x.text.trim(),category:x.category,format:"Imagen",createdAt:now,source:"historical",
        sourceUrl:post?.permalinkUrl||undefined,notes:`Extraído de creatividad · ${x.structure}`,
        reactions:Number(post?.reactions||0),comments:Number(post?.comments||0),shares:Number(post?.shares||0),reach:Number(post?.reach||0),
        publishedAt:post?.createdTime||undefined,performanceScore:performanceScore(post||{}),favorite:false,platform:"facebook",
        platformPostId:post?.id,sourcePageId:currentPage.id,sourcePageName:currentPage.name,sourceImageUrl:post?.picture||undefined,
        extractionMetadata:{tone:x.tone,structure:x.structure,hook:x.hook,visualSummary:x.visualSummary,confidence:x.confidence,method:"vision-ai",caption:post?.message||""},
      }});
      await onSaveItems(items);setNotice(`${items.length} textos visuales guardados como histórico de ${currentPage.name}.`);
    }catch(e:any){setError(e?.message||"No fue posible guardar los textos extraídos.")}
    finally{setSavingExtracted(false)}
  }

  const topTrainingExamples=useMemo(()=>{
    const pageOwned=library.filter(x=>x.source!=="reference"&&x.text?.trim()&&x.sourcePageId===pageId);
    const fallback=library.filter(x=>x.source!=="reference"&&x.text?.trim()&&!x.sourcePageId);
    const candidates=pageOwned.length>=8?pageOwned:[...pageOwned,...fallback];
    return [...candidates].sort((a,b)=>Number(b.performanceScore||performanceScore(b))-Number(a.performanceScore||performanceScore(a))).slice(0,24);
  },[library,pageId]);

  async function generateBatch(){
    setGenerating(true);setError("");setNotice("");
    try{
      const examples=topTrainingExamples.map(x=>({text:x.text,category:x.category,reactions:x.reactions,comments:x.comments,shares:x.shares,performanceScore:x.performanceScore,structure:String(x.extractionMetadata?.structure||""),hook:String(x.extractionMetadata?.hook||"")}));
      const r=await fetch("/api/text-factory/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,objective,length,count,examples,profile:editorialProfile,learningProfile})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||"No fue posible generar el lote.");
      const draftItems:FactoryGenerated[]=(data.items||[]).map((x:any)=>{const score=factoryAlignment(String(x.text||""),String(x.category||category),library,editorialProfile,objective);return {id:crypto.randomUUID(),text:String(x.text||""),category:String(x.category||category),pattern:String(x.pattern||"Patrón editorial"),alignment:score.alignment,novelty:score.novelty,selected:true,compliance:x.compliance}}).filter((x:FactoryGenerated)=>x.text.trim());
      const cr=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:draftItems.map(x=>x.text)})});
      const cd=await cr.json();
      const reviews=cr.ok&&Array.isArray(cd.items)?cd.items:[];
      const items=draftItems.map((item,i)=>{const c=reviews[i]||item.compliance;const nextText=c?.status!=="pass"&&c?.correctedText?String(c.correctedText):item.text;const score=factoryAlignment(nextText,item.category,library,editorialProfile,objective);return {...item,text:nextText,alignment:score.alignment,novelty:score.novelty,compliance:c,selected:c?.status!=="block"}});
      setGenerated(items);setNotice(`${items.length} textos revisados por Compliance Meta. ${items.filter(x=>x.compliance?.status==="pass").length} pasaron sin observaciones.`);
    }catch(e:any){setError(e?.message||"No fue posible generar textos.")}
    finally{setGenerating(false)}
  }

  async function saveGenerated(){
    const chosen=generated.filter(x=>x.selected);if(!chosen.length)return;setSavingGenerated(true);setError("");
    try{
      const batch=`factory-${Date.now()}`;const now=new Date().toISOString();
      const items:LibraryItem[]=chosen.map(x=>({id:crypto.randomUUID(),text:x.text,category:x.category,format:"Texto",createdAt:now,source:"generated",notes:`Fábrica de textos · ${x.pattern} · objetivo ${objective}`,generationBatch:batch,factoryScore:x.alignment,sourcePageId:currentPage?.id,sourcePageName:currentPage?.name,extractionMetadata:{factoryPattern:x.pattern,novelty:x.novelty,alignment:x.alignment,objective,compliance:x.compliance}}));
      await onSaveItems(items);setGenerated(c=>c.map(x=>chosen.some(y=>y.id===x.id)?{...x,selected:false}:x));setNotice(`${items.length} textos guardados en Biblioteca.`);
    }catch(e:any){setError(e?.message||"No fue posible guardar el lote.")}
    finally{setSavingGenerated(false)}
  }

  function updateGenerated(id:string,text:string){setGenerated(c=>c.map(x=>{if(x.id!==id)return x;const score=factoryAlignment(text,x.category,library,editorialProfile,objective);return {...x,text,alignment:score.alignment,novelty:score.novelty,compliance:undefined}}))}

  const selectedGenerated=generated.filter(x=>x.selected).length;

  return <div className="studioPage">
    <div className="pageIntro">
      <div><span className="overline">FÁBRICA DE TEXTOS</span><h1>Fábrica de textos</h1><p>Convierte tus creatividades con mejor rendimiento en memoria editorial y usa sus patrones para crear textos nuevos, sin copiar publicaciones anteriores.</p></div>
      <button className="uiBtn uiBtnSecondary" onClick={onOpenLibrary}><Library size={16}/> Abrir biblioteca</button>
    </div>

    <ol className="studioSteps" aria-label="Flujo de la fábrica">
      <FactoryStep number="01" icon={<Facebook size={16}/>} title="Histórico real" value={historicalTexts.length} note="textos propios en memoria" active/>
      <FactoryStep number="02" icon={<Eye size={16}/>} title="Visión IA" value={factoryHistorical.length} note="visuales con texto extraído" active={readable.length>0}/>
      <FactoryStep number="03" icon={<Layers3 size={16}/>} title="Patrones" value={topTrainingExamples.length} note="referencias por rendimiento" active={factoryHistorical.length>0}/>
      <FactoryStep number="04" icon={<WandSparkles size={16}/>} title="Generación" value={generatedTexts.length} note="generados en biblioteca" active={generated.length>0}/>
    </ol>

    {error&&<div className="studioNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
    {notice&&<div className="studioNotice success"><CheckCircle2 size={16}/><span>{notice}</span></div>}

    <section className="studioCard">
      <div className="studioCardHead">
        <div><span className="studioStepLabel">Paso 1</span><h2>Recupera textos de tus creatividades</h2><p>Traemos las imágenes de una página que administras y la IA lee solo el texto visible de cada pieza.</p></div>
      </div>
      <div className="studioToolbar">
        <label><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);setPosts([]);setExtracted([])}} disabled={loadingPages}>{pages.length?pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>):<option>Sin páginas</option>}</select></label>
        <div className="studioField"><span>Muestra</span><div className="segmented compact" role="group" aria-label="Tamaño de la muestra">{[25,50,100].map(v=><button type="button" key={v} className={postLimit===v?"active":""} onClick={()=>setPostLimit(v)}>{v} posts</button>)}</div></div>
        <button className="uiBtn uiBtnSecondary" onClick={loadVisualPosts} disabled={!pageId||loadingPosts}>{loadingPosts?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} {loadingPosts?"Consultando…":"Buscar visuales"}</button>
      </div>

      {posts.length>0&&<>
        <div className="studioSampleBar">
          <div className="studioInlineStats"><span><b>{visualPosts.length}</b> visuales en la muestra</span><span><b>{selectedPostIds.length}</b> seleccionadas</span><span><b>{readable.length}</b> textos recuperados</span></div>
          <div className="studioInlineActions"><button type="button" className="linkButton" onClick={selectTopVisuals}><Target size={14}/> Seleccionar top 24</button><button className="uiBtn uiBtnSecondary" onClick={extractVisualTexts} disabled={!selectedPosts.length||extracting}>{extracting?<Loader2 className="spin" size={16}/>:<Eye size={16}/>} {extracting?"Leyendo imágenes…":`Analizar ${selectedPosts.length}`}</button></div>
        </div>
        <div className="studioVisualGrid">{visualPosts.slice(0,32).map(post=>{const ex=extractedMap.get(post.id);const selected=selectedPostIds.includes(post.id);return <article key={post.id} className={selected?"studioVisualCard selected":"studioVisualCard"}>
          <button className="studioCheck" onClick={()=>togglePost(post.id)} aria-pressed={selected} aria-label={selected?"Quitar de la selección":"Seleccionar"}>{selected?<Check size={14}/>:null}</button>
          {post.picture?<img src={post.picture} alt="Creatividad de Facebook"/>:<div className="studioNoImage"><ImageIcon size={24}/></div>}
          <div className="studioVisualBody">
            <div className="studioSignals"><span title="Reacciones"><ThumbsUp size={13}/> {fmt(post.reactions)}</span><span title="Compartidos"><Share2 size={13}/> {fmt(post.shares)}</span><b title="Puntaje de rendimiento">{performanceScore(post).toFixed(1)}</b></div>
            {ex?<>
              <span className={`statusPill ${ex.confidence>=.8?"tone-success":"tone-neutral"} studioPillStart`}>{Math.round(ex.confidence*100)}% lectura</span>
              <p>{ex.text||"Sin texto legible en la creatividad."}</p>
              <small>{ex.category} · {ex.structure}</small>
            </>:<>
              <p className="muted">{post.message?.trim()||"Pendiente de lectura visual"}</p>
              <small>{post.createdTime?new Date(post.createdTime).toLocaleDateString("es-MX"):"Facebook"}</small>
            </>}
          </div>
        </article>})}</div>
        {readable.length>0&&<div className="studioCallout"><div><Archive size={18}/><span><strong>{readable.length} textos listos para guardar como memoria</strong><small>Se guardan con sus métricas, el post original, la categoría, el hook y la estructura.</small></span></div><button className="uiBtn uiBtnSecondary" onClick={saveExtracted} disabled={savingExtracted}>{savingExtracted?<Loader2 className="spin" size={16}/>:<Save size={16}/>} Guardar histórico visual</button></div>}
      </>}
    </section>

    <div className="studioTwoCol">
      <section className="studioCard studioSticky">
        <div className="studioCardHead">
          <div><span className="studioStepLabel">Paso 2</span><h2>Genera un lote nuevo</h2><p>La IA aprende el estilo de tus mejores ejemplos, pero nunca los copia literalmente.</p></div>
        </div>
        <div className="fieldRow">
          <label><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label><span>Objetivo</span><select value={objective} onChange={e=>setObjective(e.target.value)}><option>Compartibilidad</option><option>Comentarios</option><option>Equilibrado</option></select></label>
        </div>
        <label><span>Longitud</span><select value={length} onChange={e=>setLength(e.target.value)}><option>Automática</option><option>Muy corta · 5–12 palabras</option><option>Corta · 13–25 palabras</option><option>Media · 26–45 palabras</option></select></label>
        <div className="studioField"><span>Cantidad</span><div className="segmented" role="group" aria-label="Cantidad de textos">{[5,10,20,30].map(v=><button type="button" key={v} className={count===v?"active":""} onClick={()=>setCount(v)}>{v}</button>)}</div></div>
        <div className="studioMeta"><Target size={16}/><div><strong>{topTrainingExamples.length} referencias activas</strong><span>Priorizadas por compartidos, comentarios y reacciones. {learningProfile?"Aprendizaje por rendimiento activo. ":""}{editorialProfile?"La Huella editorial también está activa.":"Crea tu Huella editorial para afinar el estilo."}</span></div></div>
        <button className={generated.length?"uiBtn uiBtnSecondary wide studioGenerate":"uiBtn uiBtnPrimary wide studioGenerate"} onClick={generateBatch} disabled={generating}>{generating?<Loader2 className="spin" size={16}/>:<Zap size={16}/>} {generating?"Creando lote…":`Generar ${count} textos`}</button>
        <p className="studioNote"><ShieldCheck size={14}/><span>Cada lote pasa por Compliance Meta antes de mostrarse. El score de alineación no predice viralidad.</span></p>
      </section>

      {generated.length>0?<section className="studioCard">
        <div className="studioCardHead">
          <div><span className="studioStepLabel">Lote generado</span><h2>{generated.length} propuestas para revisar</h2><p>Edita lo que necesites y marca los textos que quieras guardar.</p></div>
          <button className="uiBtn uiBtnPrimary" onClick={saveGenerated} disabled={!generated.some(x=>x.selected)||savingGenerated}>{savingGenerated?<Loader2 className="spin" size={16}/>:<Archive size={16}/>} Guardar {selectedGenerated}</button>
        </div>
        <div className="studioResultList">{generated.map((item,index)=><article key={item.id} className={item.selected?"studioResult selected":"studioResult"}>
          <button className="studioCheck inline" onClick={()=>setGenerated(c=>c.map(x=>x.id===item.id?{...x,selected:!x.selected}:x))} aria-pressed={item.selected} aria-label={item.selected?"Quitar de la selección":"Seleccionar"}>{item.selected?<Check size={14}/>:null}</button>
          <div className="studioResultMain">
            <div className="studioResultMeta"><span className="studioIndex">{String(index+1).padStart(2,"0")}</span><span className="statusPill tone-neutral">{item.category}</span><span>{item.pattern}</span></div>
            <textarea value={item.text} onChange={e=>updateGenerated(item.id,e.target.value)} aria-label={`Texto ${index+1}`}/>
            <div className="studioScores">
              <span className={item.alignment>=85?"good":""}><Sparkles size={13}/> {item.alignment}% alineación</span>
              <span><Zap size={13}/> {item.novelty}% novedad</span>
              {item.compliance&&<span className={item.compliance.status==="pass"?"statusPill tone-success":"statusPill tone-warning"}>Meta {item.compliance.score}/100</span>}
              <button type="button" className="linkButton" onClick={()=>navigator.clipboard?.writeText(item.text)}><Copy size={13}/> Copiar</button>
            </div>
          </div>
        </article>)}</div>
      </section>:<section className="studioCard studioEmptyCard">
        <div className="studioEmpty"><WandSparkles size={28}/><strong>Tu lote aparecerá aquí</strong><span>Revisa, edita y guarda en la biblioteca solo los textos que te convenzan.</span></div>
        <ul className="studioGuardrails">
          <li><b>Compliance</b><span>Bloquea interacción forzada, clickbait e incentivos artificiales.</span></li>
          <li><b>Novedad</b><span>Evita clones de tu histórico.</span></li>
          <li><b>Huella</b><span>Conserva tu voz y la longitud habitual.</span></li>
        </ul>
      </section>}
    </div>
  </div>;
}

function FactoryStep({number,icon,title,value,note,active=false}:{number:string;icon:React.ReactNode;title:string;value:number;note:string;active?:boolean}){
  return <li className={active?"studioStep active":"studioStep"}>
    <div className="studioStepTop"><span className="studioStepIcon">{icon}</span><span className="studioStepTitle">{number} · {title}</span>{active&&<Check size={14} className="studioStepCheck" aria-label="Activo"/>}</div>
    <strong>{value.toLocaleString("es-MX")}</strong>
    <small>{note}</small>
  </li>;
}
