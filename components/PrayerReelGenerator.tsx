"use client";

import { useState } from "react";
import { CheckCircle2, Clipboard, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

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

  return <section className="prayerStudio">
    <div className="prayerStudioHeader">
      <div><span className="overline">ORACIONES PARA REEL</span><h2>Generador de oraciones</h2><p>Textos largos, serenos y listos para que tú armes el reel. Efímero revisa cada salida antes de mostrártela como aprobada.</p></div>
      <div className="prayerComplianceBadge"><ShieldCheck size={17}/><div><strong>Compliance obligatorio</strong><span>Sin engagement bait</span></div></div>
    </div>
    <div className="prayerStudioGrid">
      <div className="prayerControls">
        <label><span>Tema de la oración</span><select value={theme} onChange={e=>setTheme(e.target.value as any)}>{themes.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Extensión</span><select value={length} onChange={e=>setLength(e.target.value as any)}>{lengths.map(x=><option key={x.id} value={x.id}>{x.label} · {x.note}</option>)}</select><small>{selectedLength.note}, pensada para lectura pausada en reel.</small></label>
        <label><span>Enfoque adicional <em>opcional</em></span><textarea value={focus} onChange={e=>setFocus(e.target.value)} rows={4} placeholder="Ej. para alguien que está pasando un momento difícil y necesita recuperar calma…"/></label>
        <button className="prayerGenerateButton" onClick={generate} disabled={busy}>{busy?<Loader2 className="spin" size={19}/>:text?<RefreshCw size={19}/>:<Sparkles size={19}/>} {busy?"Generando y revisando…":text?"Generar otra oración":"Generar oración"}</button>
        <div className="prayerRules"><ShieldCheck size={16}/><span>Sin pedir comentar, compartir, reaccionar, etiquetar ni escribir “Amén”. El cierre puede ser simplemente “Amén”.</span></div>
      </div>

      <div className={text?"prayerResult hasText":"prayerResult"}>
        {!text?<div className="prayerEmpty"><Sparkles size={34}/><strong>La oración aparecerá aquí</strong><span>Solo texto, lista para copiar y montar en tu reel.</span></div>:<>
          <div className="prayerResultTop"><div><span>{theme}</span>{model&&<small>{model}</small>}</div>{review&&<b className="prayerPass"><CheckCircle2 size={14}/> PASS · {Math.round(Number(review.score||0))}/100</b>}</div>
          <textarea value={text} onChange={e=>setText(e.target.value)} spellCheck={false}/>
          <div className="prayerMeta"><span>{words} palabras</span><span>{text.length} caracteres</span><span>{selectedLength.note}</span></div>
          <button className="uiBtn uiBtnPrimary prayerCopy" onClick={copy}><Clipboard size={16}/> {copied?"Copiado":"Copiar texto"}</button>
        </>}
        {notice&&<div className="inlineNotice">{notice}</div>}
        {error&&<div className="inlineNotice error">{error}</div>}
      </div>
    </div>
  </section>;
}
