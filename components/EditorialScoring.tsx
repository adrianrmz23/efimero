"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Gauge, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";

const dimensions:[string,string][]=[["compliance","Compliance"],["novelty","Novedad"],["historicalAlignment","Alineación histórica"],["historicalSignal","Señal histórica"],["lengthFit","Longitud"],["fatigueSafety","Anti-fatiga"]];
export default function EditorialScoring(){
  const [text,setText]=useState("A veces dejar de insistir también es una forma de cuidarte.");const [category,setCategory]=useState("Frases identificables");const [busy,setBusy]=useState(false);const [result,setResult]=useState<any>(null);const [error,setError]=useState("");
  async function evaluate(){if(!text.trim())return;setBusy(true);setError("");try{const r=await fetch("/api/editorial-score/evaluate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,category,targetWords:18})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible evaluar.");setResult(d.result)}catch(e:any){setError(e?.message||"Falló el scoring.")}finally{setBusy(false)}}
  const verdictLabel=result?.verdict==="strong"?"Fuerte":result?.verdict==="promising"?"Prometedor":result?.verdict==="review"?"Revisar":"Débil";
  const verdictTone=result?.verdict==="strong"?"tone-success":result?.verdict==="promising"?"tone-accent":result?.verdict==="review"?"tone-warning":"tone-danger";
  return <>
    <div className="pageIntro"><div><span className="overline">INTELIGENCIA</span><h1>Scoring editorial</h1><p>Un número sin misterio: mide la compatibilidad editorial con dimensiones visibles. No intenta adivinar viralidad ni reemplaza el resultado real después de publicar.</p></div></div>
    <div className="setStack">
      <div className="setSplit even">
        <section className="setCard">
          <div className="setCardTitle"><Sparkles size={18}/><div><h2>Texto a evaluar</h2><p>Prueba borradores antes de mandarlos a la Bandeja editorial.</p></div></div>
          <label className="setField"><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}><option>Frases identificables</option><option>Relaciones</option><option>Nostalgia</option><option>Preguntas</option><option>Humor</option><option>Vida cotidiana</option><option>Motivación ligera</option></select></label>
          <label className="setField"><span>Texto</span><textarea value={text} onChange={e=>setText(e.target.value)}/></label>
          {error&&<div className="setNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
          <button className="uiBtn uiBtnPrimary wide" onClick={evaluate} disabled={busy||!text.trim()}>{busy?<Loader2 className="spin" size={16}/>:<Gauge size={16}/>} Calcular score</button>
        </section>

        <section className="setCard">
          {result?<>
            <div><span className="setScoreLabel">Score editorial</span><div className="setScore"><span className="setScoreValue">{Math.round(Number(result.score||0))}<small>/100</small></span><span className={`statusPill ${verdictTone}`}>{verdictLabel}</span></div></div>
            <div className="setMeters">{dimensions.map(([key,label])=><div className="setMeter" key={key}><div className="setMeterHead"><span>{label}</span><b>{Math.round(Number(result.breakdown?.[key]||0))}</b></div><div className="setMeterTrack"><span style={{width:`${Math.max(0,Math.min(100,Number(result.breakdown?.[key]||0)))}%`}}/></div></div>)}</div>
          </>:<div className="setEmpty"><Gauge size={24}/><strong>Calcula el primer score</strong><span>Verás qué aporta y qué penaliza el texto.</span></div>}
        </section>
      </div>

      {result&&<div className="setSplit even">
        <section className="setCard">
          <div className="setCardTitle"><CheckCircle2 size={18}/><div><h2>Por qué suma</h2><p>Señales positivas detectadas.</p></div></div>
          {result.reasons?.length?<ul className="setList success">{(result.reasons||[]).map((x:string,i:number)=><li key={i}><CheckCircle2 size={16}/>{x}</li>)}</ul>:<div className="setEmpty inset"><span>Sin señales positivas suficientes todavía.</span></div>}
        </section>
        <section className="setCard">
          <div className="setCardTitle"><AlertTriangle size={18}/><div><h2>Qué revisar</h2><p>Penalizaciones o riesgos, no sentencias.</p></div></div>
          {result.warnings?.length?<ul className="setList warning">{(result.warnings||[]).map((x:string,i:number)=><li key={i}><AlertTriangle size={16}/>{x}</li>)}</ul>:<ul className="setList success"><li><ShieldCheck size={16}/>No detectamos advertencias relevantes.</li></ul>}
        </section>
      </div>}

      {result?.nearest?.length>0&&<section className="setCard flush">
        <div className="setCardHead"><div className="setCardTitle"><Search size={18}/><div><h2>Históricos cercanos</h2><p>Explican el score y ayudan a detectar copias accidentales.</p></div></div></div>
        <div className="setRows">{result.nearest.slice(0,6).map((x:any,i:number)=><div className="setRow top" key={i}>
          <div className="setRowMain"><p className="setRowText">{x.text}</p><div className="setMeta"><span>{x.category}</span><span>{Math.round(Number(x.lexicalSimilarity||0)*100)}% coincidencia léxica</span><span>Score histórico {Math.round(Number(x.performanceScore||0))}</span></div></div>
          <span className="statusPill tone-accent">{Math.round(Number(x.similarity||0)*100)}% semántico</span>
        </div>)}</div>
      </section>}
    </div>
  </>;
}
