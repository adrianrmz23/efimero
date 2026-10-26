"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/poppins/400.css";
import { AlertTriangle, CalendarClock, Check, Church, Copy, Images, Search, Download, FileArchive, FileSpreadsheet, Image as ImageIcon, Loader2, Palette, RefreshCw, ShieldCheck, Trash2, Type, Upload, WandSparkles, X } from "lucide-react";
import { exampleCsv, readSpreadsheet, type SheetRow } from "@/lib/spreadsheetImport";
import { findDuplicates, type ScheduledText } from "@/lib/creativeDuplicates";
import { supabase } from "@/lib/supabase";
import { CREATIVE_DIMENSIONS, drawCreative, splitCreativeBatch, type CreativeAspect, type CreativeBrand, type CreativeContent, type CreativeKind, type CreativeQueueItem } from "@/lib/creativeStudio";
import { imagesToZip } from "@/lib/browserZip";
import { formatPageLabel } from "@/lib/pageLabels";
import { loadSaintArts, saveSaintArt, removeSaintArt, loadBackgrounds, saveBackground, removeBackground, type SavedBackground } from "@/lib/creativeArtStore";
import { useConfirm } from "@/components/ui/DialogProvider";

type Page={id:string;name:string;followers_count?:number|null;fan_count?:number|null};
type Props={pages:Page[];pageId:string;onChoosePage:(id:string)=>void;onSendToBulk:(items:CreativeQueueItem[])=>void;incoming?:{rows:SheetRow[];source:string;nonce:number;kind?:"minimal"|"photo"}|null};
type Generated=CreativeQueueItem & {label:string;index:number;artMissing?:boolean;stale?:boolean};
type StockPhoto={id:string;thumb:string;full:string;alt:string;color:string};
type Review={status:"pass"|"review"|"block";issues:{message:string}[];correctedText?:string};
const sourceTextFor=(item:CreativeContent)=>item.kind==="prayer"?`Oración a ${item.saint} por ${item.intention}. ${item.body}`:`${item.title}. ${item.body}`;
const reviewReason=(r?:Review)=>r?.issues?.[0]?.message||"Necesita revisión manual.";
const shortDate=(value:string)=>new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString("es-MX",{day:"numeric",month:"short"});
const defaults:CreativeContent={kind:"prayer",saint:"San Benito",intention:"protección y paz",title:"Oración de la noche",body:"Señor,\npongo en tus manos este día.\nSana mi cansancio,\naquieta mis pensamientos\ny déjame descansar en tu paz.\n\nAmén."};
const maxBatch=100;
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

