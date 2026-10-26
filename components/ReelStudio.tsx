"use client";

import { useEffect, useRef, useState } from "react";
import "@fontsource/inter/700.css";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Clapperboard, Download, Film, ImagePlus, Loader2, Mic, Music, Sparkles, Trash2, Video, Wand2, X } from "lucide-react";
import { renderReel, type ReelScene, type ReelTransition } from "@/lib/reelRender";
import { totalDuration } from "@/lib/reelTimeline";
import { TRANSFORM_PRESETS, beforePrompt, transformPrompt } from "@/lib/transformPresets";
import { DEFAULT_HOUSE_STYLE, ROOM_PRESETS, roomImagePrompt, roomMotionPrompt } from "@/lib/walkthroughPresets";
import { useConfirm } from "@/components/ui/DialogProvider";
import StoryStudio from "@/components/StoryStudio";
import DevotionalStudio from "@/components/DevotionalStudio";

type Mode = "walkthrough" | "transform" | "story" | "devotional";
type Job = { statusUrl: string; responseUrl: string; estimatedCost: number };
// Escena del recorrido: puede tener un clip animado con IA; `status` muestra si se está animando.
type Scene = ReelScene & { motion?: string; status?: "animating" | "error"; note?: string };
const VOICES:Array<[string,string]>=[["Kore","Kore · mujer, clara"],["Aoede","Aoede · mujer, cálida"],["Leda","Leda · mujer, joven"],["Charon","Charon · hombre, grave"],["Puck","Puck · hombre, animado"],["Orus","Orus · hombre, firme"]];
const CLIP_COST=.21;

// Corre tareas con un máximo de `limit` a la vez.
async function pool<T>(items:T[],limit:number,task:(item:T)=>Promise<void>){const queue=[...items];await Promise.all(Array.from({length:Math.min(limit,queue.length)},async()=>{while(queue.length)await task(queue.shift() as T)}))}

// La API de video rechaza peticiones de más de 300 KB: se manda una versión reducida de la escena.
async function compressForVideo(dataUrl:string){
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("No se pudo leer la escena."));i.src=dataUrl});
  const c=document.createElement("canvas");c.width=720;c.height=1280;const ctx=c.getContext("2d");if(!ctx)throw new Error("No se pudo procesar la escena.");
  const ratio=Math.max(720/img.width,1280/img.height);const w=img.width*ratio,h=img.height*ratio;ctx.drawImage(img,(720-w)/2,(1280-h)/2,w,h);
  for(let q=.82;q>=.5;q-=.08){const out=c.toDataURL("image/jpeg",q);if(out.length<270_000)return out}
  return c.toDataURL("image/jpeg",.45);
}

