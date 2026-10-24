"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, CalendarClock, Loader2, RefreshCw, Send, ShieldCheck, Sparkles, Star, Trash2 } from "lucide-react";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type Category={id?:string;name:string;emoji?:string;enabled?:boolean};
type LibraryItem={text:string;category:string;favorite?:boolean;performanceScore?:number;source?:string};
type Props={
  categories:Category[];
  library:LibraryItem[];
  editorialProfile?:any;
  onSaveItems:(items:any[])=>Promise<void>|void;
  onSchedule:(draft:{text:string;category:string})=>void;
};

const styles=[
  ["Mixto","Alterna preguntas naturales, humor, nostalgia y frases identificables."],
  ["Pregunta personal","Una pregunta concreta que active recuerdo u opinión sin pedir comentar."],
  ["Humor identificable","Situación cotidiana corta, espontánea y compartible por identificación."],
  ["Nostalgia","Recuerdo sencillo que invite a pensar en otra época."],
  ["Dilema","Dos opciones o una situación que provoque una elección mental natural."],
  ["Reto ligero","Pequeño acertijo o reto breve; sin pedir compartir ni etiquetar."],
] as const;

const contentFormats=[
  ["Conversacional breve","Copy corto pensado para interacción natural."],
  ["Frase breve de fe","Una sola idea de fe, contundente y fácil de leer."],
  ["Versículo + reflexión","Referencia bíblica breve seguida de una aplicación cotidiana."],
  ["Oración","Oración cálida y desarrollada, útil para mañana, noche o una situación concreta."],
  ["Reflexión de fe","Texto más profundo de acompañamiento, esperanza y confianza."],
  ["Mensaje de esperanza","Mensaje medio, directo y reconfortante para una situación difícil."],
  ["Mensaje devocional en segunda persona","Texto cercano tipo “Dios te recuerda…”, sin presentarlo como revelación privada literal."],
  ["Salmo + acompañamiento","Referencia a un Salmo y reflexión de acompañamiento sin copiar citas extensas."],
] as const;