export default function CreativeStudio({pages,pageId,onChoosePage,onSendToBulk,incoming}:Props){
 const [kind,setKind]=useState<CreativeKind>("prayer"); const [aspect,setAspect]=useState<CreativeAspect>("1:1");const [content,setContent]=useState<CreativeContent>(defaults);
 const [brand,setBrand]=useState<CreativeBrand>(newBrand("Tu página"));const [art,setArt]=useState("");const [artBySaint,setArtBySaint]=useState<Record<string,string>>({});const [autoSaintArt,setAutoSaintArt]=useState(false);const [batch,setBatch]=useState("");const [rows,setRows]=useState<SheetRow[]>([]);const [sheetName,setSheetName]=useState("");
 const [preview,setPreview]=useState("");const [renderError,setRenderError]=useState("");const [generated,setGenerated]=useState<Generated[]>([]);
 const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");const [loadedPage,setLoadedPage]=useState<string|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null);const artRef=useRef<HTMLInputElement>(null);const avatarRef=useRef<HTMLInputElement>(null);const logoRef=useRef<HTMLInputElement>(null);const sheetRef=useRef<HTMLInputElement>(null);
 const [reviews,setReviews]=useState<Record<string,Review>>({});const [backgrounds,setBackgrounds]=useState<SavedBackground[]>([]);const bgRef=useRef<HTMLInputElement>(null);
 const [stockOpen,setStockOpen]=useState(false);const [stockQuery,setStockQuery]=useState("cielo atardecer");const [stockPhotos,setStockPhotos]=useState<StockPhoto[]>([]);const [stockPage,setStockPage]=useState(1);const [stockMore,setStockMore]=useState(false);const [stockPicked,setStockPicked]=useState<string[]>([]);const [stockError,setStockError]=useState("");const [stockSource,setStockSource]=useState("Pixabay");const [history,setHistory]=useState<ScheduledText[]>([]);
 const confirm=useConfirm();
 const currentPage=pages.find(p=>p.id===pageId);
 // Cada fila importada es una pieza; para oraciones de santo la columna título se usa como santo.
 const rowContents=useMemo(()=>rows.map(r=>kind==="prayer"?{...content,kind,saint:r.title||content.saint,body:r.body}:{...content,kind,title:r.title,body:r.body}),[rows,kind,content]);
 const draftContents=useMemo(()=>rows.length?rowContents:batch.trim()?splitCreativeBatch(batch,kind,{...content,kind}):[],[rows,rowContents,batch,kind,content]);
 const draftCount=draftContents.length||1;
 const duplicates=useMemo(()=>findDuplicates(draftContents.map(x=>x.body),history),[draftContents,history]);
 const duplicateCount=duplicates.filter(Boolean).length;
 const staleIndexes=generated.filter(g=>g.stale).map(g=>g.index);
 const captionFor=(g:Generated)=>rows.length?(rows[g.index]?.caption||""):g.caption;
 // Lo ya programado en esta página (últimos 6 meses) para avisar de repetidas.
 async function loadHistory(){
   if(!supabase||!pageId){setHistory([]);return;}
   const since=new Date(Date.now()-180*86_400_000).toISOString().slice(0,10);
   const {data}=await supabase.from("efimero_scheduled_posts").select("publish_at,compliance_data").eq("page_id",pageId).eq("status","Programado").not("compliance_data","is",null).gte("publish_at",since).order("publish_at",{ascending:false}).limit(2000);
   setHistory((data||[]).map((x:any)=>({text:String(x.compliance_data?.embedded_text||""),date:String(x.publish_at||"")})).filter(x=>x.text));
 }
 useEffect(()=>{void loadHistory().catch(()=>setHistory([]));},[pageId]);
 // Revisa con Compliance los textos que aún no tienen resultado (imagen y caption), en tandas de 20.
 async function reviewTexts(texts:string[]){
   const missing=Array.from(new Set(texts.map(t=>t.trim()).filter(t=>t&&!reviews[t])));
   const found:Record<string,Review>={};
   for(let i=0;i<missing.length;i+=20){
     const chunk=missing.slice(i,i+20);
     const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:chunk})});const data=await r.json();
     if(!r.ok)throw new Error(data.error||"Falló la revisión de Compliance.");
     chunk.forEach((text,k)=>{const x=data.items?.[k];if(x)found[text]={status:x.status,issues:x.issues||[],correctedText:x.correctedText};});
   }
   const merged={...reviews,...found};setReviews(merged);return merged;
 }
 const reviewOf=(text:string,map=reviews)=>text.trim()?map[text.trim()]:undefined;
 async function importSheet(event:React.ChangeEvent<HTMLInputElement>){
   const f=event.target.files?.[0];event.target.value="";if(!f)return;setBusy("sheet");setError("");setNotice("");
   try{const parsed=await readSpreadsheet(f);if(!parsed.length)throw new Error("No encontré filas con texto. Revisa que haya una columna \"texto\".");if(parsed.length>maxBatch)throw new Error(`El archivo tiene ${parsed.length} filas; el máximo es ${maxBatch} por lote.`);setRows(parsed);setSheetName(f.name);setBatch("");setGenerated([]);setNotice(`${parsed.length} filas importadas de ${f.name}. Revísalas y genera el lote.`);}
   catch(e:any){setError(e?.message||"No se pudo leer el archivo.")}finally{setBusy("")}
 }
 // Cambiar título o texto solo marca esa imagen para regenerarla; el caption no cambia la imagen.
 function updateRow(index:number,patch:Partial<SheetRow>){setRows(cur=>cur.map((r,i)=>i===index?{...r,...patch}:r));if(patch.title!==undefined||patch.body!==undefined)setGenerated(cur=>cur.map(g=>g.index===index?{...g,stale:true}:g))}
 function removeRow(index:number){setRows(cur=>cur.filter((_,i)=>i!==index));setGenerated(cur=>cur.filter(g=>g.index!==index).map(g=>g.index>index?{...g,index:g.index-1}:g))}
 function removeDuplicates(){const drop=new Set(duplicates.map((d,i)=>d?i:-1).filter(i=>i>=0));setRows(cur=>cur.filter((_,i)=>!drop.has(i)));setGenerated([]);setNotice(`${drop.size} ${drop.size===1?"fila repetida quitada":"filas repetidas quitadas"}.`)}
 function change(patch:Partial<CreativeContent>){setContent(cur=>({...cur,...patch}));setGenerated([])}
 function updateBrand(patch:Partial<CreativeBrand>){setBrand(cur=>({...cur,...patch}));setGenerated([])}
 useEffect(()=>{
   const name=currentPage?.name||"Tu página";let b=newBrand(name);let savedKind:CreativeKind="prayer";
   try{const stored=pageId&&localStorage.getItem(`efimero:creative:v1.9:${pageId}`);if(stored){const data=JSON.parse(stored);if(data?.brand&&typeof data.brand==="object")b={...b,...data.brand,name:String(data.brand.name||name)};if(["prayer","minimal","photo"].includes(data?.kind))savedKind=data.kind;}}catch{/* Prefer fresh defaults for invalid local preferences. */}
   setBrand(b);setKind(savedKind);setAspect(savedKind==="prayer"?"1:1":"4:5");setArt("");setArtBySaint({});setGenerated([]);setLoadedPage(pageId||"");setError("");setNotice("");
 },[pageId,currentPage?.name]);
 // Frases enviadas desde el Learning Agent: llegan como filas con la plantilla de texto minimalista.
 const appliedIncoming=useRef(0);
 useEffect(()=>{if(!incoming?.rows.length||incoming.nonce===appliedIncoming.current||loadedPage!==pageId)return;appliedIncoming.current=incoming.nonce;setRows(incoming.rows.slice(0,maxBatch));setSheetName(incoming.source);setBatch("");setKind(incoming.kind||"minimal");setAspect("4:5");setGenerated([]);setError("");setNotice(`${Math.min(incoming.rows.length,maxBatch)} piezas recibidas de ${incoming.source}. Revísalas y genera el lote.`);},[incoming?.nonce,loadedPage]);
 useEffect(()=>{setBackgrounds([]);if(!pageId)return;let cancelled=false;loadBackgrounds(pageId).then(list=>{if(!cancelled)setBackgrounds(list)}).catch(()=>{/* IndexedDB es opcional. */});return()=>{cancelled=true};},[pageId]);
 useEffect(()=>{if(!pageId)return;let cancelled=false;loadSaintArts(pageId).then(arts=>{if(!cancelled){setArtBySaint(arts);setArt(arts[saintKey(content.saint)]||"");}}).catch(()=>{/* IndexedDB is optional. The in-memory artwork will still work. */});return()=>{cancelled=true};},[pageId]);
 useEffect(()=>{if(loadedPage!==pageId||!pageId)return;try{localStorage.setItem(`efimero:creative:v1.9:${pageId}`,JSON.stringify({brand,kind}));}catch{setNotice("No se pudo guardar la identidad en este navegador. Comprueba el espacio disponible.");}},[brand,kind,pageId,loadedPage]);
 useEffect(()=>{let active=true;const node=canvas.current;if(!node)return;void drawCreative(node,{...content,kind},brand,{art:kind==="photo"?(backgrounds[0]?.dataUrl||""):art},aspect).then(x=>{if(!active)return;setPreview(x.dataUrl);setRenderError(x.error||"")}).catch(e=>{if(active){setPreview("");setRenderError(e?.message||"Error de composición.")}});return()=>{active=false}},[content,kind,brand,art,aspect,backgrounds]);
 async function pickImage(event:React.ChangeEvent<HTMLInputElement>,destination:"art"|"avatar"|"logo"){
   const f=event.target.files?.[0];event.target.value="";if(!f)return;setBusy("upload");setError("");
   try{const data=await prepareImage(f,destination==="art"?1700:300,destination!=="art");if(destination==="art"){setArt(data);setArtBySaint(prev=>({...prev,[saintKey(content.saint)]:data}));if(pageId)await saveSaintArt(pageId,content.saint,data).catch(()=>setNotice("El arte está disponible durante esta sesión, pero no pudo guardarse en la biblioteca local."));}else updateBrand({[destination]:data});setGenerated([]);setNotice("Imagen cargada. La identidad y los textos se componen sin IA.");}
   catch(e:any){setError(e?.message||"No se pudo cargar el archivo.")}finally{setBusy("")}
 }
 async function addBackgrounds(event:React.ChangeEvent<HTMLInputElement>){
   const files=Array.from(event.target.files||[]);event.target.value="";if(!files.length||!pageId)return;setBusy("bg");setError("");
   try{const added:SavedBackground[]=[];for(const f of files.slice(0,30)){const data=await prepareImage(f,1600);added.push(await saveBackground(pageId,data))}setBackgrounds(cur=>[...cur,...added]);setGenerated([]);setNotice(`${added.length} ${added.length===1?"fondo agregado":"fondos agregados"}.`)}
   catch(e:any){setError(e?.message||"No se pudieron guardar los fondos.")}finally{setBusy("")}
 }
 // Fondos gratuitos (Pixabay o Pexels): se buscan en el servidor y se guardan en la biblioteca como si los subieras tú.
 async function searchStock(page=1){
   if(!stockQuery.trim())return;setBusy("stock");setStockError("");
   try{const r=await fetch(`/api/backgrounds/search?${new URLSearchParams({q:stockQuery.trim(),page:String(page)})}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo buscar.");setStockPhotos(cur=>page===1?d.photos:[...cur,...d.photos]);setStockPage(page);setStockMore(Boolean(d.hasMore));if(d.source)setStockSource(d.source);if(page===1)setStockPicked([]);}
   catch(e:any){setStockError(e?.message||"No se pudo buscar fondos.")}finally{setBusy("")}
 }
 async function addStock(){
   const picked=stockPhotos.filter(x=>stockPicked.includes(x.id));if(!picked.length||!pageId)return;setBusy("stockAdd");setStockError("");
   try{const added:SavedBackground[]=[];for(const photo of picked){const r=await fetch(`/api/backgrounds/image?${new URLSearchParams({url:photo.full})}`);if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"No se pudo descargar una foto.");}const blob=await r.blob();const data=await prepareImage(new File([blob],`${photo.id}.jpg`,{type:blob.type}),1600);added.push(await saveBackground(pageId,data))}
     setBackgrounds(cur=>[...cur,...added]);setStockPicked([]);setGenerated([]);setNotice(`${added.length} ${added.length===1?"fondo agregado":"fondos agregados"} desde ${stockSource}.`);}
   catch(e:any){setStockError(e?.message||"No se pudieron agregar los fondos.")}finally{setBusy("")}
 }
 async function dropBackground(id:string){setBackgrounds(cur=>cur.filter(b=>b.id!==id));setGenerated([]);if(pageId)await removeBackground(pageId,id).catch(()=>{/* Ya no está en el navegador. */})}
 async function makeArt(){
   if(kind!=="prayer")return;
   if(!await confirm({title:"¿Generar la ilustración?",description:`Se hará una solicitud a la API de imágenes configurada y puede generar un costo.\nSanto: ${content.saint}. Solo la ilustración, sin texto.`,confirmLabel:"Generar"}))return;
   setBusy("ai");setError("");setNotice("");
   try{const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"saint-art",saint:content.saint,intention:content.intention,aspect,style:"pintura religiosa clásica al óleo, cálida, detallada, campo rural, luz celestial suave, ilustración artística original sin letras"})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Falló la generación.");if(!data.imageDataUrl)throw new Error(data.message||"No hay API de imágenes configurada. Puedes subir una ilustración propia.");setArt(data.imageDataUrl);setArtBySaint(prev=>({...prev,[saintKey(content.saint)]:data.imageDataUrl}));if(pageId)await saveSaintArt(pageId,content.saint,data.imageDataUrl).catch(()=>setNotice("No se pudo guardar la ilustración localmente."));setGenerated([]);setNotice("Ilustración creada. El texto, los márgenes y la marca se añaden después mediante plantilla.");}
   catch(e:any){setError(e?.message||"No se pudo generar la ilustración.")}finally{setBusy("")}
 }
 async function generateAll(only?:number[]){
   if(!pageId){setError("Selecciona la página de Facebook antes de preparar un lote.");return;}
   const all=draftContents.length?draftContents:[{...content,kind}];
   const indexes=only?.length?only:all.map((_,i)=>i);const contents=indexes.map(i=>all[i]);
   if(!contents.length){setError("Escribe contenido para el lote.");return;}
   if(contents.length>maxBatch){setError(`Máximo ${maxBatch} creatividades por lote.`);return;}
   const saints=Array.from(new Map(contents.filter(x=>kind==="prayer").map(x=>[saintKey(x.saint),x.saint])).values());
   const unavailable=saints.filter(x=>!artBySaint[saintKey(x)]&&!(saintKey(x)===saintKey(content.saint)&&art));
   if(unavailable.length&&!autoSaintArt&&!await confirm({title:"Faltan ilustraciones",description:`Sin ilustración: ${unavailable.join(", ")}.\nSe crearán borradores con marcador de posición, que NO se podrán enviar a programación.`,confirmLabel:"Continuar"}))return;
   if(unavailable.length&&autoSaintArt&&!await confirm({title:`¿Generar ${unavailable.length} ilustraciones?`,description:`Se harán ${unavailable.length} solicitudes de imagen con costo a la API configurada, una por santo sin ilustración: ${unavailable.join(", ")}.`,confirmLabel:"Generar"}))return;
   setBusy("batch");if(!only)setGenerated([]);setError("");setNotice("");
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
     // Fondos: se reparten en orden desde un punto al azar, así dos piezas seguidas no repiten fondo.
     const bgStart=Math.floor(Math.random()*Math.max(1,backgrounds.length));
     const prepared:Generated[]=[];for(let i=0;i<contents.length;i++){
     const item=contents[i];const temp=document.createElement("canvas");const pieceArt=kind==="prayer"?(arts[saintKey(item.saint)]||""):kind==="photo"?(backgrounds[(bgStart+indexes[i])%Math.max(1,backgrounds.length)]?.dataUrl||""):"";const result=await drawCreative(temp,item,brand,{art:pieceArt},aspect);
     if(result.error)throw new Error(`Imagen ${i+1}: ${result.error}`);
     const label=kind==="prayer"?`${item.saint} · ${item.intention}`:item.title;const index=indexes[i];
     prepared.push({id:crypto.randomUUID(),index,label,artMissing:(kind==="prayer"||kind==="photo")&&!pieceArt,fileName:humanFile(kind==="prayer"?item.saint:item.title,index),dataUrl:result.dataUrl,sourceText:sourceTextFor(item),pageId,caption:rows[index]?.caption||""});
   }
     const next=only?[...generated.filter(g=>!indexes.includes(g.index)),...prepared].sort((a,b)=>a.index-b.index):prepared;setGenerated(next);
     // Revisa en cuanto se generan para marcar las filas antes de intentar programar.
     setBusy("review");
     const map=await reviewTexts([...next.map(g=>g.sourceText),...next.map(captionFor)]);
     const flagged=next.filter(g=>reviewOf(g.sourceText,map)?.status!=="pass"||reviewOf(captionFor(g),map)&&reviewOf(captionFor(g),map)?.status!=="pass").length;
     if(flagged)setError(`${prepared.length} ${prepared.length===1?"imagen lista":"imágenes listas"}, pero Compliance marcó ${flagged}. Revisa los motivos en las filas marcadas en rojo.`);
     else setNotice(`${prepared.length} ${prepared.length===1?"creatividad lista":"creatividades listas"} y revisadas por Compliance.`);
   }
   catch(e:any){setError(e?.message||"No se pudo generar el lote.")}finally{setBusy("")}
 }
 function downloadPreview(){if(!preview)return;fetch(preview).then(r=>r.blob()).then(b=>saveFile(b,"efimero-vista-previa.jpg"));}
 async function downloadZip(){if(!generated.length)return;setBusy("zip");setError("");try{saveFile(imagesToZip(generated.map(x=>({name:x.fileName,dataUrl:x.dataUrl}))),`efimero-creatividades-${pageId||"local"}.zip`);}catch(e:any){setError(e?.message||"No se pudo crear el ZIP.")}finally{setBusy("")}}
 async function sendToBulk(){
   if(!pageId||!generated.length){setError("Genera un lote y selecciona una página antes de programar.");return;}
   if(generated.some(x=>x.pageId!==pageId)){setError("El lote pertenece a otra página. Regénéralo con la página actual.");return;}
   if(generated.some(x=>x.artMissing)){setError(kind==="photo"?"Sube al menos un fondo en el Paso 2 y vuelve a generar el lote.":"Algunas oraciones siguen sin ilustración del santo correspondiente. Sube o genera un arte por santo y vuelve a preparar el lote.");return;}
   if(staleIndexes.length){setError(`Cambiaste el texto de ${staleIndexes.length} ${staleIndexes.length===1?"fila":"filas"}. Pulsa «Regenerar cambiadas» antes de programar.`);return;}
   const repeated=generated.filter(g=>duplicates[g.index]).length;
   if(repeated&&!await confirm({title:`${repeated} ${repeated===1?"imagen repetida":"imágenes repetidas"}`,description:"Hay textos repetidos dentro del lote o que ya programaste en los últimos 6 meses en esta página. Puedes quitarlos con «Quitar repetidas».",confirmLabel:"Programar de todos modos"}))return;
   setBusy("review");setError("");setNotice("");
   try{const map=await reviewTexts([...generated.map(g=>g.sourceText),...generated.map(captionFor)]);
     const rejected=generated.flatMap(g=>{const n=g.index+1;const out:string[]=[];if(reviewOf(g.sourceText,map)?.status!=="pass")out.push(`#${n} texto`);const cap=reviewOf(captionFor(g),map);if(cap&&cap.status!=="pass")out.push(`#${n} caption`);return out;});
     if(rejected.length)throw new Error(`Compliance marcó ${rejected.length}: ${rejected.join(", ")}. Corrige esas filas (el motivo está en cada una) y vuelve a intentarlo.`);
     onSendToBulk(generated.map(g=>({id:g.id,fileName:g.fileName,dataUrl:g.dataUrl,sourceText:g.sourceText,pageId:g.pageId,caption:captionFor(g)})));
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
           <button type="button" className={kind==="photo"?"studioOption active":"studioOption"} aria-pressed={kind==="photo"} onClick={()=>{setKind("photo");setAspect("4:5");setGenerated([])}}><span className="studioOptionIcon"><Images size={18}/></span><span className="studioOptionText"><strong>Oración con fondo</strong><small>Foto, título grande y oración centrada</small></span></button>
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
         <label><span>{kind==="minimal"?"Texto principal":"Oración"}</span><textarea value={content.body} rows={7} onChange={e=>change({body:e.target.value})}/></label>
         {kind==="photo"&&<div className="studioSubsection">
           <div className="studioSubsectionHead"><strong>Fondos de la página</strong><span>Sube fotos tuyas o libres de derechos. Se reparten entre las piezas del lote y se guardan en este navegador por página.</span></div>
           <input ref={bgRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>void addBackgrounds(e)}/>
           <div className="studioUploadRow"><button className="uiBtn uiBtnSecondary" onClick={()=>bgRef.current?.click()} disabled={!!busy||!pageId}>{busy==="bg"?<Loader2 size={16} className="spin"/>:<Upload size={16}/>} Subir fondos</button><button className="uiBtn uiBtnSecondary" onClick={()=>{setStockOpen(o=>!o);if(!stockPhotos.length)void searchStock(1)}} disabled={!!busy||!pageId} aria-expanded={stockOpen}><Search size={16}/> Buscar fondos gratis</button><span className="studioHint">{backgrounds.length?`${backgrounds.length} ${backgrounds.length===1?"fondo":"fondos"} · la vista previa usa el primero`:"Recomendado: 15 a 20 fondos distintos"}</span></div>
           {stockOpen&&<div className="studioStock">
             <form className="studioStockSearch" onSubmit={e=>{e.preventDefault();void searchStock(1)}}><input value={stockQuery} onChange={e=>setStockQuery(e.target.value)} placeholder="cielo atardecer, vitral, velas, montañas…" aria-label="Buscar fondos"/><button className="uiBtn uiBtnSecondary" type="submit" disabled={!!busy||!stockQuery.trim()}>{busy==="stock"?<Loader2 size={16} className="spin"/>:<Search size={16}/>} Buscar</button></form>
             {stockError&&<div className="studioNotice error"><AlertTriangle size={16}/><span>{stockError}</span></div>}
             {!!stockPhotos.length&&<div className="studioStockGrid">{stockPhotos.map(photo=>{const picked=stockPicked.includes(photo.id);return <button type="button" key={photo.id} className={picked?"picked":""} style={{background:photo.color}} onClick={()=>setStockPicked(cur=>picked?cur.filter(x=>x!==photo.id):[...cur,photo.id])} aria-pressed={picked} title={photo.alt}><img src={photo.thumb} alt={photo.alt} loading="lazy"/>{picked&&<span><Check size={14}/></span>}</button>})}</div>}
             <div className="studioStockFoot"><a href={stockSource==="Pexels"?"https://www.pexels.com":"https://pixabay.com"} target="_blank" rel="noreferrer">Fotos de {stockSource}</a><div>{stockMore&&<button type="button" className="linkButton" onClick={()=>void searchStock(stockPage+1)} disabled={!!busy}>Más resultados</button>}<button type="button" className="uiBtn uiBtnPrimary" onClick={()=>void addStock()} disabled={!!busy||!stockPicked.length}>{busy==="stockAdd"?<Loader2 size={16} className="spin"/>:<Check size={16}/>} Agregar {stockPicked.length||""} {stockPicked.length===1?"fondo":"fondos"}</button></div></div>
           </div>}
           {!!backgrounds.length&&<div className="studioBgGrid">{backgrounds.map((bg,i)=><figure key={bg.id}><img src={bg.dataUrl} alt={`Fondo ${i+1}`}/><button type="button" className="studioGalleryRemove" onClick={()=>void dropBackground(bg.id)} aria-label={`Quitar fondo ${i+1}`}><X size={14}/></button></figure>)}</div>}
         </div>}
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
         <div className="studioImportBar">
           <input ref={sheetRef} type="file" accept=".xlsx,.csv,.tsv,text/csv" hidden onChange={e=>void importSheet(e)}/>
           <button type="button" className="uiBtn uiBtnSecondary" onClick={()=>sheetRef.current?.click()} disabled={!!busy}>{busy==="sheet"?<Loader2 size={16} className="spin"/>:<FileSpreadsheet size={16}/>} Importar Excel o CSV</button>
           <button type="button" className="linkButton" onClick={()=>saveFile(exampleCsv(),"plantilla-oraciones.csv")}><Download size={14}/> Descargar plantilla</button>
           <span className="studioHint">Columnas: <b>titulo</b>, <b>texto</b> y <b>caption</b> (opcional). Una fila = una imagen; los saltos de línea dentro de la celda se respetan.</span>
         </div>
         {rows.length?<div className="studioRows">
           <div className="studioRowsHead"><strong>{rows.length} {rows.length===1?"fila":"filas"} de {sheetName}</strong><div className="studioRowsActions">{duplicateCount>0&&<button type="button" className="linkButton" onClick={removeDuplicates}><Copy size={14}/> Quitar repetidas ({duplicateCount})</button>}<button type="button" className="linkButton" onClick={()=>{setRows([]);setSheetName("");setGenerated([])}}><X size={14}/> Quitar archivo</button></div></div>
           <ol>{rows.map((r,i)=>{
             const g=generated.find(x=>x.index===i);const dup=duplicates[i];
             const textReview=g&&!g.stale?reviewOf(g.sourceText):undefined;const capReview=reviewOf(r.caption);
             const textBad=!!textReview&&textReview.status!=="pass";const capBad=!!capReview&&capReview.status!=="pass";
             const suggestion=capBad&&capReview?.correctedText&&capReview.correctedText.trim()!==r.caption.trim()?capReview.correctedText.trim():"";
             return <li key={i} className={textBad||capBad?"flagged":dup?"repeated":""}>
             <span className="studioRowIndex">{i+1}</span>
             <div className="studioRowFields"><input aria-label={`Título fila ${i+1}`} value={r.title} placeholder={kind==="prayer"?"Santo":"Título"} onChange={e=>updateRow(i,{title:e.target.value})}/><textarea aria-label={`Texto fila ${i+1}`} rows={Math.min(8,Math.max(3,r.body.split("\n").length))} value={r.body} onChange={e=>updateRow(i,{body:e.target.value})}/>
               <input aria-label={`Caption fila ${i+1}`} value={r.caption} placeholder="Caption para Facebook (opcional)" onChange={e=>updateRow(i,{caption:e.target.value})}/>
               {(dup||g?.stale||textReview||capReview)&&<div className="studioRowChecks">
                 {dup&&<span className="studioChip warn"><Copy size={12}/> {dup.row?`Repetida de la fila ${dup.row}`:`Ya programada el ${shortDate(dup.date||"")}`}</span>}
                 {g?.stale&&<span className="studioChip"><RefreshCw size={12}/> Texto cambiado: regenera la imagen</span>}
                 {textReview&&(textBad?<span className="studioChip error"><AlertTriangle size={12}/> Texto: {reviewReason(textReview)}</span>:<span className="studioChip ok"><Check size={12}/> Texto OK</span>)}
                 {capReview&&(capBad?<span className="studioChip error"><AlertTriangle size={12}/> Caption: {reviewReason(capReview)}</span>:<span className="studioChip ok"><Check size={12}/> Caption OK</span>)}
                 {suggestion&&<button type="button" className="linkButton" onClick={()=>updateRow(i,{caption:suggestion})} title={suggestion}>Usar sugerido: «{suggestion}»</button>}
               </div>}
             </div>
             <button type="button" className="uiIconBtn" onClick={()=>removeRow(i)} aria-label={`Quitar fila ${i+1}`}><Trash2 size={15}/></button>
           </li>})}</ol>
         </div>:<details className="studioManual"><summary>O escribe el lote a mano</summary>
         <label><span>{kind==="prayer"?"Un bloque por pieza: Santo | Intención y oración":"Un bloque por pieza: Título | texto"}</span><textarea className="studioMono" rows={8} value={batch} onChange={e=>{setBatch(e.target.value);setGenerated([])}} placeholder={kind==="prayer"?"San Benito | Protección\nSeñor, acompáñame... Amén.\n---\nSan Judas Tadeo | Esperanza\nQue tu intercesión... Amén.":"Oración de la noche | Señor, dejo en tus manos este día...\n---\nReflexión para hoy | Hay momentos que..."}/><small>Hasta {maxBatch} imágenes por lote.</small></label>
         </details>}
         {kind==="prayer"&&<label className="studioCheckRow"><input type="checkbox" checked={autoSaintArt} onChange={e=>setAutoSaintArt(e.target.checked)}/><div><strong>Generar con IA las ilustraciones que falten</strong><small>Una solicitud con costo por cada santo sin ilustración.</small></div></label>}
         <div className="studioCardFooter"><span className="studioHint">{draftCount} {draftCount===1?"pieza prevista":"piezas previstas"}{duplicateCount>0&&` · ${duplicateCount} ${duplicateCount===1?"repetida":"repetidas"}`}</span><div className="studioFooterActions">{staleIndexes.length>0&&<button className="uiBtn uiBtnPrimary" onClick={()=>void generateAll(staleIndexes)} disabled={!!busy}><RefreshCw size={16}/> Regenerar cambiadas ({staleIndexes.length})</button>}<button className={generated.length?"uiBtn uiBtnSecondary":"uiBtn uiBtnPrimary"} onClick={()=>void generateAll()} disabled={!!busy||!pageId||(!content.body.trim()&&!batch.trim()&&!rows.length)}>{busy==="batch"?<Loader2 size={16} className="spin"/>:<ImageIcon size={16}/>} Generar {rows.length||batch.trim()?`lote (${draftCount})`:"pieza"}</button></div></div>
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
         <div className="studioGallery">{generated.map(x=>{const n=x.index+1;const textBad=!x.stale&&reviewOf(x.sourceText)&&reviewOf(x.sourceText)?.status!=="pass";const cap=reviewOf(captionFor(x));const flag=x.artMissing?(kind==="photo"?"Falta fondo":"Falta arte"):x.stale?"Regenerar":textBad?"Revisar texto":cap&&cap.status!=="pass"?"Revisar caption":duplicates[x.index]?"Repetida":"";
           return <figure key={x.id} className={x.artMissing||x.stale||duplicates[x.index]?"missing":textBad||flag==="Revisar caption"?"flagged":""}><img src={x.dataUrl} alt={`Creatividad ${n}: ${x.label}`}/><button type="button" className="studioGalleryRemove" onClick={()=>setGenerated(cur=>cur.filter(g=>g.id!==x.id))} aria-label={`Quitar imagen ${n}`}><X size={14}/></button><figcaption>{n}. {x.label}{flag&&<b> · {flag}</b>}</figcaption></figure>})}</div>
         <div className="studioBatchActions"><button className="uiBtn uiBtnSecondary" onClick={()=>void downloadZip()} disabled={!!busy}><FileArchive size={16}/> Descargar ZIP</button><button className="uiBtn uiBtnPrimary" onClick={()=>void sendToBulk()} disabled={!!busy}>{busy==="review"?<Loader2 size={16} className="spin"/>:<CalendarClock size={16}/>} {busy==="review"?"Revisando…":"Revisar y programar"}</button></div>
       </div>}
       {(notice||error)&&<div className={error?"studioNotice error":"studioNotice success"}>{error?<AlertTriangle size={16}/>:<Check size={16}/>}<span>{error||notice}</span></div>}
     </section>
   </div>
 </div>;
}
