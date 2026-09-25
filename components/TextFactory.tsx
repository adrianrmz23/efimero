"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Archive, BarChart3, Check, CheckCircle2, Copy, ExternalLink, Eye,
  Facebook, FileText, Image as ImageIcon, Layers3, Library, Loader2, MessageCircle,
  RefreshCw, Save, Share2, Sparkles, Target, ThumbsUp, WandSparkles, Zap
} from "lucide-react";

type PageItem = { id:string; name:string; category?:string; fan_count?:number; picture?:{data?:{url?:string}} };
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
  const [pages,setPages]=useState<PageItem[]>([]);
  const [pageId,setPageId]=useState("");
  const [posts,setPosts]=useState<MetaPost[]>([]);
  const [postLimit,setPostLimit]=useState(50);
  const [selectedPostIds,setSelectedPostIds]=useState<string[]>([]);
  const [extracted,setExtracted]=useState<Extracted[]>([]);
  const [loadingPages,setLoadingPages]=useState(true);
  const [loadingPosts,setLoadingPosts]=useState(false);
  const [extracting,setExtracting]=useState(false);
  const [savingExtracted,setSavingExtracted]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [savingGenerated,setSavingGenerated]=useState(false);
  const [error,setError]=useState("");
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

  useEffect(()=>{void loadPages()},[]);
  useEffect(()=>{try{const map=JSON.parse(localStorage.getItem("efimero_learning_profiles")||"{}");setLearningProfile(map?.[pageId]||null)}catch{setLearningProfile(null)}},[pageId]);

  async function loadPages(){
    setLoadingPages(true);setError("");
    try{
      const r=await fetch("/api/meta/pages",{cache:"no-store"});const data=await r.json();
      if(!r.ok)throw new Error(data.error||"No fue posible consultar tus páginas.");
      const list=data.pages||[];setPages(list);if(list.length)setPageId(old=>old||list[0].id);
    }catch(e:any){setError(e?.message||"No fue posible consultar Meta.")}
    finally{setLoadingPages(false)}
  }

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

  return <>
    <div className="pageIntro factoryIntro">
      <div><span className="overline">EFÍMERO TEXT INTELLIGENCE</span><h1>Fábrica de textos</h1><p>Convierte creatividades exitosas en memoria editorial y usa sus patrones para producir textos nuevos, medibles y sin copiar publicaciones anteriores.</p></div>
      <button className="factoryLibraryButton" onClick={onOpenLibrary}><Library size={18}/> Abrir Biblioteca</button>
    </div>

    <section className="factoryPipeline">
      <PipelineStep number="01" icon={<Facebook/>} title="Histórico real" note="Posts y métricas" active/>
      <PipelineStep number="02" icon={<Eye/>} title="Visión IA" note="Lee las imágenes" active={readable.length>0}/>
      <PipelineStep number="03" icon={<Layers3/>} title="Patrones" note="Tono + estructura" active={factoryHistorical.length>0}/>
      <PipelineStep number="04" icon={<WandSparkles/>} title="Generación" note="Textos nuevos" active={generated.length>0}/>
    </section>

    {error&&<div className="factoryNotice error"><AlertTriangle size={18}/><span>{error}</span></div>}
    {notice&&<div className="factoryNotice success"><CheckCircle2 size={18}/><span>{notice}</span></div>}

    <div className="factoryStats">
      <FactoryStat icon={<ImageIcon/>} label="Visuales analizados" value={factoryHistorical.length} note="con texto extraído"/>
      <FactoryStat icon={<FileText/>} label="Histórico textual" value={historicalTexts.length} note="memoria propia"/>
      <FactoryStat icon={<Sparkles/>} label="Generados" value={generatedTexts.length} note="guardados en biblioteca"/>
      <FactoryStat icon={<Share2/>} label="Top training set" value={topTrainingExamples.length} note="priorizado por rendimiento"/>
    </div>

    <section className="factorySection">
      <div className="factorySectionHeader"><div><span>PASO 1</span><h2>Recupera textos desde creatividades</h2><p>Traemos imágenes de una página que administras y la IA lee únicamente el texto visible de la pieza.</p></div><div className="factoryHeaderIcon"><Eye size={24}/></div></div>
      <div className="factoryControls">
        <label><span>Página</span><select value={pageId} onChange={e=>{setPageId(e.target.value);setPosts([]);setExtracted([])}} disabled={loadingPages}>{pages.length?pages.map(p=><option value={p.id} key={p.id}>{p.name}</option>):<option>Sin páginas</option>}</select></label>
        <label><span>Muestra</span><select value={postLimit} onChange={e=>setPostLimit(Number(e.target.value))}><option value={25}>25 posts</option><option value={50}>50 posts</option><option value={100}>100 posts</option></select></label>
        <button className="factorySecondary" onClick={loadVisualPosts} disabled={!pageId||loadingPosts}>{loadingPosts?<Loader2 className="spin"/>:<RefreshCw/>} {loadingPosts?"Consultando…":"Buscar visuales"}</button>
      </div>

      {posts.length>0&&<>
        <div className="factorySampleBar"><div><strong>{visualPosts.length}</strong><span>visuales en la muestra</span></div><div><strong>{selectedPostIds.length}</strong><span>seleccionadas</span></div><div><strong>{readable.length}</strong><span>textos recuperados</span></div><button onClick={selectTopVisuals}><Target size={16}/> Seleccionar top 24</button><button className="factoryPrimary" onClick={extractVisualTexts} disabled={!selectedPosts.length||extracting}>{extracting?<Loader2 className="spin"/>:<Eye/>} {extracting?"Leyendo imágenes…":`Analizar ${selectedPosts.length}`}</button></div>
        <div className="factoryVisualGrid">{visualPosts.slice(0,32).map(post=>{const ex=extractedMap.get(post.id);const selected=selectedPostIds.includes(post.id);return <article key={post.id} className={`factoryVisualCard ${selected?"selected":""}`}><button className="factoryVisualSelect" onClick={()=>togglePost(post.id)}>{selected?<Check size={14}/>:null}</button>{post.picture?<img src={post.picture} alt="Creatividad de Facebook"/>:<div className="factoryNoImage"><ImageIcon/></div>}<div className="factoryVisualBody"><div className="factoryPostSignals"><span>👍 {fmt(post.reactions)}</span><span>↗ {fmt(post.shares)}</span><b>{performanceScore(post).toFixed(1)}</b></div>{ex?<><span className={`extractConfidence ${ex.confidence>=.8?"high":""}`}>{Math.round(ex.confidence*100)}% lectura</span><p>{ex.text||"Sin texto legible en la creatividad."}</p><small>{ex.category} · {ex.structure}</small></>:<><p className="pendingText">{post.message?.trim()||"Pendiente de lectura visual"}</p><small>{post.createdTime?new Date(post.createdTime).toLocaleDateString("es-MX"):"Facebook"}</small></>}</div></article>})}</div>
        {readable.length>0&&<div className="factorySaveStrip"><div><Archive size={22}/><span><strong>{readable.length} textos listos para convertir en memoria</strong><small>Se guardan con sus métricas, post original, categoría, hook y estructura.</small></span></div><button onClick={saveExtracted} disabled={savingExtracted}>{savingExtracted?<Loader2 className="spin"/>:<Save/>} Guardar histórico visual</button></div>}
      </>}
    </section>

    <section className="factorySection generatorSection">
      <div className="factorySectionHeader"><div><span>PASO 2</span><h2>Genera un lote completamente nuevo</h2><p>La IA recibe patrones y ejemplos de alto rendimiento. Los ejemplos enseñan estilo; nunca deben copiarse literalmente.</p></div><div className="factoryHeaderIcon purple"><WandSparkles size={24}/></div></div>
      <div className="factoryGeneratorGrid">
        <div className="factoryGeneratorControls">
          <label><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label><span>Objetivo editorial</span><select value={objective} onChange={e=>setObjective(e.target.value)}><option>Compartibilidad</option><option>Comentarios</option><option>Equilibrado</option></select></label>
          <label><span>Longitud</span><select value={length} onChange={e=>setLength(e.target.value)}><option>Automática</option><option>Muy corta · 5–12 palabras</option><option>Corta · 13–25 palabras</option><option>Media · 26–45 palabras</option></select></label>
          <label><span>Cantidad</span><select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={5}>5 textos</option><option value={10}>10 textos</option><option value={20}>20 textos</option><option value={30}>30 textos</option></select></label>
          <div className="trainingSetCard"><Target size={20}/><div><strong>{topTrainingExamples.length} referencias activas</strong><span>Priorizadas por compartidos, comentarios y reacciones. {learningProfile?"Aprendizaje por rendimiento activo. ":""}{editorialProfile?"La Huella editorial también está activa.":"Puedes crear la Huella para afinar el estilo."}</span></div></div>
          <button className="factoryGenerateButton" onClick={generateBatch} disabled={generating}>{generating?<Loader2 className="spin" size={20}/>:<Zap size={20}/>} {generating?"Creando lote…":`Generar ${count} textos`}</button>
        </div>
        <div className="factoryPrinciples"><span className="factoryPrincipleKicker">GUARDRAILS</span><h3>Fábrica + Compliance Meta</h3><p>Todo lote se filtra antes de mostrarse. Evitamos CTA directo, engagement bait, clickbait e incentivos artificiales. El score de alineación <strong>no predice viralidad</strong>.</p><div><i>01</i><span><b>Compliance</b><small>Bloquea interacción forzada.</small></span></div><div><i>02</i><span><b>Novedad</b><small>Evita clones del histórico.</small></span></div><div><i>03</i><span><b>Huella</b><small>Conserva voz y longitud.</small></span></div></div>
      </div>

      {generated.length>0&&<div className="factoryResults"><div className="factoryResultsHeader"><div><span>LOTE GENERADO</span><h3>{generated.length} propuestas para revisar</h3></div><button onClick={saveGenerated} disabled={!generated.some(x=>x.selected)||savingGenerated}>{savingGenerated?<Loader2 className="spin"/>:<Archive/>} Guardar {generated.filter(x=>x.selected).length}</button></div><div className="factoryResultList">{generated.map((item,index)=><article key={item.id} className={item.selected?"factoryResult selected":"factoryResult"}><button className="resultCheck" onClick={()=>setGenerated(c=>c.map(x=>x.id===item.id?{...x,selected:!x.selected}:x))}>{item.selected?<Check/>:null}</button><div className="resultIndex">{String(index+1).padStart(2,"0")}</div><div className="resultMain"><div className="resultMeta"><span>{item.category}</span><b>{item.pattern}</b></div><textarea value={item.text} onChange={e=>updateGenerated(item.id,e.target.value)}/><div className="resultScores"><span className={item.alignment>=85?"strong":""}><Sparkles size={13}/> {item.alignment}% alineación</span><span><Zap size={13}/> {item.novelty}% novedad</span>{item.compliance&&<span className={item.compliance.status==="pass"?"complianceMini pass":"complianceMini review"}>Meta {item.compliance.score}/100</span>}<button onClick={()=>navigator.clipboard?.writeText(item.text)}><Copy size={13}/> Copiar</button></div></div></article>)}</div></div>}
    </section>
  </>;
}

function PipelineStep({number,icon,title,note,active=false}:{number:string;icon:React.ReactNode;title:string;note:string;active?:boolean}){return <div className={active?"pipelineStep active":"pipelineStep"}><span>{number}</span><div className="pipelineIcon">{icon}</div><div><strong>{title}</strong><small>{note}</small></div></div>}
function FactoryStat({icon,label,value,note}:{icon:React.ReactNode;label:string;value:number;note:string}){return <article className="factoryStat"><div>{icon}</div><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong><small>{note}</small></article>}
