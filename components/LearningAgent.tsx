"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronRight, Database, ExternalLink, Heart, History, ImageIcon, Info, Loader2, MessageCircle, RadioTower, RefreshCw, Repeat2, Send, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { SheetRow } from "@/lib/spreadsheetImport";

type LibrarySource="manual"|"historical"|"generated"|"reference";
type LibraryItem={id:string;text:string;category:string;format:string;createdAt:string;source?:LibrarySource;sourceUrl?:string;notes?:string;reactions?:number;comments?:number;shares?:number;reach?:number;performanceScore?:number;favorite?:boolean;generationBatch?:string;sourcePageName?:string;sourceImageUrl?:string;extractionMetadata?:Record<string,unknown>;factoryScore?:number};
type Pattern={id:string;title:string;category:string;tone:string;mechanism:string;description:string;sample_size:number;avg_engagement_score:number;source_pages?:string[];updated_at?:string};
type Watch={id:string;name:string;page_url:string;last_synced_at?:string;sync_status?:string};
type Status={pages:number;watchlist?:Watch[];posts:number;imageTexts?:number;analyzed:number;patternCount:number;ownDataset:number;patterns:Pattern[];lastRun?:any};
type Generated={text:string;category:string;rationale:string;patternUsed:string;compliance:any;novelty:number;editorialScore:number;duplicateRisk:boolean;externalSimilarity:number;ownSimilarity:number;nearestExternal?:any[];nearestOwn?:any[];selected?:boolean};
type Winner={id:string;pageName:string;postUrl:string;text:string;caption:string;fromImage:boolean;imageUrl:string;reactions:number;comments:number;shares:number;postedAt:string|null;score:number};
type Format="image"|"copy";
type Props={onSaveItems:(items:LibraryItem[])=>Promise<void>|void;onQueue:(items:any[])=>void;onOpenRadar:()=>void;onSendToStudio:(rows:SheetRow[])=>void};

const categories=["","Fe y espiritualidad","Reflexión","Relaciones","Nostalgia","Motivación","Pregunta/reflexión","Humor","Vida cotidiana"];
const pad=(n:number)=>String(n).padStart(2,"0");
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};

const compact=(n:number)=>n>=1e6?`${(n/1e6).toFixed(1)} M`:n>=1e3?`${(n/1e3).toFixed(1)} mil`:String(n);