// Reduce las imágenes a tamaño de reel: menos peso para el navegador y para enviarlas al servidor.
async function fileToDataUrl(file: File, maxW = 1080, maxH = 1920) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error(`${file.name}: usa JPG, PNG o WebP.`);
  const src = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || "")); r.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`)); r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`${file.name} no es una imagen válida.`)); i.src = src; });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d"); if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .86);
}

export default function ReelStudio(){
  const [mode,setMode]=useState<Mode>("walkthrough");
  const confirm=useConfirm();
  // Recorrido
  const [scenes,setScenes]=useState<Scene[]>([]);const [title,setTitle]=useState("Casa de 6 m de frente ✅");const [music,setMusic]=useState<File|null>(null);const [transition,setTransition]=useState<ReelTransition>("dissolve");
  const [rendering,setRendering]=useState(false);const [paused,setPaused]=useState(false);const [progress,setProgress]=useState(0);const [output,setOutput]=useState<{url:string;type:string}|null>(null);
  const imagesRef=useRef<HTMLInputElement>(null);const musicRef=useRef<HTMLInputElement>(null);
  const [houseStyle,setHouseStyle]=useState(DEFAULT_HOUSE_STYLE);const [rooms,setRooms]=useState<string[]>(ROOM_PRESETS.map(r=>r.id));const [generating,setGenerating]=useState("");
  const [narration,setNarration]=useState("");const [voice,setVoice]=useState("Kore");const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);const [voiceUrl,setVoiceUrl]=useState("");const [voiceBusy,setVoiceBusy]=useState(false);
  // Transformación
  const [presetId,setPresetId]=useState(TRANSFORM_PRESETS[0].id);const [extra,setExtra]=useState("");const [after,setAfter]=useState("");const [before,setBefore]=useState("");const [duration,setDuration]=useState(10);
  const [busy,setBusy]=useState("");const [job,setJob]=useState<Job|null>(null);const [jobState,setJobState]=useState("");const [videoUrl,setVideoUrl]=useState("");
  const afterRef=useRef<HTMLInputElement>(null);const beforeRef=useRef<HTMLInputElement>(null);
  const [error,setError]=useState("");
  const preset=TRANSFORM_PRESETS.find(p=>p.id===presetId);

  useEffect(()=>()=>{if(output)URL.revokeObjectURL(output.url)},[output]);
  useEffect(()=>()=>{if(voiceUrl)URL.revokeObjectURL(voiceUrl)},[voiceUrl]);

  // Genera las imágenes del recorrido (una por espacio) con el mismo estilo de casa.
  async function generateImages(){
    const selected=ROOM_PRESETS.filter(r=>rooms.includes(r.id));if(!selected.length)return;
    if(!await confirm({title:`¿Generar ${selected.length} imágenes con IA?`,description:`Se usará Cheaper Inference (aprox. 0.02 USD por imagen, ${(selected.length*.02).toFixed(2)} USD en total). Se agregan como escenas en el orden de la casa.`,confirmLabel:"Generar imágenes"}))return;
    setError("");setOutput(null);let done=0;const results:Array<Scene|null>=selected.map(()=>null);setGenerating(`0/${selected.length}`);
    await pool(selected.map((room,i)=>({room,i})),3,async({room,i})=>{
      try{const r=await fetch("/api/media/image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:roomImagePrompt(room,houseStyle)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo generar la imagen.");results[i]={image:d.image,caption:room.label,duration:3,motion:room.motion}}
      catch(e:any){setError(`${room.label}: ${e?.message||"no se pudo generar"}`)}
      done++;setGenerating(`${done}/${selected.length}`);
    });
    setScenes(cur=>[...cur,...results.filter((x):x is Scene=>Boolean(x))].slice(0,20));setGenerating("");
  }
  // Anima una escena: la cámara recorre el espacio (clip de 5 s generado con IA).
  async function animateScene(index:number){
    const scene=scenes[index];if(!scene||scene.video)return;
    setScenes(cur=>cur.map((s,k)=>k===index?{...s,status:"animating",note:""}:s));
    try{const image=await compressForVideo(scene.image);const r=await fetch("/api/media/video",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,prompt:roomMotionPrompt(scene.motion||""),duration:5})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo animar la escena.");
      const file=await fetch(d.url);if(!file.ok)throw new Error("No se pudo descargar el clip.");const url=URL.createObjectURL(await file.blob());
      setScenes(cur=>cur.map((s,k)=>k===index?{...s,video:url,duration:5,status:undefined}:s));setOutput(null)}
    catch(e:any){setScenes(cur=>cur.map((s,k)=>k===index?{...s,status:"error",note:e?.message||"Error al animar"}:s))}
  }
  async function animateAll(){
    const pending=scenes.map((s,i)=>({s,i})).filter(x=>!x.s.video&&x.s.status!=="animating");if(!pending.length)return;
    if(!await confirm({title:`¿Animar ${pending.length} escenas con IA?`,description:`Cada escena se convierte en un clip de 5 s con la cámara recorriendo el espacio (aprox. ${CLIP_COST} USD por clip, ${(pending.length*CLIP_COST).toFixed(2)} USD en total). Cada clip tarda de 1 a 4 minutos; se generan 3 a la vez. Deja esta pestaña abierta.`,confirmLabel:"Animar escenas"}))return;
    await pool(pending.map(x=>x.i),3,animateScene);
  }
  async function generateVoice(){
    if(!narration.trim())return;setVoiceBusy(true);setError("");
    try{const r=await fetch("/api/media/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:narration,voice})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"No se pudo generar la voz.")}
      const blob=await r.blob();setVoiceBlob(blob);setVoiceUrl(URL.createObjectURL(blob));setOutput(null)}
    catch(e:any){setError(e?.message||"No se pudo generar la voz.")}finally{setVoiceBusy(false)}
  }
  // Consulta el estado del video cada 8 segundos mientras fal.ai lo genera.
  useEffect(()=>{
    if(!job)return;let stop=false;
    const poll=async()=>{
      try{const r=await fetch(`/api/video/transform?${new URLSearchParams({statusUrl:job.statusUrl,responseUrl:job.responseUrl})}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo consultar el video.");
        if(stop)return;if(d.done){setVideoUrl(d.videoUrl);setJob(null);setJobState("");return}
        setJobState(d.state==="IN_QUEUE"?`En fila${d.position!=null?` (lugar ${d.position+1})`:""}`:"Generando video…");setTimeout(()=>{if(!stop)void poll()},8000);}
      catch(e:any){if(!stop){setError(e?.message||"No se pudo consultar el video.");setJob(null);setJobState("")}}
    };
    void poll();return()=>{stop=true};
  },[job]);

  async function addImages(event:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(event.target.files||[]).sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true}));event.target.value="";if(!files.length)return;setError("");
    try{const added:ReelScene[]=[];for(const f of files.slice(0,20-scenes.length))added.push({image:await fileToDataUrl(f),caption:"",duration:3});setScenes(cur=>[...cur,...added]);setOutput(null)}
    catch(e:any){setError(e?.message||"No se pudieron cargar las imágenes.")}
  }
  function patchScene(i:number,patch:Partial<ReelScene>){setScenes(cur=>cur.map((s,k)=>k===i?{...s,...patch}:s));setOutput(null)}
  function moveScene(i:number,dir:-1|1){setScenes(cur=>{const next=[...cur];const j=i+dir;if(j<0||j>=next.length)return cur;[next[i],next[j]]=[next[j],next[i]];return next});setOutput(null)}
  async function render(){
    setRendering(true);setProgress(0);setError("");setOutput(null);
    try{const {blob,type}=await renderReel(scenes,{title,music,voice:voiceBlob,transition,onPauseChange:setPaused},setProgress);setOutput({url:URL.createObjectURL(blob),type})}
    catch(e:any){setError(e?.message||"No se pudo generar el reel.")}finally{setRendering(false)}
  }

  async function pickTransformImage(event:React.ChangeEvent<HTMLInputElement>,which:"after"|"before"){
    const f=event.target.files?.[0];event.target.value="";if(!f)return;setError("");
    try{const data=await fileToDataUrl(f);if(which==="after"){setAfter(data);setBefore("")}else setBefore(data);setVideoUrl("")}catch(e:any){setError(e?.message||"No se pudo cargar la imagen.")}
  }
  async function makeBefore(){
    if(!after)return;
    if(!await confirm({title:"¿Crear la imagen de antes con IA?",description:"Se usará fal.ai para quitar los acabados del diseño y dejar el espacio sin terminar, con el mismo ángulo de cámara. Cuesta alrededor de 0.04 USD.",confirmLabel:"Crear imagen"}))return;
    setBusy("before");setError("");
    try{const r=await fetch("/api/video/before",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:after,prompt:beforePrompt(preset,extra)})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo crear la imagen.");setBefore(d.image);setVideoUrl("")}
    catch(e:any){setError(e?.message||"No se pudo crear la imagen.")}finally{setBusy("")}
  }
  async function makeVideo(){
    if(!after||!before)return;
    if(!await confirm({title:"¿Generar el video de transformación?",description:`Se enviarán las dos imágenes a fal.ai para crear un video de ${duration} segundos sin audio. Cuesta aproximadamente ${(duration*.112).toFixed(2)} USD con el modelo configurado y tarda de 2 a 8 minutos.`,confirmLabel:"Generar video"}))return;
    setBusy("video");setError("");setVideoUrl("");
    try{const r=await fetch("/api/video/transform",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startImage:before,endImage:after,prompt:transformPrompt(preset,extra),duration})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo enviar el video.");setJob(d);setJobState("En fila")}
    catch(e:any){setError(e?.message||"No se pudo enviar el video.")}finally{setBusy("")}
  }

  const seconds=totalDuration(scenes.map(s=>Math.max(1.5,s.duration)));
  const extension=output?.type.includes("mp4")?"mp4":"webm";

  return <div className="reelStudio">
    <div className="pageIntro"><div><span className="overline">REELS</span><h1>Estudio de reels</h1><p>Recorridos de casas con movimiento suave a partir de tus imágenes, y transformaciones de antes y después con video generado por IA.</p></div></div>
    <div className="segmented reelModes" role="tablist" aria-label="Tipo de reel"><button type="button" role="tab" aria-selected={mode==="walkthrough"} className={mode==="walkthrough"?"active":""} onClick={()=>setMode("walkthrough")}><Film size={15}/> Recorrido</button><button type="button" role="tab" aria-selected={mode==="transform"} className={mode==="transform"?"active":""} onClick={()=>setMode("transform")}><Wand2 size={15}/> Transformación</button><button type="button" role="tab" aria-selected={mode==="story"} className={mode==="story"?"active":""} onClick={()=>setMode("story")}><Clapperboard size={15}/> Historia</button><button type="button" role="tab" aria-selected={mode==="devotional"} className={mode==="devotional"?"active":""} onClick={()=>setMode("devotional")}><Sparkles size={15}/> Oración devocional</button></div>
    {error&&<div className="quickNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}

    {mode==="story"?<StoryStudio/>:mode==="devotional"?<DevotionalStudio/>:mode==="walkthrough"?<div className="reelGrid">
      <section className="calPanel">
        <div className="adsHead"><div><h2>Escenas</h2><p>Sube las imágenes del recorrido en orden: fachada, entrada, sala, cocina… Cada una se anima con un acercamiento suave.</p></div><span className="statusPill tone-neutral">{scenes.length} · {seconds.toFixed(1)} s</span></div>
        <input ref={imagesRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>void addImages(e)}/>
        <details className="reelAi" open={!scenes.length}>
          <summary><Sparkles size={15}/> Crear las imágenes con IA</summary>
          <label className="field"><span>Estilo de la casa <small>en inglés; se repite en todas las imágenes para que parezcan la misma casa</small></span><textarea rows={3} value={houseStyle} onChange={e=>setHouseStyle(e.target.value)}/></label>
          <div className="field"><span>Espacios del recorrido, en orden</span><div className="adsCountries">{ROOM_PRESETS.map(r=><button type="button" key={r.id} className={rooms.includes(r.id)?"active":""} aria-pressed={rooms.includes(r.id)} onClick={()=>setRooms(cur=>cur.includes(r.id)?cur.filter(x=>x!==r.id):ROOM_PRESETS.map(x=>x.id).filter(x=>cur.includes(x)||x===r.id))}>{r.label}</button>)}</div></div>
          <button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void generateImages()} disabled={!!generating||!rooms.length||rendering}>{generating?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} {generating?`Generando ${generating}…`:`Generar ${rooms.length} imágenes`}</button>
        </details>
        <label className="field"><span>Texto inicial (los primeros 3 segundos)</span><input value={title} maxLength={80} onChange={e=>{setTitle(e.target.value);setOutput(null)}} placeholder="Casa de 6 m de frente ✅"/></label>
        {scenes.length?<ol className="reelScenes">{scenes.map((s,i)=><li key={i}>
          <img src={s.image} alt={`Escena ${i+1}`}/>
          <div className="reelSceneFields">{s.video?<span className="studioChip ok"><Check size={12}/> Recorrido animado</span>:s.status==="animating"?<span className="studioChip"><Loader2 className="spin" size={12}/> Animando… (1 a 4 min)</span>:s.status==="error"?<span className="studioChip error" title={s.note}><AlertTriangle size={12}/> {s.note||"Error"}</span>:null}<input value={s.caption} maxLength={70} placeholder={`Texto de la escena ${i+1} (opcional)`} onChange={e=>patchScene(i,{caption:e.target.value})}/><label><span>Duración</span><select value={s.duration} onChange={e=>patchScene(i,{duration:Number(e.target.value)})}>{(s.video?[3,4,5]:[2,2.5,3,4,5]).map(n=><option key={n} value={n}>{n} s</option>)}</select></label></div>
          <div className="reelSceneActions">{!s.video&&<button type="button" className="uiIconBtn" onClick={()=>void animateScene(i)} disabled={s.status==="animating"||rendering} title="Animar con IA" aria-label="Animar con IA"><Video size={15}/></button>}<button type="button" className="uiIconBtn" onClick={()=>moveScene(i,-1)} disabled={i===0} aria-label="Subir"><ArrowUp size={15}/></button><button type="button" className="uiIconBtn" onClick={()=>moveScene(i,1)} disabled={i===scenes.length-1} aria-label="Bajar"><ArrowDown size={15}/></button><button type="button" className="uiIconBtn" onClick={()=>{setScenes(cur=>cur.filter((_,k)=>k!==i));setOutput(null)}} aria-label="Quitar"><Trash2 size={15}/></button></div>
        </li>)}</ol>:<button type="button" className="reelDrop" onClick={()=>imagesRef.current?.click()}><ImagePlus size={22}/><strong>Subir imágenes del recorrido</strong><span>De 4 a 10 imágenes verticales de la misma casa. Hasta 20.</span></button>}
        <div className="reelToolbar">
          {!!scenes.length&&<button type="button" className="uiBtn uiBtnSecondary" onClick={()=>imagesRef.current?.click()} disabled={rendering||scenes.length>=20}><ImagePlus size={16}/> Agregar imágenes</button>}
          {scenes.some(s=>!s.video)&&<button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void animateAll()} disabled={rendering||scenes.some(s=>s.status==="animating")}><Video size={16}/> Animar recorrido con IA ({scenes.filter(s=>!s.video).length})</button>}
          <input ref={musicRef} type="file" accept="audio/*" hidden onChange={e=>{setMusic(e.target.files?.[0]||null);e.target.value="";setOutput(null)}}/>
          <button type="button" className="uiBtn uiBtnSecondary" onClick={()=>musicRef.current?.click()} disabled={rendering}><Music size={16}/> {music?"Cambiar música":"Agregar música"}</button>
          {music&&<span className="reelMusic">{music.name}<button type="button" className="uiIconBtn" onClick={()=>{setMusic(null);setOutput(null)}} aria-label="Quitar música"><X size={14}/></button></span>}
        </div>
        <div className="reelVoice">
          <label className="field"><span><Mic size={14}/> Voz en off <small>opcional</small></span><textarea rows={3} maxLength={1500} value={narration} onChange={e=>{setNarration(e.target.value);setVoiceBlob(null);setVoiceUrl("")}} placeholder="Esta casa tiene solo 6 metros de frente, pero mira todo lo que cabe adentro…"/></label>
          <div className="reelToolbar"><select aria-label="Voz" value={voice} onChange={e=>{setVoice(e.target.value);setVoiceBlob(null);setVoiceUrl("")}}>{VOICES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void generateVoice()} disabled={!narration.trim()||voiceBusy||rendering}>{voiceBusy?<Loader2 className="spin" size={16}/>:<Mic size={16}/>} Generar voz</button>{voiceUrl&&<audio src={voiceUrl} controls/>}</div>
        </div>
        <label className="field"><span>Transición</span><select value={transition} onChange={e =>{ setTransition(e.target.value as ReelTransition); setOutput(null); }}><option value="dissolve">Disolución suave (recomendada)</option><option value="black">Fundido a negro (dramática)</option><option value="cut">Corte directo</option></select></label>
        <p className="settingsHint">Usa música libre de derechos (por ejemplo, la biblioteca de audio de YouTube o Pixabay Music). Mientras se genera, deja esta pestaña abierta y visible.</p>
        <div className="actionBar reelActions"><button type="button" className="uiBtn uiBtnPrimary" onClick={()=>void render()} disabled={!scenes.length||rendering}>{rendering?<Loader2 className="spin" size={16}/>:<Clapperboard size={16}/>} {rendering?paused?"En pausa: regresa a esta pestaña":`Generando… ${Math.round(progress*100)}%`:"Generar reel"}</button></div>
      </section>
      <section className="calPanel reelPreview">
        <div className="adsHead"><div><h2>Resultado</h2><p>Video vertical 1080×1920 listo para subir como reel.</p></div></div>
        {output?<><video src={output.url} controls playsInline/><a className="uiBtn uiBtnPrimary" href={output.url} download={`recorrido.${extension}`}><Download size={16}/> Descargar video</a>{extension==="webm"&&<p className="settingsHint">Tu navegador generó WebM. Facebook lo acepta; si prefieres MP4, usa Chrome actualizado.</p>}</>:<div className="reelEmpty"><Film size={22}/><span>{rendering?"Grabando el reel en tiempo real…":"Aquí aparecerá tu reel."}</span></div>}
      </section>
    </div>:<div className="reelGrid">
      <section className="calPanel">
        <div className="adsHead"><div><h2>Transformación con IA</h2><p>Sube el diseño terminado; la IA crea cómo se veía antes y genera el video de la obra entre las dos imágenes.</p></div></div>
        <div className="field"><span>Tipo de transformación</span><div className="adsCountries">{TRANSFORM_PRESETS.map(p=><button type="button" key={p.id} className={presetId===p.id?"active":""} onClick={()=>setPresetId(p.id)} aria-pressed={presetId===p.id}>{p.label}</button>)}</div></div>
        <label className="field"><span>Detalles extra en inglés <small>opcional</small></span><input value={extra} onChange={e=>setExtra(e.target.value)} placeholder="e.g. white marble with gold veins, walnut slats"/></label>
        <input ref={afterRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void pickTransformImage(e,"after")}/>
        <input ref={beforeRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void pickTransformImage(e,"before")}/>
        <div className="reelPair">
          <figure><figcaption>1. Antes</figcaption>{before?<img src={before} alt="Antes"/>:<div className="reelSlot">{after?"Créala con IA o súbela":"Primero sube el después"}</div>}<div className="reelPairActions"><button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void makeBefore()} disabled={!after||!!busy||!!job}>{busy==="before"?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Crear con IA</button><button type="button" className="linkButton" onClick={()=>beforeRef.current?.click()} disabled={!!busy||!!job}>Subir mía</button></div></figure>
          <figure><figcaption>2. Después (diseño terminado)</figcaption>{after?<img src={after} alt="Después"/>:<button type="button" className="reelSlot" onClick={()=>afterRef.current?.click()}><ImagePlus size={20}/> Subir diseño</button>}{after&&<div className="reelPairActions"><button type="button" className="linkButton" onClick={()=>afterRef.current?.click()} disabled={!!busy||!!job}>Cambiar</button></div>}</figure>
        </div>
        <div className="fieldRow"><label className="field"><span>Duración del video</span><select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={5}>5 segundos</option><option value={10}>10 segundos</option></select></label><div className="field"><span>Costo aproximado</span><div className="reelCost">≈ {(duration*.112).toFixed(2)} USD por video</div></div></div>
        <div className="actionBar reelActions"><button type="button" className="uiBtn uiBtnPrimary" onClick={()=>void makeVideo()} disabled={!after||!before||!!busy||!!job}>{busy==="video"||job?<Loader2 className="spin" size={16}/>:<Wand2 size={16}/>} {job?jobState||"Generando…":"Generar transformación"}</button></div>
      </section>
      <section className="calPanel reelPreview">
        <div className="adsHead"><div><h2>Video</h2><p>Sin audio: agrégale música al subirlo o en el recorrido.</p></div></div>
        {videoUrl?<><video src={videoUrl} controls playsInline/><a className="uiBtn uiBtnPrimary" href={videoUrl} target="_blank" rel="noreferrer" download><Download size={16}/> Descargar video</a><p className="settingsHint">El enlace de fal.ai es temporal: descárgalo hoy.</p></>:<div className="reelEmpty"><Wand2 size={22}/><span>{job?`${jobState||"Generando…"} Suele tardar de 2 a 8 minutos.`:"Aquí aparecerá el video de la transformación."}</span></div>}
      </section>
    </div>}
  </div>;
}
