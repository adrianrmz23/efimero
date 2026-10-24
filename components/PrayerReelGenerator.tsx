"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clipboard, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

type Review={status:string;score:number;issues?:Array<{code?:string;message?:string}>;correctedText?:string};

const themes=[
  "Fortaleza y confianza",
  "Gratitud",
  "Noche y descanso",
  "Mañana y nuevos comienzos",
  "Familia y hogar",
  "Preocupaciones y ansiedad cotidiana",
  "Decisiones y caminos",
  "Esperanza en momentos difíciles",
  "Perdón y paz interior",
  "Protección y acompañamiento",
  "Trabajo, proyectos y propósito",
  "Paciencia durante la espera",
] as const;

const lengths=[
  {id:"similar",label:"Similar al ejemplo",note:"150–210 palabras",instruction:"Entre 150 y 210 palabras, sin contar el título."},
  {id:"short",label:"Un poco más corta",note:"110–150 palabras",instruction:"Entre 110 y 150 palabras, sin contar el título."},
  {id:"long",label:"Más desarrollada",note:"220–280 palabras",instruction:"Entre 220 y 280 palabras, sin contar el título."},
] as const;

export default function PrayerReelGenerator(){
  const [theme,setTheme]=useState<(typeof themes)[number]>("Fortaleza y confianza");
  const [length,setLength]=useState<(typeof lengths)[number]["id"]>("similar");
  const [focus,setFocus]=useState("Quiero una oración cálida, íntima y fácil de leer en pantalla.");
  const [text,setText]=useState("");
  const [model,setModel]=useState("");
  const [review,setReview]=useState<Review|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [copied,setCopied]=useState(false);

  async function reviewText(value:string){
    const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:value})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"No se pudo ejecutar el revisor de políticas.");
    const item=d.items?.[0];
    if(!item)throw new Error("Compliance no devolvió un resultado utilizable.");
    return item as Review;
  }

  async function generate(){
    setBusy(true);setError("");setNotice("");setReview(null);setCopied(false);
    try{
      const selected=lengths.find(x=>x.id===length)||lengths[0];
      const objective=[
        `Tema principal: ${theme}.`,
        selected.instruction,
        focus.trim()?`Intención adicional: ${focus.trim()}`:"",
        "Necesito SOLO el texto de la oración para usarlo en un reel. Incluye un título breve y termina con Amén.",
      ].filter(Boolean).join(" ");
      const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:"Oraciones",count:1,mode:"quick",interactionStyle:"Devocional",contentFormat:"Oración para Reel",objective,recentTexts:[]})});
      const d=await r.json();
      if(!r.ok){const detail=Array.isArray(d.details)&&d.details.length?` ${d.details.join(" · ")}`:"";throw new Error(`${d.error||"No fue posible generar la oración."}${detail}`)}
      const candidate=String(d.items?.[0]||"").trim();
      if(!candidate)throw new Error("La IA no devolvió una oración utilizable.");

      let checked=await reviewText(candidate);
      let finalText=candidate;
      let adjusted=false;
      if(checked.status!=="pass"&&checked.correctedText?.trim()&&checked.correctedText.trim()!==candidate){
        const corrected=checked.correctedText.trim();
        const second=await reviewText(corrected);
        if(second.status==="pass"){finalText=corrected;checked=second;adjusted=true}
      }
      if(checked.status!=="pass"){
        const reasons=(checked.issues||[]).slice(0,3).map(x=>x.message||x.code).filter(Boolean).join(" · ");
        throw new Error(`La oración no pasó Compliance${reasons?`: ${reasons}`:"."}`);
      }

      setText(finalText);
      setReview(checked);
      setModel(`${d.model||"IA"}${d.source?` · ${d.source}`:""}`);
      if(adjusted)setNotice("Compliance ajustó el texto antes de aprobarlo.");
      else setNotice("Texto aprobado por el revisor de políticas de Facebook.");
    }catch(e:any){setError(e?.message||"Falló la generación de la oración.")}finally{setBusy(false)}
  }

  async function copy(){
    if(!text)return;
    try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setError("No se pudo copiar automáticamente. Selecciona el texto manualmente.")}
  }

  const selectedLength=lengths.find(x=>x.id===length)||lengths[0];
  const words=text.trim()?text.trim().split(/\s+/).length:0;

  return <section className="studioPrayer" aria-labelledby="prayer-title">
    <div className="studioSectionHead">
      <div><span className="overline">ORACIONES PARA REEL</span><h2 id="prayer-title">Generador de oraciones</h2><p>Textos largos y serenos, listos para que armes el reel. Cada oración pasa por Compliance antes de mostrarse como aprobada.</p></div>
      <span className="statusPill tone-accent studioBadge"><ShieldCheck size={14}/> Compliance obligatorio</span>
    </div>
    <div className="studioTwoCol">
      <div className="studioCard">
        <label><span>Tema</span><select value={theme} onChange={e=>setTheme(e.target.value as any)}>{themes.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Extensión</span><select value={length} onChange={e=>setLength(e.target.value as any)}>{lengths.map(x=><option key={x.id} value={x.id}>{x.label} · {x.note}</option>)}</select><small>{selectedLength.note}, para una lectura pausada en pantalla.</small></label>
        <label><span>Enfoque adicional <small>opcional</small></span><textarea value={focus} onChange={e=>setFocus(e.target.value)} rows={4} placeholder="Ej. para alguien que pasa un momento difícil y necesita recuperar la calma…"/></label>
        <button className="uiBtn uiBtnPrimary wide studioGenerate" onClick={generate} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:text?<RefreshCw size={16}/>:<Sparkles size={16}/>} {busy?"Generando y revisando…":text?"Generar otra oración":"Generar oración"}</button>
        <p className="studioNote"><ShieldCheck size={14}/><span>Sin pedir comentar, compartir, reaccionar, etiquetar ni escribir “Amén”. El cierre puede ser simplemente “Amén”.</span></p>
      </div>

      <div className="studioCard studioSticky studioPrayerResult">
        {!text?<div className="studioEmpty"><Sparkles size={28}/><strong>La oración aparecerá aquí</strong><span>Solo texto, lista para copiar y montar en tu reel.</span></div>:<>
          <div className="studioResultTop">
            <div><span className="statusPill tone-neutral">{theme}</span>{model&&<small>{model}</small>}</div>
            {review&&<span className="statusPill tone-success"><CheckCircle2 size={13}/> Aprobada · {Math.round(Number(review.score||0))}/100</span>}
          </div>
          <textarea className="studioReading" value={text} onChange={e=>setText(e.target.value)} spellCheck={false} aria-label="Oración generada"/>
          <div className="studioResultFoot">
            <div className="studioMetaLine"><span>{words} palabras</span><span>{text.length} caracteres</span><span>Objetivo: {selectedLength.note}</span></div>
            <button className="uiBtn uiBtnSecondary" onClick={copy}>{copied?<CheckCircle2 size={16}/>:<Clipboard size={16}/>} {copied?"Copiado":"Copiar texto"}</button>
          </div>
        </>}
        {notice&&<div className="studioNotice success"><CheckCircle2 size={16}/><span>{notice}</span></div>}
        {error&&<div className="studioNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
      </div>
    </div>
  </section>;
}