export default function LearningAgent({onSaveItems,onQueue,onOpenRadar,onSendToStudio}:Props){
  const [status,setStatus]=useState<Status>({pages:0,posts:0,analyzed:0,patternCount:0,ownDataset:0,patterns:[]});
  const [loading,setLoading]=useState(true);const [training,setTraining]=useState(false);const [collecting,setCollecting]=useState(false);const [trainLimit,setTrainLimit]=useState(200);const [postsPerPage,setPostsPerPage]=useState(25);const [message,setMessage]=useState("");
  const [objective,setObjective]=useState("Frases breves y originales con las que la gente se sienta identificada");const [category,setCategory]=useState("");const [count,setCount]=useState(12);const [format,setFormat]=useState<Format>("image");
  const [winners,setWinners]=useState<Winner[]>([]);const [winnersLoading,setWinnersLoading]=useState(false);const [winnerDays,setWinnerDays]=useState(90);const [winnerPage,setWinnerPage]=useState("");const [chosen,setChosen]=useState<string[]>([]);const [exploration,setExploration]=useState(55);const [generating,setGenerating]=useState(false);const [generated,setGenerated]=useState<Generated[]>([]);const [saving,setSaving]=useState(false);
  const ready=useMemo(()=>status.posts>0&&status.patternCount>0,[status.posts,status.patternCount]);
  useEffect(()=>{void loadStatus()},[]);
  useEffect(()=>{void loadWinners()},[winnerDays,winnerPage]);
  async function loadWinners(){setWinnersLoading(true);try{const q=new URLSearchParams({days:String(winnerDays)});if(winnerPage)q.set("watchlistId",winnerPage);const r=await fetch(`/api/learning-agent/winners?${q}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron cargar las ganadoras.");setWinners(d.items||[])}catch(e:any){setMessage(e?.message||"No se pudieron cargar las ganadoras.")}finally{setWinnersLoading(false)}}
  function toggleWinner(id:string){setChosen(cur=>cur.includes(id)?cur.filter(x=>x!==id):cur.length>=12?cur:[...cur,id])}

  async function loadStatus(){setLoading(true);try{const r=await fetch("/api/learning-agent/status",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo cargar el Learning Agent.");setStatus(d)}catch(e:any){setMessage(e?.message||"No se pudo cargar el estado.")}finally{setLoading(false)}}
  async function runTraining(){const r=await fetch("/api/learning-agent/train",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:trainLimit})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo actualizar el aprendizaje.");return d}
  async function train(){setTraining(true);setMessage("");try{const d=await runTraining();setMessage(`Aprendizaje actualizado: ${d.imagesRead||0} frases leídas de imágenes · ${d.analyzedNow||0} posts analizados · ${d.patternsFound||0} patrones activos.`);await Promise.all([loadStatus(),loadWinners()])}catch(e:any){setMessage(e?.message||"Falló el aprendizaje.")}finally{setTraining(false)}}
  async function collectAndTrain(){const pages=status.watchlist||[];if(!pages.length){setMessage("Agrega páginas al Radar antes de recolectar.");return}setCollecting(true);setMessage(`Recolectando hasta ${postsPerPage} posts de ${pages.length} páginas…`);let synced=0,failed=0;try{for(const page of pages){try{let r=await fetch("/api/inspiration/brightdata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({watchlistId:page.id,numPosts:postsPerPage})});let d=await r.json();if(!r.ok)throw new Error(d.error||"Falló la sincronización.");if(d.status==="processing"&&d.snapshotId){for(let attempt=0;attempt<10;attempt++){await new Promise(resolve=>setTimeout(resolve,3000));r=await fetch("/api/inspiration/brightdata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({watchlistId:page.id,action:"poll",snapshotId:d.snapshotId})});d=await r.json();if(!r.ok)throw new Error(d.error||"Falló el snapshot.");if(d.status==="ready")break}}if(d.status==="ready")synced++;else failed++}catch{failed++}setMessage(`Recolectando páginas: ${synced+failed}/${pages.length} · correctas ${synced} · pendientes/error ${failed}`)}const d=await runTraining();setMessage(`Ciclo completo: ${synced}/${pages.length} páginas sincronizadas · ${d.imagesRead||0} frases leídas de imágenes · ${d.analyzedNow||0} posts analizados · ${d.patternsFound||0} patrones activos.`);await Promise.all([loadStatus(),loadWinners()])}catch(e:any){setMessage(e?.message||"No se pudo completar recolección + aprendizaje.")}finally{setCollecting(false)}}
  async function generate(){if(!objective.trim())return;setGenerating(true);setGenerated([]);setMessage("");try{const r=await fetch("/api/learning-agent/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({objective,category,count,exploration,format,examples:winners.filter(w=>chosen.includes(w.id)).map(w=>w.text)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo generar.");let items=(d.items||[]) as Generated[];
      if(items.length){try{const cr=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:items.map(x=>x.text)})});const cd=await cr.json();if(cr.ok&&Array.isArray(cd.items))items=items.map((x,i)=>({...x,compliance:cd.items[i]||x.compliance}))}catch{}}
      setGenerated(items.map(item=>({...item,selected:item.compliance?.status==="pass"&&!item.duplicateRisk})));
    }catch(e:any){setMessage(e?.message||"Falló la generación.")}finally{setGenerating(false)}}
  async function saveSelected(){const selected=generated.filter(x=>x.selected&&x.compliance?.status==="pass"&&!x.duplicateRisk);if(!selected.length)return;setSaving(true);try{const batch=crypto.randomUUID();const items:LibraryItem[]=selected.map(item=>({id:crypto.randomUUID(),text:item.text,category:item.category||"General",format:"Texto",createdAt:new Date().toISOString(),source:"generated",favorite:false,generationBatch:batch,factoryScore:item.editorialScore,notes:`Learning Agent · ${item.patternUsed||"patrón aprendido"}`,extractionMetadata:{learningAgent:true,novelty:item.novelty,editorialScore:item.editorialScore,externalSimilarity:item.externalSimilarity,ownSimilarity:item.ownSimilarity,rationale:item.rationale}}));await onSaveItems(items);setMessage(`${items.length} copys guardados en Biblioteca.`)}finally{setSaving(false)}}
  function queueSelected(){const selected=generated.filter(x=>x.selected&&x.compliance?.status==="pass"&&!x.duplicateRisk);if(!selected.length)return;const queued=selected.map(item=>({id:crypto.randomUUID(),date:today(),time:nowTime(),category:item.category||"General",text:item.text,format:"Texto",status:"Borrador",compliance:item.compliance,similarity:Math.max(item.externalSimilarity||0,item.ownSimilarity||0),editorialScore:item.editorialScore,scoreData:{learningAgent:true,novelty:item.novelty,rationale:item.rationale}}));onQueue(queued);setMessage(`${queued.length} copys enviados a Bandeja como borradores.`)}
  function sendToStudio(){const selected=generated.filter(x=>x.selected&&x.compliance?.status==="pass"&&!x.duplicateRisk);if(!selected.length)return;onSendToStudio(selected.map(item=>({title:"",body:item.text,caption:""})))}
  function toggle(index:number){setGenerated(current=>current.map((item,i)=>i===index?{...item,selected:!item.selected}:item))}

  const hasSelection=generated.some(x=>x.selected);
  const selectedCount=generated.filter(x=>x.selected).length;
  const explorationLabel=exploration<35?"Más conservador":exploration>70?"Más experimental":"Equilibrado";

  return <div className="insp">
    <div className="pageIntro">
      <div><span className="overline">INSPIRACIÓN · LEARNING AGENT</span><h1>Aprende patrones sin copiar publicaciones</h1><p>Convierte los posts sincronizados del Radar en patrones editoriales abstractos y combínalos con la memoria propia de Efímero. Es aprendizaje continuo con RAG, no fine-tuning del modelo.</p></div>
      <button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenRadar}><RadioTower size={16}/> Abrir Radar</button>
    </div>

    {message&&<div className="quickNotice inspNotice" role="status"><Info size={16}/><span>{message}</span></div>}

    <div className="inspStats cols-5">
      <Stat label="Páginas vigiladas" value={loading?"—":status.pages} hint="Fuentes activas"/>
      <Stat label="Posts externos" value={loading?"—":status.posts} hint={`${status.imageTexts||0} con frase leída`}/>
      <Stat label="Analizados" value={loading?"—":status.analyzed} hint="Memoria externa"/>
      <Stat label="Patrones" value={loading?"—":status.patternCount} hint="Clusters activos"/>
      <Stat label="Memoria propia" value={loading?"—":status.ownDataset} hint="RAG de Efímero"/>
    </div>

    <section className="inspCard">
      <div className="inspCardHead"><div><h2>Recolectar y aprender</h2><p>Sincroniza varias páginas con Bright Data y convierte sus posts en patrones editoriales.</p></div></div>
      <div className="inspControls learnControls">
        <label className="field"><span>Posts por página</span><select value={postsPerPage} onChange={e=>setPostsPerPage(Number(e.target.value))}>{[10,25,50].map(n=><option key={n} value={n}>{n} posts</option>)}</select></label>
        <label className="field"><span>Analizar hasta</span><select value={trainLimit} onChange={e=>setTrainLimit(Number(e.target.value))}>{[100,200,300,400].map(n=><option key={n} value={n}>{n} posts</option>)}</select></label>
        <div className="inspButtonGroup">
          <button type="button" className="uiBtn uiBtnGhost" onClick={train} disabled={training||collecting||status.posts===0}>{training?<Loader2 className="spin" size={16}/>:<BrainCircuit size={16}/>} Solo aprender</button>
          <button type="button" className={ready?"uiBtn uiBtnSecondary":"uiBtn uiBtnPrimary"} onClick={collectAndTrain} disabled={collecting||training||status.pages===0}>{collecting?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Recolectar y aprender</button>
        </div>
      </div>
      <ol className="learnFlow" aria-label="Flujo de aprendizaje">{flow.map((step,i)=><li key={step}>{i>0&&<ChevronRight size={14} aria-hidden="true"/>}<span>{step}</span></li>)}</ol>
      <div className="learnNotes">
        <p className="inspHint"><Info size={14}/><span>Máximo en este ciclo: {(status.watchlist||[]).length*postsPerPage} registros externos. Bright Data puede cobrar según tu plan; nada se sincroniza sin que pulses el botón.</span></p>
        {status.lastRun&&<p className="inspHint"><History size={14}/><span>Última ejecución: {new Date(status.lastRun.created_at).toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"})} · {Number(status.lastRun.patterns_found||0)} patrones</span></p>}
      </div>
      {!status.posts&&<div className="scheduleValidity warn inspNotice"><AlertTriangle size={16}/><span>Primero sincroniza publicaciones de varias páginas desde el Radar.</span></div>}
    </section>

    <section className="inspCard">
      <div className="inspCardHead"><div><h2>Patrones aprendidos</h2><p>No son textos para copiar: son estructuras, tonos y mecanismos detectados en varias fuentes.</p></div>{!!status.patterns.length&&<span className="inspCount">{status.patterns.length}</span>}</div>
      {status.patterns.length?<div className="learnPatternGrid">{status.patterns.map(pattern=><article className="learnPattern" key={pattern.id}>
        <div className="learnPatternTop"><span className="statusPill tone-neutral">{pattern.category||"General"}</span><span className="learnScore" title="Engagement medio">{Math.round(Number(pattern.avg_engagement_score||0))}<small>/100</small></span></div>
        <h3>{pattern.title}</h3>
        <p>{pattern.description||pattern.mechanism}</p>
        <div className="learnPatternMeta"><span>{pattern.sample_size} posts</span><span>{Array.isArray(pattern.source_pages)?pattern.source_pages.length:0} páginas</span><span>{pattern.tone||"Tono mixto"}</span></div>
      </article>)}</div>:<div className="inspEmpty"><Database size={18}/><span>Actualiza el aprendizaje para descubrir los primeros patrones.</span></div>}
    </section>

    <section className="inspCard">
      <div className="inspCardHead"><div><h2>Publicaciones ganadoras</h2><p>Lo que más interacción tuvo en cada página, comparado con lo normal en esa misma página. Marca hasta 12 para que el agente se inspire en ellas.</p></div>
        <div className="inspHeadActions">
          <select aria-label="Página" value={winnerPage} onChange={e=>setWinnerPage(e.target.value)}><option value="">Todas las páginas</option>{(status.watchlist||[]).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
          <select aria-label="Periodo" value={winnerDays} onChange={e=>setWinnerDays(Number(e.target.value))}>{[30,90,180,365].map(n=><option key={n} value={n}>Últimos {n} días</option>)}</select>
        </div>
      </div>
      {winnersLoading?<div className="inspEmpty"><Loader2 className="spin" size={18}/><span>Cargando publicaciones…</span></div>:winners.length?<div className="learnWinnerGrid">{winners.map((w,i)=>{const picked=chosen.includes(w.id);return <article key={w.id} className={picked?"learnWinner picked":"learnWinner"}>
        <div className="learnWinnerTop"><span className="learnWinnerRank"><Trophy size={13}/> {i+1}</span><span className="learnScore" title="Interacción relativa a su página">{w.score}<small>/100</small></span></div>
        {w.imageUrl&&<img className="learnWinnerImg" src={w.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none"}}/>}
        <p>{w.text}</p>
        <div className="learnWinnerMetrics"><span title="Reacciones"><Heart size={13}/> {compact(w.reactions)}</span><span title="Comentarios"><MessageCircle size={13}/> {compact(w.comments)}</span><span title="Compartidos"><Repeat2 size={13}/> {compact(w.shares)}</span>{w.fromImage&&<span title="Frase leída de la imagen"><ImageIcon size={13}/> Imagen</span>}</div>
        <div className="learnWinnerFoot"><span>{w.pageName}{w.postedAt?` · ${new Date(w.postedAt).toLocaleDateString("es-MX",{day:"numeric",month:"short"})}`:""}</span>{w.postUrl&&<a href={w.postUrl} target="_blank" rel="noreferrer" aria-label="Ver en Facebook"><ExternalLink size={13}/></a>}</div>
        <label className="learnWinnerPick"><input type="checkbox" className="inspCheck" checked={picked} onChange={()=>toggleWinner(w.id)}/> Inspirarme en esta</label>
      </article>})}</div>:<div className="inspEmpty"><Database size={18}/><span>Todavía no hay publicaciones en este periodo. Recolecta páginas arriba.</span></div>}
      {chosen.length>0&&<div className="inspCardFooter between"><span className="inspFooterNote">{chosen.length} de 12 marcadas como inspiración. El agente toma su tono y emoción, no sus palabras.</span><button type="button" className="linkButton" onClick={()=>setChosen([])}>Quitar selección</button></div>}
    </section>

    <section className="inspCard">
      <div className="inspCardHead"><div><h2>Generar con aprendizaje</h2><p>La voz propia pesa más que las fuentes externas: el Radar aporta patrones y Efímero aporta identidad.</p></div></div>
      <div className="learnWeights" aria-label="Pesos de la mezcla"><div><strong>50%</strong><span>Voz propia</span></div><div><strong>30%</strong><span>Patrones</span></div><div><strong>20%</strong><span>Exploración</span></div></div>
      <div className="inspForm">
        <label className="field"><span>Objetivo</span><textarea className="learnObjective" value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Qué quieres generar…"/></label>
        <div className="field"><span>Formato</span><div className="segmented" role="group" aria-label="Formato"><button type="button" className={format==="image"?"active":""} onClick={()=>setFormat("image")}>Frase para imagen</button><button type="button" className={format==="copy"?"active":""} onClick={()=>setFormat("copy")}>Copy de texto</button></div></div>
        <div className="learnGenRow">
          <label className="field"><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c||"all"} value={c}>{c||"Automática"}</option>)}</select></label>
          <label className="field"><span>Cantidad</span><select value={count} onChange={e=>setCount(Number(e.target.value))}>{[6,12,24,30].map(n=><option key={n}>{n}</option>)}</select></label>
          <label className="field learnRange"><span>Exploración <small>{exploration}% · {explorationLabel}</small></span><input type="range" min={0} max={100} step={5} value={exploration} onChange={e=>setExploration(Number(e.target.value))}/></label>
        </div>
      </div>
      <div className="inspCardFooter between">
        <span className="inspFooterNote">{!ready?"Necesitas posts sincronizados y al menos un patrón aprendido.":chosen.length?`Se inspirará en ${chosen.length} ${chosen.length===1?"publicación ganadora":"publicaciones ganadoras"}.`:"Se inspirará en las publicaciones con más interacción."}</span>
        <button type="button" className={ready&&!generated.length?"uiBtn uiBtnPrimary":"uiBtn uiBtnSecondary"} onClick={generate} disabled={generating||!ready}>{generating?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Generar copys</button>
      </div>
    </section>

    {!!generated.length&&<section className="inspCard">
      <div className="inspCardHead"><div><h2>Copys propuestos</h2><p>Solo pueden salir de aquí los que estén en PASS y sin riesgo de similitud.</p></div><div className="inspHeadActions"><span className="inspFooterNote">{selectedCount} de {generated.length} seleccionados</span><button type="button" className="uiBtn uiBtnSecondary" onClick={saveSelected} disabled={saving||!hasSelection}>{saving?<Loader2 className="spin" size={16}/>:<Database size={16}/>} Guardar en Biblioteca</button>{format==="image"?<><button type="button" className="uiBtn uiBtnSecondary" onClick={queueSelected} disabled={!hasSelection}><Send size={16}/> Enviar a Bandeja</button><button type="button" className="uiBtn uiBtnPrimary" onClick={sendToStudio} disabled={!hasSelection}><ImageIcon size={16}/> Enviar al Estudio creativo</button></>:<button type="button" className="uiBtn uiBtnPrimary" onClick={queueSelected} disabled={!hasSelection}><Send size={16}/> Enviar a Bandeja</button>}</div></div>
      <ul className="inspResults">{generated.map((item,index)=>{const safe=item.compliance?.status==="pass"&&!item.duplicateRisk;const pass=item.compliance?.status==="pass";return <li className={safe?"inspResult":"inspResult blocked"} key={`${index}-${item.text.slice(0,20)}`}>
        <input type="checkbox" className="inspCheck" checked={Boolean(item.selected)} disabled={!safe} aria-label={`Seleccionar copy ${index+1}`} onChange={()=>toggle(index)}/>
        <div className="inspResultBody">
          <div className="inspTags"><span className={`statusPill ${pass?"tone-success":"tone-warning"}`}>{pass?<CheckCircle2 size={13}/>:<ShieldCheck size={13}/>} {String(item.compliance?.status||"review").toUpperCase()}</span><span className="statusPill tone-neutral">{item.novelty}% novedad</span><span className="statusPill tone-neutral">Score {item.editorialScore}</span>{item.duplicateRisk&&<span className="statusPill tone-warning"><AlertTriangle size={13}/> Similitud alta</span>}</div>
          <p>{item.text}</p>
          {item.rationale&&<small>{item.rationale}</small>}
          <div className="inspMetaLine"><span>Patrón: {item.patternUsed||"—"}</span><span>Similitud externa: {Math.round(Number(item.externalSimilarity||0)*100)}%</span><span>Similitud propia: {Math.round(Number(item.ownSimilarity||0)*100)}%</span></div>
        </div>
      </li>})}</ul>
    </section>}
  </div>;
}

const flow=["Bright Data","Varias páginas","Analyzer","Embeddings","Clusters","RAG"];
function Stat({label,value,hint}:{label:string;value:number|string;hint?:string}){return <div className="inspStat"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>}
