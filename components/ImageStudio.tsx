"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Image as ImageIcon, Loader2, Palette, Plus, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

type Props={library:any[];onQueue:(item:any)=>void};
const sizes:any={"1:1":[1080,1080],"4:5":[1080,1350],"9:16":[1080,1920]};
const templates:any={"Noche":"#171326|#3a245f","Atardecer":"#4a2131|#d07a61","Papel":"#ece6dc|#c8b9a6","Minimal":"#17191e|#303540"};
function wrap(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){const words=text.split(/\s+/);const lines:string[]=[];let line="";for(const w of words){const test=line?`${line} ${w}`:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);return lines}

export default function ImageStudio({library,onQueue}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null);const [text,setText]=useState(()=>library.find(x=>x.text)?.text||"A veces avanzar también se parece a dejar de insistir.");
  const [aspect,setAspect]=useState("1:1");const [template,setTemplate]=useState("Noche");const [aiBackground,setAiBackground]=useState(false);const [bg,setBg]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");const [dataUrl,setDataUrl]=useState("");
  const suggestions=useMemo(()=>library.filter(x=>x.source==="generated"||x.factoryScore).slice(0,8),[library]);
  useEffect(()=>{void render()},[text,aspect,template,bg]);

  async function render(){const canvas=canvasRef.current;if(!canvas)return;const [w,h]=sizes[aspect];canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");if(!ctx)return;
    const drawText=()=>{const light=template==="Papel";ctx.fillStyle=light?"#181818":"#fffaf2";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`700 ${Math.round(w*.055)}px Arial`;const lines=wrap(ctx,text,w*.76).slice(0,9);const lh=Math.round(w*.073);const total=lines.length*lh;lines.forEach((line,i)=>ctx.fillText(line,w/2,h/2-total/2+i*lh+lh/2,w*.78));ctx.font=`700 ${Math.round(w*.022)}px Arial`;ctx.globalAlpha=.75;ctx.fillText("EFÍMERO",w/2,h*.9);ctx.globalAlpha=1;setDataUrl(canvas.toDataURL("image/png"));};
    if(bg){const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,w,h);ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,w,h);drawText()};img.src=bg;return}
    const [a,b]=templates[template].split("|");const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,a);g.addColorStop(1,b);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let i=0;i<10;i++){ctx.globalAlpha=.04;ctx.beginPath();ctx.arc((i*137)%w,(i*223)%h,90+(i%4)*45,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.fill()}ctx.globalAlpha=1;drawText();}

  async function generateBackground(){setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,aspect,style:`${template}, fotografía/arte editorial emocional, sin texto`})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo generar el fondo.");if(d.imageDataUrl){setBg(d.imageDataUrl);setMessage("Fondo IA generado. El texto exacto se superpone localmente para evitar errores tipográficos.")}else{setMessage(d.message||"Usando fondo local.")}}catch(e:any){setError(e?.message||"No se pudo generar el fondo.")}finally{setBusy(false)}}
  async function addToCalendar(){
    if(!text.trim()||!dataUrl)return;setBusy(true);setError("");setMessage("");
    try{const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});const d=await r.json();const c=d.items?.[0];if(!r.ok||!c)throw new Error(d.error||"No se pudo revisar el texto.");if(c.status!=="pass")throw new Error("La creatividad no puede enviarse al calendario hasta que Compliance Meta marque el texto como aprobado.");const now=new Date();now.setDate(now.getDate()+1);onQueue({id:crypto.randomUUID(),date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`,time:"18:00",category:"Frases identificables",text,format:"Imagen",status:"Aprobado",imageDataUrl:dataUrl,compliance:c});setMessage("Creatividad enviada al calendario como Aprobada.");}
    catch(e:any){setError(e?.message||"No se pudo agregar.")}finally{setBusy(false)}
  }
  function download(){const a=document.createElement("a");a.href=dataUrl;a.download=`efimero-${aspect.replace(":","x")}.png`;a.click()}

  return <>
    <div className="pageIntro"><div><span className="overline">IMÁGENES</span><h1>Estudio de imágenes</h1><p>Texto exacto sobre fondo visual. La IA puede crear el fondo, pero el copy se compone en canvas para conservar cada palabra y evitar errores tipográficos.</p></div></div>
    <div className="setSplit setSplitImage">
      <section className="setCard">
        <div className="setCardTitle"><Palette size={18}/><div><h2>Diseña la creatividad</h2><p>Elige texto, formato y estilo.</p></div></div>
        <label className="setField"><span>Texto</span><textarea value={text} onChange={e=>setText(e.target.value)} rows={6}/></label>
        {suggestions.length>0&&<div className="setField"><span className="setFieldLabel">Desde tu Biblioteca</span><div className="setPickList">{suggestions.map((x:any)=><button type="button" className="setPick" key={x.id} onClick={()=>setText(x.text)} title={x.text}>{x.text.slice(0,72)}{x.text.length>72?"…":""}</button>)}</div></div>}
        <div className="setFields">
          <label className="setField"><span>Formato</span><select value={aspect} onChange={e=>setAspect(e.target.value)}><option>1:1</option><option>4:5</option><option>9:16</option></select></label>
          <label className="setField"><span>Plantilla</span><select value={template} onChange={e=>{setTemplate(e.target.value);setBg(null)}}><option>Noche</option><option>Atardecer</option><option>Papel</option><option>Minimal</option></select></label>
        </div>
        <button className="uiBtn uiBtnSecondary wide" onClick={generateBackground} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<WandSparkles size={16}/>} Generar fondo con IA</button>
        {(message||error)&&<div className={error?"setNotice error":"setNotice success"}>{error?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span>{error||message}</span></div>}
        <div className="setDivider"/>
        <div className="setActions stretch"><button className="uiBtn uiBtnSecondary" onClick={download} disabled={!dataUrl}><Download size={16}/> Descargar PNG</button><button className="uiBtn uiBtnPrimary" onClick={addToCalendar} disabled={busy||!dataUrl}><ShieldCheck size={16}/> Revisar y enviar al calendario</button></div>
      </section>

      <section className="setCard setPreview setSticky">
        <div className="setCardHead"><div className="setCardTitle"><ImageIcon size={18}/><div><h2>Vista previa</h2></div></div><span className="setTag">{aspect} · PNG</span></div>
        <div className={`canvasWrap aspect-${aspect.replace(":","-")}`}><canvas ref={canvasRef}/></div>
        <p className="setHint">El fondo con IA es opcional. El texto siempre se renderiza localmente para conservar la precisión.</p>
      </section>
    </div>
  </>
}