export default function QuickPostStudio({categories,library,editorialProfile,onSaveItems,onSchedule}:Props){
  const enabled=categories.filter(x=>x.enabled!==false);
  const [category,setCategory]=useState(enabled.find(x=>x.name==="Preguntas")?.name||enabled[0]?.name||"General");
  const [style,setStyle]=useState("Mixto");
  const [contentFormat,setContentFormat]=useState("Conversacional breve");
  const [objective,setObjective]=useState("Texto corto que provoque una respuesta mental o conversación natural.");
  const [text,setText]=useState("");
  const [model,setModel]=useState("");
  const [busy,setBusy]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const {pages,activePageId:pageId,setActivePage}=usePages();
  const confirm=useConfirm();
  const [pageNiches,setPageNiches]=useState<Record<string,string>>({});
  const [saved,setSaved]=useState<""|"saved"|"favorite">("");
  const [recentGenerated,setRecentGenerated]=useState<string[]>([]);

  useEffect(()=>{
    fetch("/api/niches",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{
      if(d?.experiments)setPageNiches(Object.fromEntries(d.experiments.filter((x:any)=>x.page_id).map((x:any)=>[String(x.page_id),String(x.niche)])));
    }).catch(()=>{});
  },[]);
  const page=pages.find(x=>x.id===pageId);
  const activeNiche=pageNiches[pageId]||"";
  useEffect(()=>{
    if(activeNiche==="Fe"){setContentFormat("Reflexión de fe");setStyle("Mixto")}
    else if(activeNiche==="Nostalgia"){setContentFormat("Conversacional breve");setStyle("Nostalgia")}
    else if(activeNiche==="Humor cotidiano"){setContentFormat("Conversacional breve");setStyle("Humor identificable")}
  },[activeNiche]);
  const examples=useMemo(()=>library.filter(x=>x.category===category&&x.source!=="reference").sort((a,b)=>Number(b.favorite)-Number(a.favorite)||(b.performanceScore||0)-(a.performanceScore||0)).slice(0,12).map(x=>x.text),[library,category]);

  async function generate(){
    setBusy(true);setError("");setNotice("");setSaved("");
    try{
      const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,count:1,examples,profile:editorialProfile||null,mode:"quick",interactionStyle:style,contentFormat,objective:activeNiche?`PÁGINA DE NICHO: ${activeNiche}. ${activeNiche==="Fe"?"Crear textos genuinos de fe y esperanza, sin atribuir falsas citas bíblicas ni revelaciones personales.":activeNiche==="Nostalgia"?"Enfocarse en recuerdos específicos y memorias cotidianas, sin reciclar copys ajenos.":activeNiche==="Humor cotidiano"?"Humor original sobre situaciones comunes; sin ataques ni burlas a personas o colectivos.":"Adaptar tono y temática a ese nicho."} Objetivo adicional: ${objective}`:objective,recentTexts:recentGenerated})});
      const d=await r.json();if(!r.ok){const detail=Array.isArray(d.details)&&d.details.length?` ${d.details.join(" · ")}`:"";throw new Error(`${d.error||"No fue posible generar el texto."}${detail}`)}
      const value=String(d.items?.[0]||"").trim();if(!value)throw new Error("El modelo no devolvió una publicación utilizable.");
      setText(value);setRecentGenerated(prev=>[...prev,value].slice(-10));setModel(`${d.model||"IA"}${d.source?` · ${d.source}`:""}`);if(d.warning)setNotice(`Generado con IA secundaria. ${d.warning}`);
    }catch(e:any){setError(e?.message||"Falló la generación.")}finally{setBusy(false)}
  }

  async function save(favorite:boolean){
    if(!text.trim()||saved)return;
    const item={id:crypto.randomUUID(),text:text.trim(),category,format:"Texto",createdAt:new Date().toISOString(),source:"generated",favorite,notes:`Generado con ${model||"IA"}`};
    try{await onSaveItems([item]);setSaved(favorite?"favorite":"saved");setNotice(favorite?"Guardado en Favoritos.":"Guardado en Biblioteca.")}catch(e:any){setError(e?.message||"No se pudo guardar.")}
  }

  async function publish(){
    if(!text.trim()){return}if(!pageId){setError("Conecta o selecciona una página de Facebook.");return}
    setActionBusy(true);setError("");setNotice("");
    try{
      const check=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
      const cd=await check.json();const compliance=cd.items?.[0];if(!check.ok||!compliance)throw new Error(cd.error||"No se pudo revisar Compliance.");
      if(compliance.status!=="pass")throw new Error("Este texto necesita revisión antes de publicarse. Prueba otra generación o ajústalo.");
      if(!await confirm({
        title:"¿Publicar ahora?",
        description:`Página: ${page?.name||"Facebook"}\nEl texto pasó Compliance y se publicará de inmediato, sin programación.`,
        confirmLabel:"Publicar ahora",
      }))return;
      const r=await fetch("/api/meta/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId,message:text,publishNow:true})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Meta rechazó la publicación.");setNotice("Publicación enviada a Facebook.");
    }catch(e:any){setError(e?.message||"No fue posible publicar.")}finally{setActionBusy(false)}
  }

  return <section className="quickStudio">
    <div className="pageIntro quickStudioHeader"><div><span className="overline">GENERADOR RÁPIDO · CHEAPER INFERENCE</span><h1>Una publicación a la vez</h1><p>Genera un copy corto con intención conversacional y decide después si publicarlo, guardarlo, programarlo o descartarlo.</p></div><div className="modelPill"><Sparkles size={16}/><span>{model||"GPT-5.6 Terra"}</span><small>IA real · calidad/costo</small></div></div>
    <div className="quickStudioGrid">
      <div className="quickControls">
        <div className="fieldRow">
        <label><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{enabled.map(c=><option key={c.name}>{c.name}</option>)}</select></label>
        <label><span>Formato del copy</span><select value={contentFormat} onChange={e=>setContentFormat(e.target.value)}>{contentFormats.map(([name])=><option key={name}>{name}</option>)}</select><small>{contentFormats.find(x=>x[0]===contentFormat)?.[1]}</small></label>
        </div>
        <label><span>Tipo de interacción</span><select value={style} onChange={e=>setStyle(e.target.value)}>{styles.map(([name])=><option key={name}>{name}</option>)}</select><small>{contentFormat==="Conversacional breve"?styles.find(x=>x[0]===style)?.[1]:"Se usa como matiz secundario; el formato elegido arriba define la estructura principal."}</small></label>
        <label><span>Qué quieres provocar</span><textarea value={objective} onChange={e=>setObjective(e.target.value)} rows={3}/></label>
        {activeNiche&&<div className="quickNicheBadge"><Sparkles size={15}/> Nicho asignado: <strong>{activeNiche}</strong> · guía el prompt de la IA</div>}
        <label><span>Página para publicar</span><select value={pageId} onChange={e=>void setActivePage(e.target.value)}><option value="">Selecciona…</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select><small>Sincronizada con la página activa global.</small></label>
        <button className="quickGenerate" onClick={generate} disabled={busy}>{busy?<Loader2 className="spin" size={19}/>:text?<RefreshCw size={19}/>:<Sparkles size={19}/>} {busy?"Generando…":text?"Generar otra":"Generar publicación"}</button>
        <div className="qualityNote"><ShieldCheck size={16}/><span>Buscamos conversación natural, no llamadas artificiales a comentar, compartir o reaccionar.</span></div>
      </div>
      <div className={text?"quickResult hasText":"quickResult"}>
        {!text?<div className="quickEmpty"><Sparkles size={34}/><strong>Tu próximo copy aparecerá aquí</strong><span>Más corto, más concreto y pensado para detener el scroll.</span></div>:<>
          <div className="quickResultTop"><span>{category}</span>{model&&<small>{model}</small>}</div>
          <textarea value={text} onChange={e=>{setText(e.target.value);setSaved("")}}/>
          <div className="quickMeta"><span>{text.trim().split(/\s+/).filter(Boolean).length} palabras</span><span>{text.length} caracteres</span></div>
          <div className="quickActions">
            <button className="uiBtn uiBtnPrimary" onClick={publish} disabled={actionBusy}>{actionBusy?<Loader2 className="spin" size={16}/>:<Send size={16}/>} Publicar</button>
            <button className="uiBtn uiBtnSecondary" onClick={()=>onSchedule({text,category})}><CalendarClock size={16}/> Programar</button>
            <button className="uiBtn uiBtnSecondary" onClick={()=>save(false)} disabled={Boolean(saved)}><Bookmark size={16}/> {saved==="saved"?"Guardado":"Guardar"}</button>
            <button className={saved==="favorite"?"uiBtn favoriteAction active":"uiBtn favoriteAction"} onClick={()=>save(true)} disabled={Boolean(saved)}><Star size={16}/> {saved==="favorite"?"Favorito":"Favorito"}</button>
            <button className="uiIconBtn danger" title="Descartar" onClick={()=>{setText("");setSaved("");setNotice("");setError("")}}><Trash2 size={17}/></button>
          </div>
        </>}
        {(notice||error)&&<div className={error?"quickNotice error":"quickNotice"}>{error||notice}</div>}
      </div>
    </div>
  </section>
}
