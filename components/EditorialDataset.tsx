"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Database, Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Hit={id:string;text:string;category:string;similarity:number;performance_score:number;hook:string;topic_key:string;length_bucket:string};
export default function EditorialDataset(){
  const [count,setCount]=useState(0);const [busy,setBusy]=useState(false);const [query,setQuery]=useState("relaciones que funcionen para compartibilidad sin CTA");const [hits,setHits]=useState<Hit[]>([]);const [message,setMessage]=useState("");
  async function loadCount(){const db=supabase;if(!db)return;const {count}=await db.from("efimero_editorial_dataset").select("id",{count:"exact",head:true});setCount(count||0)}
  useEffect(()=>{void loadCount()},[]);
  async function index(){setBusy(true);setMessage("");try{const r=await fetch("/api/dataset/index",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:200})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo indexar.");setMessage(`${d.indexed||0} textos indexados con ${d.model}.`);await loadCount()}catch(e:any){setMessage(e?.message||"Falló la indexación.")}finally{setBusy(false)}}
  async function search(){if(!query.trim())return;setBusy(true);setMessage("");try{const r=await fetch("/api/dataset/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,limit:12})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo buscar.");setHits(d.items||[])}catch(e:any){setMessage(e?.message||"Falló la búsqueda.")}finally{setBusy(false)}}
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 23 · DATASET EDITORIAL</span><h1>Una memoria que encuentra el ejemplo correcto</h1><p>Indexa Biblioteca + histórico con embeddings para recuperar textos semánticamente relevantes, no ejemplos al azar.</p></div><button className="uiBtn uiBtnPrimary" onClick={index} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<Database size={16}/>} Indexar 200 textos</button></div>
    {message&&<div className="inlineNotice">{message}</div>}
    <div className="opsMetricGrid"><article className="opsMetric"><span>Textos indexados</span><strong>{count}</strong></article><article className="opsMetric"><span>Modelo</span><strong className="smallMetric">text-embedding-3-small</strong></article><article className="opsMetric"><span>Búsqueda</span><strong className="smallMetric">Semántica</strong></article><article className="opsMetric"><span>Objetivo</span><strong className="smallMetric">RAG editorial</strong></article></div>
    <section className="toolPanel"><div className="panelTitle"><div><BrainCircuit size={20}/><div><h2>Explorar memoria</h2><p>Describe el tipo de texto que quieres producir y revisa qué históricos son más cercanos.</p></div></div></div><div className="datasetSearch"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej. nostalgia breve que invite a recordar sin pedir comentarios"/><button className="uiBtn uiBtnPrimary" onClick={search} disabled={busy}><Search size={16}/> Buscar</button></div><div className="datasetHits">{hits.map(hit=><article key={hit.id}><div><span>{hit.category}</span><b>{Math.round(Number(hit.similarity||0)*100)}% similar</b></div><p>{hit.text}</p><small>Hook: {hit.hook||"—"} · {hit.length_bucket} · score {Math.round(Number(hit.performance_score||0))}</small></article>)}{!hits.length&&<div className="emptyInline"><Sparkles size={18}/> Indexa y busca para empezar a construir RAG editorial.</div>}</div></section>
  </>;
}
