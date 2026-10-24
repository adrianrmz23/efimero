"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useMemo, useState } from "react";
import { Archive, Beaker, Check, Copy, FlaskConical, Loader2, MessageCircle, Share2, ShieldCheck, Sparkles, Target, ThumbsUp, Trophy, WandSparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePages } from "@/lib/pagesContext";

type LibraryItem={id:string;text:string;category:string;source?:string;sourcePageId?:string;sourcePageName?:string;reactions?:number;comments?:number;shares?:number;reach?:number;notes?:string;format?:string;createdAt?:string;generationBatch?:string;extractionMetadata?:Record<string,unknown>};
type Props={library:LibraryItem[];onSaveItems:(items:any[])=>Promise<void>|void};
type Variant={id:string;text:string;label:string;hypothesis:string;selected:boolean;compliance?:any;reactions:number;comments:number;shares:number};
const metric=(v:Variant)=>v.reactions+v.comments*2+v.shares*4;
export default function CopyExperiments({library,onSaveItems}:Props){
 const {pages,activePageId}=usePages();
 // Selección local: elegir otra página aquí no cambia la página activa global.
 const [localPageId,setPageId]=useState("");
 const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
 const[baseText,setBaseText]=useState("");const[dimension,setDimension]=useState("Hook");const[count,setCount]=useState(4);const[variants,setVariants]=useState<Variant[]>([]);const[generating,setGenerating]=useState(false);const[saving,setSaving]=useState(false);const[notice,setNotice]=useState("");
 const page=pages.find(p=>p.id===pageId);const candidates=useMemo(()=>library.filter(x=>x.text?.trim()&&x.source!=="reference"&&(!pageId||x.sourcePageId===pageId)).slice(0,40),[library,pageId]);
 const leader=variants.filter(v=>metric(v)>0).sort((a,b)=>metric(b)-metric(a))[0];
 async function generate(){if(!baseText.trim())return;setGenerating(true);setNotice("");try{const learning=(()=>{try{const m=JSON.parse(localStorage.getItem("efimero_learning_profiles")||"{}");return m?.[pageId]||null}catch{return null}})();const r=await fetch("/api/experiments/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:baseText,dimension,count,pageName:page?.name,learning})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible generar variantes.");setVariants((d.items||[]).map((x:any)=>({id:crypto.randomUUID(),text:x.text,label:x.label,hypothesis:x.hypothesis,selected:true,compliance:x.compliance,reactions:0,comments:0,shares:0})));setNotice("Variantes creadas y revisadas por Compliance Meta.")}catch(e:any){setNotice(e.message)}finally{setGenerating(false)}}
 async function save(){const chosen=variants.filter(v=>v.selected);if(!chosen.length)return;setSaving(true);const batch=`experiment-${Date.now()}`;try{await onSaveItems(chosen.map(v=>({id:crypto.randomUUID(),text:v.text,category:"Experimento",format:"Texto",createdAt:new Date().toISOString(),source:"generated",sourcePageId:pageId,sourcePageName:page?.name,notes:`Experimento ${dimension} · ${v.label}`,generationBatch:batch,extractionMetadata:{experimentDimension:dimension,hypothesis:v.hypothesis,compliance:v.compliance}})));if(supabase)await supabase.from("efimero_copy_experiments").insert({page_id:pageId,page_name:page?.name,base_text:baseText,dimension,variants:chosen,status:"draft"});setNotice(`${chosen.length} variantes guardadas en Biblioteca.`)}finally{setSaving(false)}}
 function setMetric(id:string,key:"reactions"|"comments"|"shares",value:number){setVariants(c=>c.map(v=>v.id===id?{...v,[key]:Math.max(0,value)}:v))}
 return <>
  <div className="pageIntro"><div><span className="overline">INTELIGENCIA</span><h1>Experimentos de copy</h1><p>Prueba una sola variable a la vez: hook, longitud, tono o pregunta frente a afirmación. Así aprendes del copy sin confundir señales.</p></div><span className="setBadge"><FlaskConical size={14}/>A/B/n · solo texto</span></div>
  <div className="setStack">
   <section className="setCard">
    <div className="setCardTitle"><Beaker size={18}/><div><h2>Configura el experimento</h2><p>Elige la variable y escribe el texto base. Cada variante pasa por Compliance Meta.</p></div></div>
    <div className="setFields c3">
     <label className="setField"><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
     <label className="setField"><span>Variable a probar</span><select value={dimension} onChange={e=>setDimension(e.target.value)}><option>Hook</option><option>Longitud</option><option>Tono</option><option>Pregunta vs afirmación</option></select></label>
     <label className="setField"><span>Variantes</span><select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></label>
    </div>
    <label className="setField"><span>Texto base</span><textarea value={baseText} onChange={e=>setBaseText(e.target.value)} placeholder="Escribe un concepto o pega un texto de tu Biblioteca…"/></label>
    {candidates.length>0&&<div className="setField"><span className="setFieldLabel">Usar como base</span><div className="setPickList">{candidates.slice(0,6).map(x=><button type="button" className="setPick" key={x.id} onClick={()=>setBaseText(x.text)} title={x.text}>{x.text.slice(0,70)}{x.text.length>70?"…":""}</button>)}</div></div>}
    <button className={`uiBtn ${variants.length?"uiBtnSecondary":"uiBtnPrimary"} wide`} onClick={generate} disabled={generating||!baseText.trim()}>{generating?<Loader2 className="spin" size={16}/>:<WandSparkles size={16}/>} {generating?"Creando variantes…":"Generar experimento"}</button>
   </section>

   {notice&&<div className="setNotice"><Sparkles size={16}/><span>{notice}</span></div>}

   {variants.length>0&&<section className="setCard flush">
    <div className="setCardHead">
     <div className="setCardTitle"><Target size={18}/><div><h2>Experimento activo · {dimension}</h2><p>Edita y selecciona variantes. Registra las métricas cuando se hayan publicado.</p></div></div>
     <button className="uiBtn uiBtnPrimary" onClick={save} disabled={saving||!variants.some(v=>v.selected)}>{saving?<Loader2 className="spin" size={16}/>:<Archive size={16}/>} Guardar seleccionadas</button>
    </div>
    <div className="setVariantGrid">{variants.map((v,i)=><article className={`setVariant ${v.selected?"selected":""} ${leader?.id===v.id?"leader":""}`} key={v.id}>
     <div className="setVariantHead">
      <button type="button" className={v.selected?"setCheckbox on":"setCheckbox"} aria-pressed={v.selected} aria-label={v.selected?"Quitar variante":"Seleccionar variante"} onClick={()=>setVariants(c=>c.map(x=>x.id===v.id?{...x,selected:!x.selected}:x))}>{v.selected?<Check size={14}/>:null}</button>
      <b>Variante {String(i+1).padStart(2,"0")}</b>
      <span className="setTag">{v.label}</span>
      {leader?.id===v.id&&<span className="statusPill tone-success"><Trophy size={12}/> Mejor señal</span>}
     </div>
     <textarea aria-label={`Texto de la variante ${i+1}`} value={v.text} onChange={e=>setVariants(c=>c.map(x=>x.id===v.id?{...x,text:e.target.value}:x))}/>
     <p className="setRowNote">{v.hypothesis}</p>
     <div className="setMeta"><span><ShieldCheck size={13}/>Meta {v.compliance?.score??"—"}/100 · {v.compliance?.status||"pendiente"}</span></div>
     <div className="setMetricInputs">
      <label title="Reacciones"><ThumbsUp size={14}/><input aria-label="Reacciones" type="number" min={0} value={v.reactions} onChange={e=>setMetric(v.id,"reactions",Number(e.target.value))}/></label>
      <label title="Comentarios"><MessageCircle size={14}/><input aria-label="Comentarios" type="number" min={0} value={v.comments} onChange={e=>setMetric(v.id,"comments",Number(e.target.value))}/></label>
      <label title="Compartidos"><Share2 size={14}/><input aria-label="Compartidos" type="number" min={0} value={v.shares} onChange={e=>setMetric(v.id,"shares",Number(e.target.value))}/></label>
     </div>
     <footer className="setVariantFoot"><span>Señal {metric(v).toLocaleString("es-MX")}</span><button type="button" className="linkButton" onClick={()=>navigator.clipboard?.writeText(v.text)}><Copy size={14}/> Copiar</button></footer>
    </article>)}</div>
   </section>}
  </div>
 </>
}
