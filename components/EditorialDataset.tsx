"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Database, Info, Loader2, Search, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Hit={id:string;text:string;category:string;similarity:number;performance_score:number;hook:string;topic_key:string;length_bucket:string};
export default function EditorialDataset(){
  const [count,setCount]=useState(0);const [busy,setBusy]=useState(false);const [query,setQuery]=useState("relaciones que funcionen para compartibilidad sin CTA");const [hits,setHits]=useState<Hit[]>([]);const [message,setMessage]=useState("");
  async function loadCount(){const db=supabase;if(!db)return;const {count}=await db.from("efimero_editorial_dataset").select("id",{count:"exact",head:true});setCount(count||0)}
  useEffect(()=>{void loadCount()},[]);
  async function index(){setBusy(true);setMessage("");try{const r=await fetch("/api/dataset/index",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:200})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo indexar.");setMessage(`${d.indexed||0} textos indexados con ${d.model}.`);await loadCount()}catch(e:any){setMessage(e?.message||"Falló la indexación.")}finally{setBusy(false)}}
  async function search(){if(!query.trim())return;setBusy(true);setMessage("");try{const r=await fetch("/api/dataset/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,limit:12})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo buscar.");setHits(d.items||[])}catch(e:any){setMessage(e?.message||"Falló la búsqueda.")}finally{setBusy(false)}}
  return <>
    <div className="pageIntro"><div><span className="overline">MEMORIA</span><h1>Dataset editorial</h1><p>Indexa Biblioteca e histórico con embeddings para recuperar los textos semánticamente más relevantes, no ejemplos al azar.</p></div><button className="uiBtn uiBtnSecondary" onClick={index} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<Database size={16}/>} Indexar 200 textos</button></div>
    <div className="setStack">
      {message&&<div className="setNotice"><Info size={16}/><span>{message}</span></div>}
      <div className="setKpis">
        <div className="setKpi"><span>Textos indexados</span><strong>{count.toLocaleString("es-MX")}</strong></div>
        <div className="setKpi"><span>Modelo</span><strong className="text">text-embedding-3-small</strong></div>
        <div className="setKpi"><span>Búsqueda</span><strong className="text">Semántica</strong></div>
        <div className="setKpi"><span>Objetivo</span><strong className="text">RAG editorial</strong></div>
      </div>

      <section className="setCard flush">
        <div className="setCardHead"><div className="setCardTitle"><BrainCircuit size={18}/><div><h2>Explorar memoria</h2><p>Describe el tipo de texto que quieres producir y revisa qué históricos son más cercanos.</p></div></div></div>
        <div className="setCardBody">
          <div className="setSearch"><input aria-label="Describe el texto que buscas" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej. nostalgia breve que invite a recordar sin pedir comentarios"/><button className="uiBtn uiBtnPrimary" onClick={search} disabled={busy}><Search size={16}/> Buscar</button></div>
        </div>
        {hits.length?<div className="setRows setRowsDivided">{hits.map(hit=><div className="setRow top" key={hit.id}>
          <div className="setRowMain"><p className="setRowText">{hit.text}</p><div className="setMeta"><span>{hit.category}</span><span>Hook: {hit.hook||"—"}</span><span>{hit.length_bucket}</span><span>Score {Math.round(Number(hit.performance_score||0))}</span></div></div>
          <span className="statusPill tone-accent">{Math.round(Number(hit.similarity||0)*100)}% similar</span>
        </div>)}</div>:<div className="setEmpty setRowsDivided"><Sparkles size={20}/><strong>Sin resultados todavía</strong><span>Indexa y busca para empezar a construir el RAG editorial.</span></div>}
      </section>
    </div>
  </>;
}
