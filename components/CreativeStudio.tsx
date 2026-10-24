"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Church, Download, FileArchive, Image as ImageIcon, Loader2, Palette, ShieldCheck, Trash2, Type, Upload, WandSparkles } from "lucide-react";
import { CREATIVE_DIMENSIONS, drawCreative, splitCreativeBatch, type CreativeAspect, type CreativeBrand, type CreativeContent, type CreativeKind, type CreativeQueueItem } from "@/lib/creativeStudio";
import { imagesToZip } from "@/lib/browserZip";
import { formatPageLabel } from "@/lib/pageLabels";
import { loadSaintArts, saveSaintArt, removeSaintArt } from "@/lib/creativeArtStore";
import { useConfirm } from "@/components/ui/DialogProvider";

type Page={id:string;name:string;followers_count?:number|null;fan_count?:number|null};
type Props={pages:Page[];pageId:string;onChoosePage:(id:string)=>void;onSendToBulk:(items:CreativeQueueItem[])=>void};
type Generated=CreativeQueueItem & {label:string;artMissing?:boolean};
const defaults:CreativeContent={kind:"prayer",saint:"San Benito",intention:"protección y paz",title:"Oración de la noche",body:"Señor, acompaña mis pasos con serenidad. Ayúdame a trabajar con honestidad y a cuidar de quienes amo. Que hoy encuentre fortaleza en la esperanza y gratitud en lo sencillo. Amén."};
const maxBatch=12;
const saintKey=(value:string)=>value.trim().toLocaleLowerCase("es-MX");
const newBrand=(name:string):CreativeBrand=>({name,handle:"",avatar:"",logo:"",accent:"#ae813f"});
function saveFile(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function prepareImage(file:File,maxDim=1700,keepTransparency=false){
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error("Usa una imagen JPG, PNG o WebP.");
  if(file.size>12*1024*1024)throw new Error("La imagen supera 12 MB. Reduce su tamaño.");
  const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("No se pudo leer la imagen."));r.readAsDataURL(file)});
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("Archivo de imagen no válido."));i.src=src});
  const scale=Math.min(1,maxDim/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Error al procesar la imagen.");ctx.drawImage(img,0,0,canvas.width,canvas.height);return keepTransparency?canvas.toDataURL("image/png"):canvas.toDataURL("image/jpeg",.88);
}
const humanFile=(name:string,i:number)=>`${name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"efimero"}-${String(i+1).padStart(2,"0")}.jpg`;

export default function CreativeStudio({pages,pageId,onChoosePage,onSendToBulk}:Props){
 const [kind,setKind]=useState<CreativeKind>("prayer"); const [aspect,setAspect]=useState<CreativeAspect>("1:1");const [content,setContent]=useState<CreativeContent>(defaults);
 const [brand,setBrand]=useState<CreativeBrand>(newBrand("Tu página"));const [art,setArt]=useState("");const [artBySaint,setArtBySaint]=useState<Record<string,string>>({});const [autoSaintArt,setAutoSaintArt]=useState(false);const [batch,setBatch]=useState("");
 const [preview,setPreview]=useState("");const [renderError,setRenderError]=useState("");const [generated,setGenerated]=useState<Generated[]>([]);
 const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");const [loadedPage,setLoadedPage]=useState<string|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null);const artRef=useRef<HTMLInputElement>(null);const avatarRef=useRef<HTMLInputElement>(null);const logoRef=useRef<HTMLInputElement>(null);
 const confirm=useConfirm();
 const currentPage=pages.find(p=>p.id===pageId);
 const draftCount=useMemo(()=>batch.trim()?splitCreativeBatch(batch,kind,{...content,kind}).length:1,[batch,kind,content]);
 function change(patch:Partial<CreativeContent>){setContent(cur=>({...cur,...patch}));setGenerated([])}
 function updateBrand(patch:Partial<CreativeBrand>){setBrand(cur=>({...cur,...patch}));setGenerated([])}
 useEffect(()=>{
   const name=currentPage?.name||"Tu página";let b=newBrand(name);let savedKind:CreativeKind="prayer";
   try{const stored=pageId&&localStorage.getItem(`efimero:creative:v1.9:${pageId}`);if(stored){const data=JSON.parse(stored);if(data?.brand&&typeof data.brand==="object")b={...b,...data.brand,name:String(data.brand.name||name)};if(["prayer","minimal"].includes(data?.kind))savedKind=data.kind;}}catch{/* Prefer fresh defaults for invalid local preferences. */}
   setBrand(b);setKind(savedKind);setArt("");setArtBySaint({});setGenerated([]);setLoadedPage(pageId||"");setError("");setNotice("");
 },[pageId,currentPage?.name]);
 useEffect(()=>{if(!pageId)return;let cancelled=false;loadSaintArts(pageId).then(arts=>{if(!cancelled){setArtBySaint(arts);setArt(arts[saintKey(content.saint)]||"");}}).catch(()=>{/* IndexedDB is optional. The in-memory artwork will still work. */});return()=>{cancelled=true};},[pageId]);
 useEffect(()=>{if(loadedPage!==pageId||!pageId)return;try{localStorage.setItem(`efimero:creative:v1.9:${pageId}`,JSON.stringify({brand,kind}));}catch{setNotice("No se pudo guardar la identidad en este navegador. Comprueba el espacio disponible.");}},[brand,kind,pageId,loadedPage]);
 useEffect(()=>{let active=true;const node=canvas.current;if(!node)return;void drawCreative(node,{...content,kind},brand,{art},aspect).then(x=>{if(!active)return;setPreview(x.dataUrl);setRenderError(x.error||"")}).catch(e=>{if(active){setPreview("");setRenderError(e?.message||"Error de composición.")}});return()=>{active=false}},[content,kind,brand,art,aspect]);
 async function pickImage(event:React.ChangeEvent<HTMLInputElement>,destination:"art"|"avatar"|"logo"){
   const f=event.target.files?.[0];event.target.value="";if(!f)return;setBusy("upload");setError("");
   try{const data=await prepareImage(f,destination==="art"?1700:300,destination!=="art");if(destination==="art"){setArt(data);setArtBySaint(prev=>({...prev,[saintKey(content.saint)]:data}));if(pageId)await saveSaintArt(pageId,content.saint,data).catch(()=>setNotice("El arte está disponible durante esta sesión, pero no pudo guardarse en la biblioteca local."));}else updateBrand({[destination]:data});setGenerated([]);setNotice("Imagen cargada. La identidad y los textos se componen sin IA.");}
   catch(e:any){setError(e?.message||"No se pudo cargar el archivo.")}finally{setBusy("")}
 }
 async function makeArt(){
   if(kind!=="prayer")return;
   if(!await confirm({title:"¿Generar la ilustración?",description:`Se hará una solicitud a la API de imágenes configurada y puede generar un costo.\nSanto: ${content.saint}. Solo la ilustración, sin texto.`,confirmLabel:"Generar"}))return;
   setBusy("ai");setError("");setNotice("");
   try{const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"saint-art",saint:content.saint,intention:content.intention,aspect,style:"pintura religiosa clásica al óleo, cálida, detallada, campo rural, luz celestial suave, ilustración artística original sin letras"})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Falló la generación.");if(!data.imageDataUrl)throw new Error(data.message||"No hay API de imágenes configurada. Puedes subir una ilustración propia.");setArt(data.imageDataUrl);setArtBySaint(prev=>({...prev,[saintKey(content.saint)]:data.imageDataUrl}));if(pageId)await saveSaintArt(pageId,content.saint,data.imageDataUrl).catch(()=>setNotice("No se pudo guardar la ilustración localmente."));setGenerated([]);setNotice("Ilustración creada. El texto, los márgenes y la marca se añaden después mediante plantilla.");}
   catch(e:any){setError(e?.message||"No se pudo generar la ilustración.")}finally{setBusy("")}
 }
 async function generateAll(){
   if(!pageId){setError("Selecciona la página de Facebook antes de preparar un lote.");return;}
   const contents=batch.trim()?splitCreativeBatch(batch,kind,{...content,kind}):[{...content,kind}];
   if(!contents.length){setError("Escribe contenido para el lote.");return;}
   if(contents.length>maxBatch){setError(`Máximo ${maxBatch} creatividades por lote.`);return;}
   const saints=Array.from(new Map(contents.filter(x=>kind==="prayer").map(x=>[saintKey(x.saint),x.saint])).values());
   const unavailable=saints.filter(x=>!artBySaint[saintKey(x)]&&!(saintKey(x)===saintKey(content.saint)&&art));
   if(unavailable.length&&!autoSaintArt&&!await confirm({title:"Faltan ilustraciones",description:`Sin ilustración: ${unavailable.join(", ")}.\nSe crearán borradores con marcador de posición, que NO se podrán enviar a programación.`,confirmLabel:"Continuar"}))return;
   if(unavailable.length&&autoSaintArt&&!await confirm({title:`¿Generar ${unavailable.length} ilustraciones?`,description:`Se harán ${unavailable.length} solicitudes de imagen con costo a la API configurada, una por santo sin ilustración: ${unavailable.join(", ")}.`,confirmLabel:"Generar"}))return;
   setBusy("batch");setGenerated([]);setError("");setNotice("");
   try{
     const arts={...artBySaint};if(kind==="prayer"&&art)arts[saintKey(content.saint)]=art;
     if(kind==="prayer"&&autoSaintArt){
       for(const saint of unavailable){
         const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"saint-art",saint,aspect,style:"pintura religiosa clásica original al óleo, dorados, tradición devocional, sin letras ni marcas"})});
         const d=await r.json();if(!r.ok||!d.imageDataUrl)throw new Error(d.error||d.message||`No se pudo generar la ilustración de ${saint}.`);
         arts[saintKey(saint)]=d.imageDataUrl;
         await saveSaintArt(pageId,saint,d.imageDataUrl).catch(()=>{/* Keep art in memory if browser storage is unavailable. */});
       }
       setArtBySaint(arts);
       if(arts[saintKey(content.saint)])setArt(arts[saintKey(content.saint)]);
     }
     const prepared:Generated[]=[];for(let i=0;i<contents.length;i++){
     const item=contents[i];const temp=document.createElement("canvas");const pieceArt=kind==="prayer"?(arts[saintKey(item.saint)]||""):"";const result=await drawCreative(temp,item,brand,{art:pieceArt},aspect);
     if(result.error)throw new Error(`Imagen ${i+1}: ${result.error}`);
     const label=kind==="prayer"?`${item.saint} · ${item.intention}`:item.title;
     prepared.push({id:crypto.randomUUID(),label,artMissing:kind==="prayer"&&!pieceArt,fileName:humanFile(kind==="prayer"?item.saint:item.title,i),dataUrl:result.dataUrl,sourceText:kind==="prayer"?`Oración a ${item.saint} por ${item.intention}. ${item.body}`:`${item.title}. ${item.body}`,pageId,caption:""});
   }setGenerated(prepared);setNotice(`${prepared.length} creatividades listas. Revisa las imágenes antes de descargarlas o programarlas.`);}
   catch(e:any){setError(e?.message||"No se pudo generar el lote.")}finally{setBusy("")}
 }
 function downloadPreview(){if(!preview)return;fetch(preview).then(r=>r.blob()).then(b=>saveFile(b,"efimero-vista-previa.jpg"));}
 async function downloadZip(){if(!generated.length)return;setBusy("zip");setError("");try{saveFile(imagesToZip(generated.map(x=>({name:x.fileName,dataUrl:x.dataUrl}))),`efimero-creatividades-${pageId||"local"}.zip`);}catch(e:any){setError(e?.message||"No se pudo crear el ZIP.")}finally{setBusy("")}}
 async function sendToBulk(){
   if(!pageId||!generated.length){setError("Genera un lote y selecciona una página antes de programar.");return;}
   if(generated.some(x=>x.pageId!==pageId)){setError("El lote pertenece a otra página. Regénéralo con la página actual.");return;}
   if(generated.some(x=>x.artMissing)){setError("Algunas oraciones siguen sin ilustración del santo correspondiente. Sube o genera un arte por santo y vuelve a preparar el lote.");return;}
   setBusy("review");setError("");setNotice("");
   try{const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:generated.map(x=>x.sourceText)})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Falló la revisión.");
     const rejected=(data.items||[]).map((x:any,i:number)=>({...x,index:i+1})).filter((x:any)=>x.status!=="pass");
     if(rejected.length)throw new Error(`Compliance requiere revisar ${rejected.length} imagen(es): ${rejected.map((x:any)=>`#${x.index} ${x.status}`).join(", ")}. Corrige el texto y vuelve a generar el lote. Las imágenes no se alterarán silenciosamente.`);
     onSendToBulk(generated.map(({id,fileName,dataUrl,sourceText,pageId,caption})=>({id,fileName,dataUrl,sourceText,pageId,caption})));
   }catch(e:any){setError(e?.message||"No se pudo revisar el contenido.")}finally{setBusy("")}
 }
 const [width,height]=CREATIVE_DIMENSIONS[aspect];
 const aspectOptions:Array<[CreativeAspect,string]>=[["1:1","Cuadrado · 1:1"],["4:5","Vertical · 4:5"],["9:16","Historia · 9:16"]];
 return <div className="studioPage">
   <div className="pageIntro"><div><span className="overline">ESTUDIO CREATIVO</span><h1>Estudio creativo</h1><p>Plantillas con la identidad fija de tu página: el texto y la marca se componen exactos y la ilustración con IA es opcional. Antes de programar, cada pieza pasa por la revisión de Meta.</p></div><span className="timezoneBadge"><Palette size={16}/> {width} × {height}</span></div>
   <div className="studioTwoCol studioCreativeGrid">
     <div className="studioStack">
       <section className="studioCard">
         <div className="studioCardHead"><div><span className="studioStepLabel">Paso 1</span><h2>Plantilla e identidad</h2><p>La marca se guarda por página en este navegador.</p></div></div>
         <div className="studioOptionGrid" role="group" aria-label="Plantilla">
           <button type="button" className={kind==="prayer"?"studioOption active":"studioOption"} aria-pressed={kind==="prayer"} onClick={()=>{setKind("prayer");setAspect("1:1");setGenerated([])}}><span className="studioOptionIcon"><Church size={18}/></span><span className="studioOptionText"><strong>Oración de santo</strong><small>Ilustración, marco y oración</small></span></button>
           <button type="button" className={kind==="minimal"?"studioOption active":"studioOption"} aria-pressed={kind==="minimal"} onClick={()=>{setKind("minimal");setAspect("4:5");setGenerated([])}}><span className="studioOptionIcon"><Type size={18}/></span><span className="studioOptionText"><strong>Texto minimalista</strong><small>Avatar, nombre y @usuario fijos</small></span></button>
         </div>
         <label><span>Página de Facebook</span><select value={pageId} onChange={e=>onChoosePage(e.target.value)}><option value="">Selecciona una página</option>{pages.map(p=><option key={p.id} value={p.id}>{formatPageLabel(p)}</option>)}</select></label>
         <div className="fieldRow"><label><span>Nombre en la imagen</span><input value={brand.name} onChange={e=>updateBrand({name:e.target.value})} maxLength={80}/></label><label><span>@usuario <small>opcional</small></span><input value={brand.handle} placeholder="@tupagina" onChange={e=>updateBrand({handle:e.target.value})} maxLength={70}/></label></div>
         <div className="studioUploadRow">
           {kind==="minimal"?<><input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void pickImage(e,"avatar")}/><button className="uiBtn uiBtnSecondary" onClick={()=>avatarRef.current?.click()}><Upload size={16}/> {brand.avatar?"Cambiar avatar":"Subir avatar de la página"}</button>{brand.avatar&&<span className="studioUploadState"><Check size={14}/> Avatar cargado</span>}</>:<><input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void pickImage(e,"logo")}/><button className="uiBtn uiBtnSecondary" onClick={()=>logoRef.current?.click()}><Upload size={16}/> {brand.logo?"Cambiar logo":"Subir logo"}</button>{brand.logo?<span className="studioUploadState"><Check size={14}/> Logo cargado</span>:<span className="studioHint">Opcional</span>}</>}
         </div>
       </section>

       <section className="studioCard">
         <div className="studioCardHead"><div><span className="studioStepLabel">Paso 2</span><h2>Contenido de la pieza</h2><p>Solo cambian estos campos entre publicaciones.</p></div></div>
         <div className="studioField"><span>Formato</span><div className="segmented studioSegmented" role="group" aria-label="Formato">{aspectOptions.map(([value,label])=><button type="button" key={value} className={aspect===value?"active":""} onClick={()=>{setAspect(value);setGenerated([])}}>{label}</button>)}</div></div>
         {kind==="prayer"?<div className="fieldRow"><label><span>Santo o advocación</span><input value={content.saint} onChange={e=>{change({saint:e.target.value});setArt(artBySaint[saintKey(e.target.value)]||"")}}/></label><label><span>Intención</span><input value={content.intention} onChange={e=>change({intention:e.target.value})} placeholder="Por el trabajo y la bendición"/></label></div>:<label><span>Título</span><input value={content.title} onChange={e=>change({title:e.target.value})}/></label>}
         <label><span>{kind==="prayer"?"Oración":"Texto principal"}</span><textarea value={content.body} rows={7} onChange={e=>change({body:e.target.value})}/></label>
         {kind==="prayer"&&<div className="studioSubsection">
           <div className="studioSubsectionHead"><strong>Ilustración del santo</strong><span>La IA crea solo arte original sin texto. Se guarda en este navegador por página y santo.</span></div>
           <input ref={artRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void pickImage(e,"art")}/>
           <div className="studioUploadRow">
             <button className="uiBtn uiBtnSecondary" onClick={()=>artRef.current?.click()}><Upload size={16}/> {art?"Cambiar ilustración":"Subir ilustración"}</button>
             <button className="uiBtn uiBtnSecondary" onClick={()=>void makeArt()} disabled={!!busy}>{busy==="ai"?<Loader2 size={16} className="spin"/>:<WandSparkles size={16}/>} {busy==="ai"?"Generando ilustración…":"Generar con IA"}</button>
             {art&&<button className="uiBtn uiBtnGhost" onClick={()=>{setArt("");setArtBySaint(prev=>{const next={...prev};delete next[saintKey(content.saint)];return next});if(pageId)void removeSaintArt(pageId,content.saint);setGenerated([])}}><Trash2 size={16}/> Quitar arte</button>}
           </div>
         </div>}
       </section>

       <section className="studioCard">
         <div className="studioCardHead"><div><span className="studioStepLabel">Paso 3</span><h2>Preparar un lote</h2><p>Déjalo vacío para usar la pieza actual, o separa publicaciones con una línea de tres guiones (---).</p></div></div>
         <label><span>{kind==="prayer"?"Un bloque por pieza: Santo | Intención y oración":"Un bloque por pieza: Título | texto"}</span><textarea className="studioMono" rows={8} value={batch} onChange={e=>{setBatch(e.target.value);setGenerated([])}} placeholder={kind==="prayer"?"San Benito | Protección\nSeñor, acompáñame... Amén.\n---\nSan Judas Tadeo | Esperanza\nQue tu intercesión... Amén.":"Oración de la noche | Señor, dejo en tus manos este día...\n---\nReflexión para hoy | Hay momentos que..."}/><small>Hasta {maxBatch} imágenes por lote.</small></label>
         {kind==="prayer"&&<label className="studioCheckRow"><input type="checkbox" checked={autoSaintArt} onChange={e=>setAutoSaintArt(e.target.checked)}/><div><strong>Generar con IA las ilustraciones que falten</strong><small>Una solicitud con costo por cada santo sin ilustración.</small></div></label>}
         <div className="studioCardFooter"><span className="studioHint">{draftCount} {draftCount===1?"pieza prevista":"piezas previstas"}</span><button className={generated.length?"uiBtn uiBtnSecondary":"uiBtn uiBtnPrimary"} onClick={()=>void generateAll()} disabled={!!busy||!pageId||(!content.body.trim()&&!batch.trim())}>{busy==="batch"?<Loader2 size={16} className="spin"/>:<ImageIcon size={16}/>} Generar {batch.trim()?"lote":"pieza"}</button></div>
       </section>
     </div>

     <section className="studioCard studioSticky studioPreviewCard">
       <div className="studioCardHead"><div><h2>Vista previa</h2><p>La imagen final, renderizada en tu navegador.</p></div><span className="statusPill tone-neutral">{aspect}</span></div>
       <div className="studioCanvas"><canvas ref={canvas} aria-label="Vista previa de la publicación"/></div>
       {renderError&&<div className="studioNotice error"><AlertTriangle size={16}/><span>{renderError}</span></div>}
       <div className="studioPreviewActions">
         <button className="uiBtn uiBtnSecondary" onClick={downloadPreview} disabled={!preview||!!renderError}><Download size={16}/> Descargar JPG</button>
         <p className="studioNote"><ShieldCheck size={14}/><span>La IA no dibuja tu marca ni el texto: se mantienen exactos en todas las piezas.</span></p>
       </div>
       {!!generated.length&&<div className="studioBatch">
         <div className="studioBatchHead"><div><strong>Lote listo · {generated.length} {generated.length===1?"imagen":"imágenes"}</strong><span>Meta revisa el texto antes de programar.</span></div></div>
         <div className="studioGallery">{generated.map((x,i)=><figure key={x.id} className={x.artMissing?"missing":""}><img src={x.dataUrl} alt={`Creatividad ${i+1}: ${x.label}`}/><figcaption>{i+1}. {x.label}{x.artMissing&&<b> · Falta arte</b>}</figcaption></figure>)}</div>
         <div className="studioBatchActions"><button className="uiBtn uiBtnSecondary" onClick={()=>void downloadZip()} disabled={!!busy}><FileArchive size={16}/> Descargar ZIP</button><button className="uiBtn uiBtnPrimary" onClick={()=>void sendToBulk()} disabled={!!busy}>{busy==="review"?<Loader2 size={16} className="spin"/>:<CalendarClock size={16}/>} {busy==="review"?"Revisando…":"Revisar y programar"}</button></div>
       </div>}
       {(notice||error)&&<div className={error?"studioNotice error":"studioNotice success"}>{error?<AlertTriangle size={16}/>:<Check size={16}/>}<span>{error||notice}</span></div>}
     </section>
   </div>
 </div>;
}
