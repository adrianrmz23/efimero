"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Activity, BarChart3, Bookmark, BrainCircuit, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Copy, Database,
  ExternalLink, FileText, Filter, Fingerprint, Flame, FlaskConical, Gauge, Image as ImageIcon, Layers3, LayoutDashboard, Library, Link2, Menu, MessageCircle, MessagesSquare, Plus, RefreshCw, RadioTower, ShieldCheck,
  Search, Settings2, Smile, Sparkles, Star, Trash2, TrendingUp, Type as TypeIcon, Upload, WandSparkles, X, Zap,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import MetaPanel from "@/components/MetaPanel";
import FacebookAnalytics from "@/components/FacebookAnalytics";
import TextFactory from "@/components/TextFactory";
import EditorialCalendar from "@/components/EditorialCalendar";
import AutopilotPanel from "@/components/AutopilotPanel";
import ImageStudio from "@/components/ImageStudio";
import PerformanceLearning from "@/components/PerformanceLearning";
import CopyExperiments from "@/components/CopyExperiments";
import AudienceVoice from "@/components/AudienceVoice";
import ExecutiveDashboard from "@/components/ExecutiveDashboard";
import TextQueue from "@/components/TextQueue";
import FatigueRadar from "@/components/FatigueRadar";
import ComplianceCenter from "@/components/ComplianceCenter";
import OperationsCenter from "@/components/OperationsCenter";
import LogoutButton from "@/components/auth/LogoutButton";

type Tab = "creator" | "calendar" | "library" | "categories" | "profile" | "factory" | "learning" | "experiments" | "audience" | "executive" | "autopilot" | "images" | "meta" | "analytics" | "queue" | "fatigue" | "compliance" | "operations";
type PostType = "Texto" | "Imagen" | "Híbrido";
type ScheduleItem = { id:string; date:string; time:string; category:string; text:string; format:"Texto"|"Imagen"; status:"Borrador"|"Revisión"|"Aprobado"|"Programado"|"Publicado"|"Error"; similarity?:number; imageDataUrl?:string; imageUrl?:string; pageId?:string; pageName?:string; metaPostId?:string; compliance?:any; publishError?:string; autopilot?:boolean };
type Category = { id:string; name:string; emoji:string; enabled:boolean };
type SkipRange = { id:string; start:string; end:string };
type LibrarySource = "manual"|"historical"|"generated"|"reference";
type LibraryFilter = "all"|"generated"|"historical"|"reference"|"favorites"|"top";
type LibraryItem = {
  id:string; text:string; category:string; format:string; createdAt:string; source?:LibrarySource;
  sourceUrl?:string; notes?:string; reactions?:number; comments?:number; shares?:number; reach?:number;
  publishedAt?:string; performanceScore?:number; favorite?:boolean; generationBatch?:string;
  platform?:"facebook"|string; platformPostId?:string; sourcePageId?:string; sourcePageName?:string;
  sourceImageUrl?:string; extractionMetadata?:Record<string,unknown>; factoryScore?:number;
};
type CalendarSnapshot = { id:string; createdAt:string; days:number; posts:number; startDate:string };
type SyncState = "local"|"loading"|"synced"|"error";
type ProfileCategory = { name:string; count:number; share:number };
type ToneScores = { reflective:number; conversational:number; humorous:number; emotional:number };
type EditorialProfile = {
  sampleSize:number;
  avgChars:number;
  avgWords:number;
  questionRate:number;
  emojiRate:number;
  exclamationRate:number;
  shortRate:number;
  topCategories:ProfileCategory[];
  topWords:string[];
  hooks:string[];
  tone:ToneScores;
  summary:string;
  rules:string[];
  avoid:string[];
  generationInstruction:string;
  analyzedAt:string;
};

const initialCategories: Category[] = [
  { id:"identificables", name:"Frases identificables", emoji:"💭", enabled:true },
  { id:"humor", name:"Humor", emoji:"😂", enabled:true },
  { id:"relaciones", name:"Relaciones", emoji:"❤️", enabled:true },
  { id:"nostalgia", name:"Nostalgia", emoji:"📼", enabled:true },
  { id:"preguntas", name:"Preguntas", emoji:"👀", enabled:true },
  { id:"noche", name:"Pensamientos nocturnos", emoji:"🌙", enabled:true },
  { id:"motivacion", name:"Motivación ligera", emoji:"✨", enabled:true },
  { id:"cotidiano", name:"Vida cotidiana", emoji:"☕", enabled:true },
];

const contentBank: Record<string,string[]> = {
  "Frases identificables":["Hay días en los que uno no necesita respuestas, solo un poco de paz.","Madurar también es dejar de explicar por qué algo te dolió.","A veces no extrañas a la persona, extrañas quién eras cuando estaba contigo.","No todos los finales se sienten como despedidas. Algunos se sienten como alivio.","Qué tranquilidad cuando ya no necesitas convencer a nadie de quedarse."],
  Humor:["Mi talento es decir ‘hoy sí duermo temprano’ con una seguridad admirable.","Yo sí sé administrar mi tiempo: lo desperdicio de manera muy organizada.","Adulto funcional por fuera, buscando qué cenar desde las 4 de la tarde por dentro.","No necesito vacaciones, necesito que nadie me hable durante tres días.","Mi economía se basa en no abrir la app del banco para que no me dé estrés."],
  Relaciones:["El cariño también se nota en quien hace espacio para ti incluso en sus días pesados.","Qué bonito cuando alguien no te hace adivinar si le importas.","A veces querer a alguien también significa dejar de insistir.","Las personas correctas no solucionan todo, pero hacen que no cargues todo solo.","El amor tranquilo también existe: no todo tiene que doler para sentirse intenso."],
  Nostalgia:["Qué raro volver a escuchar una canción y recordar una versión de ti que ya no existe.","Hay lugares que nunca vuelves a visitar, pero sigues llevando contigo.","Antes queríamos crecer rápido. Ahora daríamos todo por una tarde cualquiera de entonces.","La nostalgia es ese lugar donde todo sigue igual aunque tú ya hayas cambiado.","Hay fotos que no extrañas por la imagen, sino por todo lo que estaba pasando alrededor."],
  Preguntas:["Dinos tu estado de ánimo usando solo emojis 👀","¿Qué canción te lleva automáticamente a otra época de tu vida?","¿Qué pequeña cosa te mejora el día casi siempre?","¿Qué aprendiste demasiado tarde, pero te cambió para bien?","Si pudieras repetir un solo día de tu vida, ¿cuál sería?"],
  "Pensamientos nocturnos":["Las noches tienen esa costumbre de devolver preguntas que durante el día logramos ignorar.","Tal vez descansar también sea una forma de seguir avanzando.","No todo lo que no resolviste hoy tiene que acompañarte a la cama.","Que esta noche pese menos que todo lo que cargaste durante el día.","Mañana también cuenta. No todo tiene que resolverse hoy."],
  "Motivación ligera":["No tienes que tener todo claro para dar el siguiente paso.","Empezar despacio sigue siendo empezar.","A veces avanzar se parece más a descansar que a correr.","Un mal día no tiene por qué convertirse en una mala semana.","Hazlo a tu ritmo, pero no te abandones en el camino."],
  "Vida cotidiana":["La verdadera paz adulta es cancelar un plan y que la otra persona también quería cancelarlo.","Hay días en los que un café y cinco minutos de silencio arreglan más de lo esperado.","Qué lujo cuando no tienes nada pendiente y puedes perder el tiempo sin culpa.","La vida adulta consiste en preguntarse qué comer todos los días para siempre.","¿En qué momento comprar cosas para la casa empezó a emocionarnos tanto?"],
};

const pad=(n:number)=>String(n).padStart(2,"0");
const timeToMinutes=(time:string)=>{const [h,m]=time.split(":").map(Number);return h*60+m};
const minutesToTime=(m:number)=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const toISODate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const addDays=(iso:string,amount:number)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+amount);return toISODate(d)};
const prettyDate=(iso:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long"}).format(new Date(`${iso}T12:00:00`));
const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const similarity=(a:string,b:string)=>{const A=new Set(normalize(a).split(" ").filter(Boolean));const B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const intersection=[...A].filter(w=>B.has(w)).length;return intersection/new Set([...A,...B]).size};
const fingerprint=(text:string)=>normalize(text).split(" ").sort().join(" ").slice(0,220);
const clamp=(n:number,min=0,max=1)=>Math.min(max,Math.max(min,n));
const pct=(n:number)=>`${Math.round(n*100)}%`;
const emojiPattern=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const stopWords=new Set("a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era eres es esa ese eso esta estaba este esto fue ha hay la las le les lo los mas me mi mis muy no nos o para pero por porque que se si sin sobre su sus te tu tus un una unas uno unos ya y yo".split(" "));

function buildEditorialProfile(items:LibraryItem[]):EditorialProfile{
  const owned=items.filter(x=>x.source!=="reference");
  const historical=owned.filter(x=>x.source==="historical"||x.source==="manual");
  const trainingItems=historical.length>=8?historical:owned;
  const texts=trainingItems.map(x=>x.text.trim()).filter(Boolean);
  const sampleSize=texts.length;
  const totalChars=texts.reduce((n,t)=>n+t.length,0);
  const words=texts.flatMap(t=>normalize(t).split(" ").filter(Boolean));
  const avgChars=sampleSize?Math.round(totalChars/sampleSize):0;
  const avgWords=sampleSize?Math.round(words.length/sampleSize):0;
  const questionRate=sampleSize?texts.filter(t=>t.includes("?")||t.includes("¿")).length/sampleSize:0;
  const emojiRate=sampleSize?texts.filter(t=>emojiPattern.test(t)).length/sampleSize:0;
  const exclamationRate=sampleSize?texts.filter(t=>t.includes("!")||t.includes("¡")).length/sampleSize:0;
  const shortRate=sampleSize?texts.filter(t=>t.length<=120).length/sampleSize:0;
  const catCounts=new Map<string,number>();
  trainingItems.forEach(i=>catCounts.set(i.category,(catCounts.get(i.category)||0)+1));
  const topCategories=[...catCounts.entries()].map(([name,count])=>({name,count,share:sampleSize?count/sampleSize:0})).sort((a,b)=>b.count-a.count).slice(0,8);
  const freq=new Map<string,number>();
  words.filter(w=>w.length>3&&!stopWords.has(w)).forEach(w=>freq.set(w,(freq.get(w)||0)+1));
  const topWords=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([w])=>w);
  const hookFreq=new Map<string,number>();
  texts.forEach(t=>{const w=t.trim().split(/\s+/).slice(0,3).join(" ").replace(/[.,!?¡¿:;]+$/g,"");if(w)hookFreq.set(w,(hookFreq.get(w)||0)+1)});
  const hooks=[...hookFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([h])=>h);
  const humorousShare=(catCounts.get("Humor")||0)/Math.max(sampleSize,1);
  const emotionalCats=["Relaciones","Nostalgia","Frases identificables","Pensamientos nocturnos","Motivación ligera"].reduce((n,c)=>n+(catCounts.get(c)||0),0)/Math.max(sampleSize,1);
  const reflective=clamp(emotionalCats*.7 + texts.filter(t=>/a veces|tal vez|madurar|recordar|extrañ|paz|vida|tiempo/i.test(t)).length/Math.max(sampleSize,1)*.35);
  const conversational=clamp(questionRate*.85 + texts.filter(t=>/dinos|te pasa|quién|qué|cuál|tú|ustedes/i.test(t)).length/Math.max(sampleSize,1)*.45);
  const humorous=clamp(humorousShare*.8 + texts.filter(t=>/jaja|adulto|economía|vacaciones|dormir|cenar|banco/i.test(t)).length/Math.max(sampleSize,1)*.35);
  const emotional=clamp(emotionalCats*.78 + texts.filter(t=>/amor|cariño|duele|dolió|extrañ|corazón|recuerdo/i.test(t)).length/Math.max(sampleSize,1)*.3);
  const summary=sampleSize===0?"Importa publicaciones históricas para construir la huella editorial de Efímero.":questionRate>=.3?"Voz breve y emocional con una presencia importante de preguntas para activar conversación.":humorous>=.45?"Voz cercana que mezcla identificación cotidiana, emoción y humor ligero.":"Voz breve, cercana y reflexiva, centrada en identificación emocional y lectura rápida.";
  const rules=[
    `Mantener una longitud cercana a ${Math.max(avgWords,6)} palabras por publicación.`,
    questionRate>=.2?`Incluir preguntas en aproximadamente ${Math.round(questionRate*100)}% del contenido.`:"Usar preguntas de forma puntual, no como recurso dominante.",
    emojiRate>=.2?"Los emojis forman parte del estilo; usarlos con moderación y sentido editorial.":"Priorizar texto limpio; los emojis no son necesarios en la mayoría de piezas.",
    shortRate>=.6?"Favorecer publicaciones cortas y fáciles de consumir en el feed.":"Alternar frases cortas con textos de una o dos líneas.",
  ];
  const avoid=["Tono corporativo o explicativo.","Frases motivacionales genéricas sin giro propio.","Repetir el mismo inicio en publicaciones consecutivas.","Sobrecargar una pieza con hashtags o llamadas a la acción."];
  const generationInstruction=`Escribe como Efímero: promedio de ${Math.max(avgWords,6)} palabras, tono ${reflective>=.5?"reflexivo":"cercano"}${emotional>=.5?" y emocional":""}, preguntas en ${Math.round(questionRate*100)}% de las piezas y emojis en ${Math.round(emojiRate*100)}%. Prioriza lectura rápida y lenguaje natural.`;
  return {sampleSize,avgChars,avgWords,questionRate,emojiRate,exclamationRate,shortRate,topCategories,topWords,hooks,tone:{reflective,conversational,humorous,emotional},summary,rules,avoid,generationInstruction,analyzedAt:new Date().toISOString()};
}

function detectCategory(text:string){
  const t=normalize(text);
  if(/[?¿]/.test(text))return "Preguntas";
  if(/jaja|adulto|banco|dormir|cenar|vacaciones|trabajo|lunes|viernes|economia/.test(t))return "Humor";
  if(/noche|dormir|cama|madrugada|manana/.test(t))return "Pensamientos nocturnos";
  if(/recuerdo|recordar|antes|infancia|cancion|foto|epoca|volver|nostalgia/.test(t))return "Nostalgia";
  if(/amor|pareja|querer|carino|persona|relacion|corazon|quedar|irse|quedarse/.test(t))return "Relaciones";
  if(/avanzar|empezar|seguir|ritmo|puedes|lograr|paso|rendirse/.test(t))return "Motivación ligera";
  if(/cafe|casa|comer|dia|tiempo|plan|comprar|vida adulta/.test(t))return "Vida cotidiana";
  return "Frases identificables";
}

function weightedCategoryPool(categories:string[],profile:EditorialProfile|null){
  if(!profile||!profile.topCategories.length)return categories;
  const shares=new Map(profile.topCategories.map(x=>[x.name,x.share]));
  return categories.flatMap(name=>Array.from({length:Math.max(1,Math.round((shares.get(name)||.04)*24))},()=>name));
}

function calcPerformance(reactions=0,comments=0,shares=0,reach=0){
  const weighted=reactions + comments*2 + shares*4;
  if(reach>0)return Math.round((weighted/reach)*10000)/10;
  return Math.round(Math.log10(weighted+1)*100)/10;
}
function sourceLabel(source?:LibrarySource){
  if(source==="generated")return "Generado";
  if(source==="historical")return "Efímero histórico";
  if(source==="reference")return "Referencia";
  return "Manual";
}
function sourceEmoji(source?:LibrarySource){
  if(source==="generated")return "✦";
  if(source==="historical")return "E";
  if(source==="reference")return "↗";
  return "+";
}
function extractReferencePattern(text:string){
  const t=normalize(text); const words=t.split(" ").filter(Boolean).length;
  const hook=text.trim().split(/\s+/).slice(0,4).join(" ").replace(/[.,!?¡¿:;]+$/g,"");
  const parts=[words<=14?"copy muy corto":words<=28?"copy corto":"copy medio"];
  if(text.includes("?")||text.includes("¿"))parts.push("cierra con pregunta");
  if(/a veces|cuando|hay dias|que raro|nadie|todos|yo|tu|te pasa/.test(t))parts.push("hook identificable");
  if(/amor|extrañ|recuerdo|dol|paz|tiempo|vida|persona/.test(t))parts.push("carga emocional");
  if(/jaja|adulto|dinero|dormir|trabajo|lunes|viernes|cafe/.test(t))parts.push("cotidiano/humor");
  return `${hook?`Hook: “${hook}…” · `:""}${parts.join(" · ")}`;
}

export default function EfimeroApp(){
  const [tab,setTab]=useState<Tab>("creator");
  useEffect(()=>{
    const section=new URLSearchParams(window.location.search).get("section") as Tab|null;
    const allowed:Tab[]=["creator","calendar","library","categories","profile","factory","learning","experiments","audience","executive","autopilot","images","meta","analytics","queue","fatigue","compliance","operations"];
    if(section&&allowed.includes(section))setTab(section);
  },[]);
  const [mobileNav,setMobileNav]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [postType,setPostType]=useState<PostType>("Texto");
  const [startTime,setStartTime]=useState("07:00");
  const [endTime,setEndTime]=useState("23:59");
  const [frequency,setFrequency]=useState(30);
  const [customFrequency,setCustomFrequency]=useState(45);
  const [days,setDays]=useState(15);
  const [customDays,setCustomDays]=useState(12);
  const [startDate,setStartDate]=useState(()=>toISODate(new Date()));
  const [categories,setCategories]=useState<Category[]>(initialCategories);
  const [selectedCategories,setSelectedCategories]=useState(initialCategories.map(x=>x.name));
  const [skipRanges,setSkipRanges]=useState<SkipRange[]>([{id:"meal",start:"14:00",end:"16:00"}]);
  const [schedule,setSchedule]=useState<ScheduleItem[]>([]);
  const [library,setLibrary]=useState<LibraryItem[]>([]);
  const [history,setHistory]=useState<CalendarSnapshot[]>([]);
  const [calendarDay,setCalendarDay]=useState(0);
  const [librarySearch,setLibrarySearch]=useState("");
  const [libraryFilter,setLibraryFilter]=useState<LibraryFilter>("all");
  const [autoArchiveGenerated,setAutoArchiveGenerated]=useState(true);
  const [referenceText,setReferenceText]=useState("");
  const [referenceUrl,setReferenceUrl]=useState("");
  const [referenceNotes,setReferenceNotes]=useState("");
  const [referenceReactions,setReferenceReactions]=useState(0);
  const [referenceComments,setReferenceComments]=useState(0);
  const [referenceShares,setReferenceShares]=useState(0);
  const [referenceReach,setReferenceReach]=useState(0);
  const [newCategory,setNewCategory]=useState("");
  const [syncState,setSyncState]=useState<SyncState>(isSupabaseConfigured?"loading":"local");
  const [generating,setGenerating]=useState(false);
  const [useAI,setUseAI]=useState(false);
  const [editorialProfile,setEditorialProfile]=useState<EditorialProfile|null>(null);
  const [useEditorialProfile,setUseEditorialProfile]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [analyzingProfile,setAnalyzingProfile]=useState(false);
  const [importText,setImportText]=useState("");
  const [importCategory,setImportCategory]=useState("Auto-detectar");
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{ void hydrate(); },[]);
  useEffect(()=>{ if(hydrated){try{localStorage.setItem("efimero-b12",JSON.stringify({categories,library,history,schedule,editorialProfile,useEditorialProfile,autoArchiveGenerated}));}catch{console.warn("No fue posible persistir todo el calendario localmente; las imágenes grandes pueden exceder el límite del navegador.");}} },[hydrated,categories,library,history,schedule,editorialProfile,useEditorialProfile,autoArchiveGenerated]);

  async function hydrate(){
    let hasLocalSchedule=false;
    const local=localStorage.getItem("efimero-b12")||localStorage.getItem("efimero-b8")||localStorage.getItem("efimero-b7")||localStorage.getItem("efimero-b6")||localStorage.getItem("efimero-b5")||localStorage.getItem("efimero-b4")||localStorage.getItem("efimero-b3")||localStorage.getItem("efimero-b2");
    if(local){try{const p=JSON.parse(local);if(p.categories)setCategories(p.categories);if(p.library)setLibrary(p.library);if(p.history)setHistory(p.history);if(p.schedule){setSchedule(p.schedule);hasLocalSchedule=true;}if(typeof p.autoArchiveGenerated==="boolean")setAutoArchiveGenerated(p.autoArchiveGenerated);if(p.editorialProfile){setEditorialProfile(p.editorialProfile);if(typeof p.useEditorialProfile!=="boolean")setUseEditorialProfile(true)}if(typeof p.useEditorialProfile==="boolean")setUseEditorialProfile(p.useEditorialProfile)}catch{}}
    if(!supabase){setSyncState("local");setHydrated(true);return}
    try{
      const [{data:cats,error:catErr},{data:lib,error:libErr},{data:cals,error:calErr}] = await Promise.all([
        supabase.from("efimero_categories").select("id,name,emoji,enabled").order("created_at"),
        supabase.from("efimero_content_library").select("*").order("created_at",{ascending:false}).limit(5000),
        supabase.from("efimero_calendars").select("id,start_date,days,created_at,settings").order("created_at",{ascending:false}).limit(12),
      ]);
      if(catErr||libErr||calErr) throw catErr||libErr||calErr;
      if(cats?.length){setCategories(cats);setSelectedCategories(cats.filter(c=>c.enabled).map(c=>c.name));}
      else await seedCategories();
      if(lib) setLibrary(lib.map((x:any)=>({id:x.id,text:x.text,category:x.category,format:x.format,createdAt:x.created_at,source:(x.source|| (x.status==="historical"?"historical":"manual")) as LibrarySource,sourceUrl:x.source_url||undefined,notes:x.notes||undefined,reactions:Number(x.reactions||0),comments:Number(x.comments||0),shares:Number(x.shares||0),reach:Number(x.reach||0),publishedAt:x.published_at||undefined,performanceScore:Number(x.performance_score||0),favorite:Boolean(x.favorite),generationBatch:x.generation_batch||undefined,platform:x.platform||undefined,platformPostId:x.platform_post_id||undefined,sourcePageId:x.source_page_id||undefined,sourcePageName:x.source_page_name||undefined,sourceImageUrl:x.source_image_url||undefined,extractionMetadata:x.extraction_metadata||undefined,factoryScore:Number(x.factory_score||0)})));
      if(cals) setHistory(cals.map((x:any)=>({id:x.id,createdAt:x.created_at,days:x.days,posts:Number(x.settings?.posts||0),startDate:x.start_date})));
      if(!hasLocalSchedule){
        const {data:scheduled}=await supabase.from("efimero_scheduled_posts").select("*").order("publish_at",{ascending:true}).limit(1000);
        if(scheduled?.length){
          const valid=new Set(["Borrador","Revisión","Aprobado","Programado","Publicado","Error"]);
          setSchedule(scheduled.map((x:any)=>{const raw=String(x.status||"draft");const mapped:any=valid.has(raw)?raw:raw==="approved"?"Aprobado":raw==="scheduled"?"Programado":raw==="published"?"Publicado":raw==="error"?"Error":"Borrador";const at=String(x.publish_at||"");return {id:x.id,date:at.slice(0,10),time:at.slice(11,16)||"12:00",category:x.category,text:x.text,format:x.format||"Texto",status:mapped,similarity:Number(x.similarity_score||0),pageId:x.page_id||undefined,pageName:x.page_name||undefined,metaPostId:x.meta_post_id||undefined,compliance:x.compliance_data||undefined,imageUrl:x.image_url||undefined,publishError:x.publish_error||undefined,autopilot:Boolean(x.autopilot)} as ScheduleItem;}));
        }
      }
      const {data:profiles}=await supabase.from("efimero_editorial_profiles").select("profile").eq("is_active",true).order("created_at",{ascending:false}).limit(1);
      if(profiles?.[0]?.profile)setEditorialProfile(profiles[0].profile as EditorialProfile);
      setSyncState("synced");setHydrated(true);
    }catch(e){console.error(e);setSyncState("error");setHydrated(true)}
  }

  async function seedCategories(){
    if(!supabase)return;
    const payload=initialCategories.map(({name,emoji,enabled})=>({name,emoji,enabled}));
    const {data}=await supabase.from("efimero_categories").upsert(payload,{onConflict:"name"}).select("id,name,emoji,enabled");
    if(data?.length){setCategories(data);setSelectedCategories(data.map(x=>x.name))}
  }

  const effectiveFrequency=frequency===0?Math.max(5,customFrequency):frequency;
  const effectiveDays=days===0?Math.max(7,customDays):days;
  const dailySlots=useMemo(()=>buildSlots(startTime,endTime,effectiveFrequency,skipRanges),[startTime,endTime,effectiveFrequency,skipRanges]);
  const totalPosts=dailySlots.length*effectiveDays;
  const calendarDates=useMemo(()=>Array.from({length:effectiveDays},(_,i)=>addDays(startDate,i)),[effectiveDays,startDate]);
  const visibleDate=calendarDates[Math.min(calendarDay,calendarDates.length-1)]||startDate;
  const visiblePosts=schedule.filter(p=>p.date===visibleDate);
  const duplicates=useMemo(()=>schedule.filter(p=>(p.similarity||0)>=.84).length,[schedule]);

  function toggleCategory(name:string){setSelectedCategories(c=>c.includes(name)?(c.length===1?c:c.filter(x=>x!==name)):[...c,name])}
  function addSkipRange(){setSkipRanges(c=>[...c,{id:crypto.randomUUID(),start:"12:00",end:"13:00"}])}

  async function getAIBank(category:string,count:number){
    if(!useAI)return [] as string[];
    try{
      const examples=library.filter(x=>x.category===category&&x.source!=="reference").slice(0,12).map(x=>x.text);
      const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category,count,examples,profile:useEditorialProfile?editorialProfile:null})});
      if(!r.ok)return [];
      const data=await r.json(); return Array.isArray(data.items)?data.items:[];
    }catch{return []}
  }

  async function reviewScheduleCompliance(items:ScheduleItem[]){
    const reviewed:ScheduleItem[]=[];
    for(let i=0;i<items.length;i+=40){
      const chunk=items.slice(i,i+40);
      try{
        const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texts:chunk.map(x=>x.text)})});
        const data=await r.json();
        const checks=r.ok&&Array.isArray(data.items)?data.items:[];
        reviewed.push(...chunk.map((item,index)=>{const c=checks[index];if(!c)return item;const text=c.status!=="pass"&&c.correctedText?String(c.correctedText):item.text;return {...item,text,compliance:c,status:"Borrador" as const}}));
      }catch{reviewed.push(...chunk)}
    }
    return reviewed;
  }

  async function generateSchedule(){
    const bankCategories=selectedCategories.length?selectedCategories:categories.filter(c=>c.enabled).map(c=>c.name);
    if(!bankCategories.length||!dailySlots.length)return;
    setGenerating(true);
    try{
      const aiBanks:Record<string,string[]>={};
      if(useAI){for(const c of bankCategories){aiBanks[c]=await getAIBank(c,Math.min(30,Math.ceil(totalPosts/bankCategories.length)))}}
      const generated:ScheduleItem[]=[];
      const used=library.map(x=>x.text);
      const categoryPool=useEditorialProfile?weightedCategoryPool(bankCategories,editorialProfile):bankCategories;
      for(let dayIndex=0;dayIndex<effectiveDays;dayIndex++){
        const date=addDays(startDate,dayIndex);
        dailySlots.forEach((minute,slotIndex)=>{
          const category=categoryPool[(dayIndex*Math.max(1,dailySlots.length)+slotIndex)%categoryPool.length];
          const bank=(aiBanks[category]?.length?aiBanks[category]:contentBank[category])||contentBank["Frases identificables"];
          const baseIndex=(dayIndex*3+slotIndex)%bank.length;
          let text=bank[baseIndex]; let attempt=0;
          while(used.some(old=>similarity(old,text)>=.86)&&attempt<bank.length-1){attempt++;text=bank[(baseIndex+attempt)%bank.length]}
          let maxSim=used.reduce((m,old)=>Math.max(m,similarity(old,text)),0);
          if(maxSim>=.9) text=`${text} ${["¿Te pasa?","👀","Hoy hacía falta recordarlo.","Y sí, también cuenta.","¿Quién más?"][(dayIndex+slotIndex)%5]}`;
          maxSim=used.reduce((m,old)=>Math.max(m,similarity(old,text)),0);
          used.push(text);
          const format:"Texto"|"Imagen"=postType==="Imagen"?"Imagen":postType==="Híbrido"&&(slotIndex+dayIndex)%4===1?"Imagen":"Texto";
          generated.push({id:crypto.randomUUID(),date,time:minutesToTime(minute),category,text,format,status:"Borrador",similarity:maxSim});
        });
      }
      const reviewedGenerated=await reviewScheduleCompliance(generated);
      setSchedule(reviewedGenerated);setCalendarDay(0);
      const snapshot={id:crypto.randomUUID(),createdAt:new Date().toISOString(),days:effectiveDays,posts:reviewedGenerated.length,startDate};
      setHistory(c=>[snapshot,...c].slice(0,12));
      if(autoArchiveGenerated){
        const existing=library.map(x=>x.text);
        const generatedLibrary:LibraryItem[]=reviewedGenerated.filter(p=>!existing.some(x=>similarity(x,p.text)>.96)).map(p=>({id:crypto.randomUUID(),text:p.text,category:p.category,format:p.format,createdAt:new Date().toISOString(),source:"generated",generationBatch:snapshot.id}));
        if(generatedLibrary.length)setLibrary(c=>[...generatedLibrary,...c]);
        if(supabase&&generatedLibrary.length){
          const rows=generatedLibrary.map(x=>({text:x.text,category:x.category,format:x.format,status:"generated",source:"generated",fingerprint:fingerprint(x.text),generation_batch:snapshot.id,performance_score:0,favorite:false}));
          for(let i=0;i<rows.length;i+=300) await supabase.from("efimero_content_library").insert(rows.slice(i,i+300));
        }
      }
      if(supabase){
        const {data:cal,error}=await supabase.from("efimero_calendars").insert({name:`Efímero ${startDate}`,start_date:startDate,days:effectiveDays,settings:{posts:reviewedGenerated.length,frequency:effectiveFrequency,postType,skipRanges,useAI,useEditorialProfile,profileSample:editorialProfile?.sampleSize||0}}).select("id").single();
        if(!error&&cal){
          const rows=reviewedGenerated.map(p=>({id:p.id,calendar_id:cal.id,publish_at:`${p.date}T${p.time}:00`,text:p.text,category:p.category,format:p.format,status:"draft",fingerprint:fingerprint(p.text),similarity_score:p.similarity||0}));
          for(let i=0;i<rows.length;i+=300) await supabase.from("efimero_scheduled_posts").insert(rows.slice(i,i+300));
          setSyncState("synced");
        }
      }
      setTab("calendar");
    }finally{setGenerating(false)}
  }

  async function saveToLibrary(item:ScheduleItem){
    if(library.some(e=>similarity(e.text,item.text)>.94))return;
    const localItem:LibraryItem={id:crypto.randomUUID(),text:item.text,category:item.category,format:item.format,createdAt:new Date().toISOString(),source:"generated",favorite:true};
    setLibrary(c=>[localItem,...c]);
    if(supabase){const {data}=await supabase.from("efimero_content_library").insert({text:item.text,category:item.category,format:item.format,status:"saved",source:"generated",fingerprint:fingerprint(item.text),performance_score:0,favorite:true}).select("id,created_at").single();if(data)setLibrary(c=>c.map(x=>x.id===localItem.id?{...x,id:data.id,createdAt:data.created_at}:x))}
  }


  async function saveFactoryItems(items:LibraryItem[]){
    if(!items.length)return;
    setLibrary(current=>{
      const next=[...current];
      for(const item of items){
        const idx=next.findIndex(x=>(item.platformPostId&&x.platformPostId===item.platformPostId)||(!item.platformPostId&&similarity(x.text,item.text)>.985));
        if(idx>=0) next[idx]={...next[idx],...item,id:next[idx].id};
        else next.unshift(item);
      }
      return next;
    });
    if(!supabase)return;
    const rows=items.map(item=>({
      text:item.text,category:item.category,format:item.format,status:item.source==="historical"?"historical":"generated",source:item.source||"generated",
      source_url:item.sourceUrl||null,notes:item.notes||null,reactions:item.reactions||0,comments:item.comments||0,shares:item.shares||0,reach:item.reach||0,
      published_at:item.publishedAt||null,performance_score:item.performanceScore||0,favorite:Boolean(item.favorite),generation_batch:item.generationBatch||null,
      platform:item.platform||null,platform_post_id:item.platformPostId||null,source_page_id:item.sourcePageId||null,source_page_name:item.sourcePageName||null,
      last_synced_at:item.platformPostId?new Date().toISOString():null,fingerprint:fingerprint(item.text),source_image_url:item.sourceImageUrl||null,
      extraction_metadata:item.extractionMetadata||null,factory_score:item.factoryScore||0
    }));
    const withPost=rows.filter(x=>x.platform_post_id);
    const withoutPost=rows.filter(x=>!x.platform_post_id);
    if(withPost.length){const {error}=await supabase.from("efimero_content_library").upsert(withPost,{onConflict:"platform_post_id"});if(error)throw error;}
    if(withoutPost.length){const {error}=await supabase.from("efimero_content_library").insert(withoutPost);if(error)throw error;}
    setSyncState("synced");
  }

  function regenerateItem(id:string){setSchedule(c=>c.map(item=>{if(item.id!==id)return item;const bank=contentBank[item.category]||contentBank["Frases identificables"];const idx=bank.findIndex(t=>normalize(t)===normalize(item.text));return {...item,text:bank[(Math.max(idx,0)+1)%bank.length],status:"Borrador",similarity:0}}))}

  async function addCategory(){
    const name=newCategory.trim();if(!name||categories.some(x=>x.name.toLowerCase()===name.toLowerCase()))return;
    const local={id:crypto.randomUUID(),name,emoji:"✦",enabled:true};setCategories(c=>[...c,local]);setSelectedCategories(c=>[...c,name]);setNewCategory("");
    if(supabase){const {data}=await supabase.from("efimero_categories").insert({name,emoji:"✦",enabled:true}).select("id").single();if(data)setCategories(c=>c.map(x=>x.id===local.id?{...x,id:data.id}:x))}
  }

  async function setCategoryEnabled(category:Category,enabled:boolean){
    setCategories(c=>c.map(x=>x.id===category.id?{...x,enabled}:x));
    setSelectedCategories(c=>enabled?(c.includes(category.name)?c:[...c,category.name]):c.filter(x=>x!==category.name));
    if(supabase&&!category.id.match(/^(identificables|humor|relaciones|nostalgia|preguntas|noche|motivacion|cotidiano)$/)) await supabase.from("efimero_categories").update({enabled}).eq("id",category.id);
    else if(supabase) await supabase.from("efimero_categories").update({enabled}).eq("name",category.name);
  }

  async function removeCategory(category:Category){
    setCategories(c=>c.filter(x=>x.id!==category.id));setSelectedCategories(c=>c.filter(x=>x!==category.name));
    if(supabase) await supabase.from("efimero_categories").delete().eq("id",category.id);
  }

  async function deleteLibraryItem(item:LibraryItem){
    setLibrary(c=>c.filter(x=>x.id!==item.id));
    if(supabase && item.id.includes("-")) await supabase.from("efimero_content_library").delete().eq("id",item.id);
  }

  async function importHistorical(){
    const lines=importText.split(/\r?\n/).map(x=>x.replace(/^[-•\d.)\s]+/,"").trim()).filter(x=>x.length>8);
    const unique=lines.filter((text,i)=>lines.findIndex(x=>similarity(x,text)>.96)===i).filter(text=>!library.some(x=>similarity(x.text,text)>.94));
    if(!unique.length)return;
    const now=new Date().toISOString();
    const localItems=unique.map(text=>({id:crypto.randomUUID(),text,category:importCategory==="Auto-detectar"?detectCategory(text):importCategory,format:"Texto",createdAt:now,source:"historical" as const}));
    setLibrary(c=>[...localItems,...c]);setImportText("");
    if(supabase){const rows=unique.map(text=>({text,category:importCategory==="Auto-detectar"?detectCategory(text):importCategory,format:"Texto",status:"historical",source:"historical",fingerprint:fingerprint(text),performance_score:0,favorite:false}));for(let i=0;i<rows.length;i+=300)await supabase.from("efimero_content_library").insert(rows.slice(i,i+300));await hydrate()}
  }

  async function handleFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;const text=await file.text();
    if(file.name.toLowerCase().endsWith(".csv")){
      const rows=text.split(/\r?\n/).map(r=>r.split(",").map(x=>x.replace(/^"|"$/g,"").trim())).filter(r=>r.length);
      const header=rows[0].map(x=>x.toLowerCase());const idx=header.findIndex(x=>["text","texto","post","contenido","message","mensaje"].includes(x));
      setImportText(rows.slice(idx>=0?1:0).map(r=>r[idx>=0?idx:0]).filter(Boolean).join("\n"));
    }else setImportText(text);
    e.target.value="";
  }

  async function addReference(){
    const text=referenceText.trim(); if(text.length<8)return;
    if(library.some(x=>similarity(x.text,text)>.96))return;
    const score=calcPerformance(referenceReactions,referenceComments,referenceShares,referenceReach);
    const item:LibraryItem={id:crypto.randomUUID(),text,category:detectCategory(text),format:"Texto",createdAt:new Date().toISOString(),source:"reference",sourceUrl:referenceUrl.trim()||undefined,notes:referenceNotes.trim()||extractReferencePattern(text),reactions:referenceReactions,comments:referenceComments,shares:referenceShares,reach:referenceReach,performanceScore:score,favorite:false};
    setLibrary(c=>[item,...c]);
    setReferenceText("");setReferenceUrl("");setReferenceNotes("");setReferenceReactions(0);setReferenceComments(0);setReferenceShares(0);setReferenceReach(0);
    if(supabase){
      const {data}=await supabase.from("efimero_content_library").insert({text:item.text,category:item.category,format:"Texto",status:"reference",source:"reference",source_url:item.sourceUrl||null,notes:item.notes||null,reactions:item.reactions||0,comments:item.comments||0,shares:item.shares||0,reach:item.reach||0,performance_score:item.performanceScore||0,favorite:false,fingerprint:fingerprint(item.text)}).select("id,created_at").single();
      if(data)setLibrary(c=>c.map(x=>x.id===item.id?{...x,id:data.id,createdAt:data.created_at}:x));
    }
  }

  async function toggleFavorite(item:LibraryItem){
    const favorite=!item.favorite;setLibrary(c=>c.map(x=>x.id===item.id?{...x,favorite}:x));
    if(supabase&&item.id.includes("-"))await supabase.from("efimero_content_library").update({favorite}).eq("id",item.id);
  }

  function libraryVisibleItems(){
    const q=librarySearch.trim().toLowerCase();
    let items=library.filter(item=>!q||`${item.text} ${item.category} ${item.notes||""}`.toLowerCase().includes(q));
    if(libraryFilter==="generated")items=items.filter(x=>x.source==="generated");
    if(libraryFilter==="historical")items=items.filter(x=>x.source==="historical"||x.source==="manual");
    if(libraryFilter==="reference")items=items.filter(x=>x.source==="reference");
    if(libraryFilter==="favorites")items=items.filter(x=>x.favorite);
    if(libraryFilter==="top")items=items.filter(x=>(x.performanceScore||0)>0).sort((a,b)=>(b.performanceScore||0)-(a.performanceScore||0));
    return items;
  }

  async function analyzeEditorialMemory(){
    if(!library.length)return null;
    setAnalyzingProfile(true);
    try{
      const ownedForProfile=library.filter(x=>x.source!=="reference");
      let profile=buildEditorialProfile(ownedForProfile);
      if(useAI){
        try{
          const examples=ownedForProfile.filter(x=>x.source!=="generated").slice(0,60).map(x=>({text:x.text,category:x.category}));
          const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({examples,baseProfile:profile})});
          if(r.ok){const data=await r.json();if(data?.profile)profile={...profile,...data.profile,tone:{...profile.tone,...(data.profile.tone||{})},analyzedAt:new Date().toISOString()}}
        }catch{}
      }
      setEditorialProfile(profile);setUseEditorialProfile(true);
      if(supabase){
        await supabase.from("efimero_editorial_profiles").update({is_active:false}).eq("is_active",true);
        await supabase.from("efimero_editorial_profiles").insert({name:"Perfil editorial principal",sample_size:profile.sampleSize,profile,is_active:true});
      }
      return profile;
    }finally{setAnalyzingProfile(false)}
  }

  async function toggleEditorialProfile(value:boolean){
    if(value&&!editorialProfile){const created=await analyzeEditorialMemory();if(!created)return;}
    setUseEditorialProfile(value);
  }

  const syncLabel=syncState==="synced"?"Supabase sincronizado":syncState==="loading"?"Conectando…":syncState==="error"?"Supabase con error":"Modo local";

  return <div className={sidebarCollapsed?"appShell sidebarIsCollapsed":"appShell"}>
    {mobileNav&&<button className="sidebarBackdrop" aria-label="Cerrar menú" onClick={()=>setMobileNav(false)}/>}
    <aside className={`${sidebarCollapsed?"appSidebar collapsed":"appSidebar"} ${mobileNav?"mobileOpen":""}`}>
      <div className="sidebarHeader">
        <div className="brandWrap sidebarBrand"><div className="brandGlyph">E</div><div className="sidebarBrandText"><strong>EFÍMERO</strong><span>CONTENT ENGINE</span></div></div>
        <button className="sidebarCollapseButton desktopSidebarControl" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expandir menú":"Contraer menú"} aria-label={sidebarCollapsed?"Expandir menú":"Contraer menú"}>
          {sidebarCollapsed?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}
        </button>
        <button className="sidebarCollapseButton mobileSidebarClose" onClick={()=>setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button>
      </div>

      <div className="sidebarScroll">
        <SidebarGroup label="Producción" collapsed={sidebarCollapsed}>
          <Nav active={tab==="creator"} onClick={()=>{setTab("creator");setMobileNav(false)}} icon={WandSparkles} label="Crear"/>
          <Nav active={tab==="factory"} onClick={()=>{setTab("factory");setMobileNav(false)}} icon={Zap} label="Fábrica"/>
          <Nav active={tab==="calendar"} onClick={()=>{setTab("calendar");setMobileNav(false)}} icon={CalendarDays} label="Calendario"/>
          <Nav active={tab==="autopilot"} onClick={()=>{setTab("autopilot");setMobileNav(false)}} icon={Sparkles} label="Autopilot"/>
          <Nav active={tab==="queue"} onClick={()=>{setTab("queue");setMobileNav(false)}} icon={ClipboardCheck} label="Bandeja"/>
        </SidebarGroup>

        <SidebarGroup label="Inteligencia" collapsed={sidebarCollapsed}>
          <Nav active={tab==="library"} onClick={()=>{setTab("library");setMobileNav(false)}} icon={Library} label="Biblioteca"/>
          <Nav active={tab==="profile"} onClick={()=>{setTab("profile");setMobileNav(false)}} icon={Fingerprint} label="Huella"/>
          <Nav active={tab==="learning"} onClick={()=>{setTab("learning");setMobileNav(false)}} icon={BrainCircuit} label="Aprendizaje"/>
          <Nav active={tab==="experiments"} onClick={()=>{setTab("experiments");setMobileNav(false)}} icon={FlaskConical} label="Experimentos"/>
          <Nav active={tab==="audience"} onClick={()=>{setTab("audience");setMobileNav(false)}} icon={MessagesSquare} label="Audiencia"/>
          <Nav active={tab==="analytics"} onClick={()=>{setTab("analytics");setMobileNav(false)}} icon={BarChart3} label="Analytics"/>
          <Nav active={tab==="executive"} onClick={()=>{setTab("executive");setMobileNav(false)}} icon={LayoutDashboard} label="Resumen"/>
          <Nav active={tab==="fatigue"} onClick={()=>{setTab("fatigue");setMobileNav(false)}} icon={Gauge} label="Fatiga"/>
        </SidebarGroup>

        <SidebarGroup label="Facebook" collapsed={sidebarCollapsed}>
          <Nav active={tab==="meta"} onClick={()=>{setTab("meta");setMobileNav(false)}} icon={RadioTower} label="Meta"/>
          <Nav active={tab==="compliance"} onClick={()=>{setTab("compliance");setMobileNav(false)}} icon={ShieldCheck} label="Compliance"/>
        </SidebarGroup>

        <SidebarGroup label="Configuración" collapsed={sidebarCollapsed}>
          <Nav active={tab==="categories"} onClick={()=>{setTab("categories");setMobileNav(false)}} icon={Layers3} label="Categorías"/>
          <Nav active={tab==="images"} onClick={()=>{setTab("images");setMobileNav(false)}} icon={ImageIcon} label="Imágenes"/>
          <Nav active={tab==="operations"} onClick={()=>{setTab("operations");setMobileNav(false)}} icon={Activity} label="Operaciones"/>
        </SidebarGroup>
      </div>

      <div className="sidebarFooter">
        <div className={`sidebarSync ${syncState}`}>
          <span className="liveDot"/>
          <div className="sidebarSyncText"><strong>Bloques 17–20</strong><span>{syncLabel}</span></div>
        </div>
        <LogoutButton/>
      </div>
    </aside>

    <header className="mobileTopbar">
      <button className="mobileMenuButton" onClick={()=>setMobileNav(true)} aria-label="Abrir menú"><Menu size={21}/></button>
      <div className="brandWrap"><div className="brandGlyph">E</div><div><strong>EFÍMERO</strong><span>CONTENT ENGINE</span></div></div>
      <div className={`mobileSyncDot ${syncState}`} title={syncLabel}><span className="liveDot"/></div>
    </header>

    <main className="content contentWithSidebar">
      {tab==="creator"&&<>
        <div className="pageIntro compactIntro"><div><span className="overline">AUTOPILOT EDITORIAL</span><h1>Genera y programa textos</h1><p>El flujo principal de Efímero ahora es textual: genera, revisa, aprende y programa copies. Las imágenes siguen disponibles como herramienta secundaria.</p></div><div className="introMetric"><span>Audiencia</span><strong>3.5M</strong><small>seguidores</small></div></div>
        <section className="builderCard">
          <SectionHeader step="01" title="Tipo de publicaciones" note="Elige qué tipo de piezas entran en el calendario."/>
          <div className="optionGrid three"><OptionCard active={postType==="Texto"} onClick={()=>setPostType("Texto")} icon={<FileText/>} title="Solo texto" subtitle="Flujo recomendado · foco principal"/><OptionCard active={postType==="Imagen"} onClick={()=>setPostType("Imagen")} icon={<ImageIcon/>} title="Solo imagen" subtitle="Herramienta secundaria"/><OptionCard active={postType==="Híbrido"} onClick={()=>setPostType("Híbrido")} icon={<Sparkles/>} title="Híbrido" subtitle="Texto primero, imagen cuando aplique"/></div>
          <Divider/><SectionHeader step="02" title="Rango de horas" note="Define la ventana diaria y excluye horas que no quieres usar."/>
          <div className="timeGrid"><Field label="Hora de inicio"><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></Field><div className="timeArrow">→</div><Field label="Hora de fin"><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></Field><div className="slotMetric"><span>Slots diarios</span><strong>{dailySlots.length}</strong></div></div>
          <div className="subCard skipCard"><div className="subCardTitle"><div><X size={18}/><strong>Saltar estas horas</strong><span>Evita comida, madrugada o cualquier bloque específico.</span></div><button className="tinyButton" onClick={addSkipRange}><Plus size={16}/> Rango</button></div><div className="skipList">{skipRanges.map(range=><div className="skipRange" key={range.id}><input type="time" value={range.start} onChange={e=>setSkipRanges(c=>c.map(x=>x.id===range.id?{...x,start:e.target.value}:x))}/><span>hasta</span><input type="time" value={range.end} onChange={e=>setSkipRanges(c=>c.map(x=>x.id===range.id?{...x,end:e.target.value}:x))}/><button onClick={()=>setSkipRanges(c=>c.filter(x=>x.id!==range.id))}><Trash2 size={16}/></button></div>)}</div></div>
          <Divider/><SectionHeader step="03" title="Frecuencia de publicación" note="Elige una cadencia rápida o define tus propios minutos."/>
          <div className="optionGrid three frequencyGrid">{[20,30,60].map(minutes=><button key={minutes} onClick={()=>setFrequency(minutes)} className={frequency===minutes?"frequencyCard active":"frequencyCard"}><strong>Cada {minutes===60?"hora":`${minutes} min`}</strong><span>{minutes===20?"3x por hora":minutes===30?"2x por hora":"1x por hora"}</span></button>)}</div>
          <button onClick={()=>setFrequency(0)} className={frequency===0?"customFrequency active":"customFrequency"}><div><Settings2 size={18}/><span><strong>Frecuencia personalizada</strong><small>Elige tus minutos</small></span></div><input aria-label="Minutos personalizados" type="number" min={5} max={360} value={customFrequency} onClick={e=>e.stopPropagation()} onChange={e=>setCustomFrequency(Number(e.target.value))}/><span>min</span></button>
          <Divider/><SectionHeader step="04" title="Categorías de contenido" note="Usa todas o elige exactamente qué voces quieres mezclar."/>
          <div className="categoryActions"><button className="wideSelect active" onClick={()=>setSelectedCategories(categories.filter(c=>c.enabled).map(c=>c.name))}><Sparkles size={17}/> Todas (aleatorio)</button><button className="wideSelect" onClick={()=>setTab("categories")}><Layers3 size={17}/> Administrar categorías</button></div>
          <div className="chips">{categories.filter(c=>c.enabled).map(category=><button key={category.id} className={selectedCategories.includes(category.name)?"chip selected":"chip"} onClick={()=>toggleCategory(category.name)}><span>{category.emoji}</span>{category.name}<Check size={14}/></button>)}</div>
          <div className="aiStack">
            <div className="aiControl"><div><Sparkles size={19}/><span><strong>Generación con IA</strong><small>Usa ejemplos históricos para crear contenido nuevo. Sin API key, conserva el banco local.</small></span></div><Toggle checked={useAI} onChange={setUseAI} label="IA"/></div>
            <div className="aiControl fingerprintControl"><div><Fingerprint size={19}/><span><strong>Usar huella editorial</strong><small>{editorialProfile?`${editorialProfile.sampleSize} publicaciones analizadas · ${editorialProfile.avgWords} palabras promedio`:"Analiza la biblioteca y replica mezcla, longitud y tono de Efímero."}</small></span></div><Toggle checked={useEditorialProfile} onChange={toggleEditorialProfile} label="Huella editorial"/></div>
            <div className="aiControl archiveControl"><div><Bookmark size={19}/><span><strong>Archivar textos generados</strong><small>Guarda automáticamente cada generación en Biblioteca para reutilizar, filtrar y evitar repetidos.</small></span></div><Toggle checked={autoArchiveGenerated} onChange={setAutoArchiveGenerated} label="Archivo automático"/></div>
          </div>
          <Divider/><SectionHeader step="05" title="Programar a largo plazo" note="Genera contenido para múltiples días consecutivos desde la fecha seleccionada."/>
          <div className="dayButtons">{[7,10,15,20,30].map(amount=><button key={amount} onClick={()=>setDays(amount)} className={days===amount?"dayButton active":"dayButton"}>{amount} días</button>)}<button onClick={()=>setDays(0)} className={days===0?"dayButton active":"dayButton"}>Otro</button></div>
          {days===0&&<div className="customDays"><input type="number" min={7} max={90} value={customDays} onChange={e=>setCustomDays(Number(e.target.value))}/><span>días personalizados</span></div>}
          <div className="longTermGrid"><Field label="Fecha de inicio"><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></Field><div className="dateRange"><span>Rango generado</span><strong>{startDate} → {addDays(startDate,effectiveDays-1)}</strong></div><div className="postsPerDay"><span>Publicaciones/día</span><strong>{dailySlots.length}</strong></div></div>
          <div className="generationSummary"><div><span className="greenDot"/><span>Total en {effectiveDays} días</span><strong>{totalPosts.toLocaleString("es-MX")}</strong></div><div><span>Cadencia</span><strong>{effectiveFrequency} min</strong></div><div><span>Categorías</span><strong>{selectedCategories.length}</strong></div></div>
          <button className="generateButton" onClick={generateSchedule} disabled={generating}><WandSparkles size={20}/><span>{generating?"Generando…":"Generar calendario"}</span><small>{totalPosts} publicaciones</small></button><p className="safetyText"><span className="liveDot"/> Se crean borradores. Antes de aprobarse pasan por Compliance Meta; publicar requiere una acción explícita en Calendario.</p>
        </section>
      </>}

      {tab==="calendar"&&<EditorialCalendar items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])} onOpenCreator={()=>setTab("creator")} onSaveToLibrary={saveToLibrary}/>}

      {tab==="library"&&<>
        <div className="pageIntro"><div><span className="overline">MEMORIA + INSPIRACIÓN</span><h1>Biblioteca editorial</h1><p>Centraliza todo lo que genera la app, el histórico propio de Efímero y referencias externas. Las referencias sirven para extraer patrones; no se usan como copia literal para la IA.</p></div><div className="introMetric"><span>Total</span><strong>{library.length}</strong><small>contenidos</small></div></div>
        <div className="libraryStats"><LibraryMetric label="Generados" value={library.filter(x=>x.source==="generated").length} icon={<Sparkles/>}/><LibraryMetric label="Histórico propio" value={library.filter(x=>x.source==="historical"||x.source==="manual").length} icon={<Database/>}/><LibraryMetric label="Referencias" value={library.filter(x=>x.source==="reference").length} icon={<ExternalLink/>}/><LibraryMetric label="Favoritos" value={library.filter(x=>x.favorite).length} icon={<Star/>}/></div>
        <div className="libraryImportGrid">
          <section className="toolPanel importPanel"><div className="panelTitle"><div><Upload size={20}/><div><h2>Importar histórico propio</h2><p>Pega publicaciones de Efímero o carga TXT/CSV. Este contenido sí puede alimentar la Huella editorial.</p></div></div><button className="outlineButton" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Cargar archivo</button><input ref={fileRef} className="hiddenFile" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleFile}/></div><div className="importControls"><select value={importCategory} onChange={e=>setImportCategory(e.target.value)}><option>Auto-detectar</option>{categories.map(c=><option key={c.id}>{c.name}</option>)}</select><span>{importText.split(/\r?\n/).filter(x=>x.trim().length>8).length} líneas detectadas</span></div><textarea className="importTextarea" value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'Ejemplo:\nA veces extrañar también es recordar quién eras.\n¿En qué momento dejamos de hablar con esa persona?'} /><button className="importButton" onClick={importHistorical} disabled={!importText.trim()}><Database size={17}/> Importar histórico</button></section>
          <section className="toolPanel referencePanel"><div className="panelTitle"><div><Link2 size={20}/><div><h2>Guardar referencia externa</h2><p>Pega manualmente una publicación que te inspiró y, si quieres, sus métricas visibles. Guardaremos también su patrón editorial.</p></div></div></div><textarea className="referenceTextarea" value={referenceText} onChange={e=>setReferenceText(e.target.value)} placeholder="Texto de la publicación de referencia..."/><div className="referenceUrl"><Link2 size={16}/><input value={referenceUrl} onChange={e=>setReferenceUrl(e.target.value)} placeholder="URL de origen (opcional)"/></div><div className="metricInputs"><label><span>Reacciones</span><input type="number" min="0" value={referenceReactions} onChange={e=>setReferenceReactions(Number(e.target.value))}/></label><label><span>Comentarios</span><input type="number" min="0" value={referenceComments} onChange={e=>setReferenceComments(Number(e.target.value))}/></label><label><span>Compartidos</span><input type="number" min="0" value={referenceShares} onChange={e=>setReferenceShares(Number(e.target.value))}/></label><label><span>Alcance</span><input type="number" min="0" value={referenceReach} onChange={e=>setReferenceReach(Number(e.target.value))}/></label></div><textarea className="referenceNotes" value={referenceNotes} onChange={e=>setReferenceNotes(e.target.value)} placeholder="Notas o patrón que quieres conservar (opcional). Si lo dejas vacío, la app genera uno."/><button className="referenceButton" onClick={addReference} disabled={!referenceText.trim()}><Bookmark size={17}/> Guardar como referencia</button></section>
        </div>
        <section className="toolPanel libraryBrowser"><div className="libraryToolbar"><div className="searchBar"><Search size={18}/><input placeholder="Buscar por texto, categoría o patrón..." value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/></div><div className="libraryFilters"><Filter size={16}/>{([['all','Todo'],['generated','Generados'],['historical','Efímero'],['reference','Referencias'],['favorites','Favoritos'],['top','Mejor rendimiento']] as [LibraryFilter,string][]).map(([value,label])=><button key={value} className={libraryFilter===value?'active':''} onClick={()=>setLibraryFilter(value)}>{label}</button>)}</div></div><div className="libraryGrid advanced">{libraryVisibleItems().map(item=><article className={`libraryCard source-${item.source||'manual'}`} key={item.id}><div className="libraryCardHeader"><div className="sourceBadge"><span>{sourceEmoji(item.source)}</span>{sourceLabel(item.source)}</div><button className={item.favorite?"favoriteButton active":"favoriteButton"} onClick={()=>toggleFavorite(item)} aria-label="Favorito"><Star size={17}/></button></div><div className="rowMeta"><span>{item.category}</span>{item.platform==="facebook"&&<b className="facebookBadge">Facebook · {item.sourcePageName||"Efímero"}</b>}{item.extractionMetadata?.method==="vision-ai"&&<b className="visionBadge">Visión IA</b>}{(item.factoryScore||0)>0&&<b className="factoryBadge">{Math.round(item.factoryScore||0)}% alineación</b>}{(item.performanceScore||0)>0&&<b className="performanceBadge"><TrendingUp size={13}/> {item.performanceScore}</b>}<em>{item.format}</em></div><p>{item.text}</p>{item.source==="reference"&&<div className="patternBox"><strong>Patrón extraído</strong><span>{item.notes||extractReferencePattern(item.text)}</span></div>} {(item.reactions||item.comments||item.shares||item.reach)?<div className="miniMetrics"><span>👍 {(item.reactions||0).toLocaleString('es-MX')}</span><span>💬 {(item.comments||0).toLocaleString('es-MX')}</span><span>↗ {(item.shares||0).toLocaleString('es-MX')}</span>{(item.reach||0)>0&&<span>◎ {(item.reach||0).toLocaleString('es-MX')}</span>}</div>:null}<footer><small>{new Date(item.publishedAt||item.createdAt).toLocaleDateString("es-MX")}</small>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Origen</a>}<button onClick={()=>navigator.clipboard?.writeText(item.text)}><Copy size={15}/> Copiar</button><button className="danger" onClick={()=>deleteLibraryItem(item)}><Trash2 size={15}/></button></footer></article>)}{!libraryVisibleItems().length&&<div className="emptyMini"><Library size={30}/><strong>No hay contenidos con este filtro</strong><span>Cambia el filtro o agrega nuevas piezas.</span></div>}</div></section>
      </>}

      {tab==="categories"&&<><div className="pageIntro"><div><span className="overline">VOZ DE LA PÁGINA</span><h1>Categorías de contenido</h1><p>Activa, desactiva o agrega líneas editoriales para Efímero.</p></div></div><section className="toolPanel"><div className="addCategory"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nueva categoría, por ejemplo: Confesiones" onKeyDown={e=>e.key==="Enter"&&addCategory()}/><button onClick={addCategory}><Plus size={18}/> Agregar</button></div><div className="categoryManager">{categories.map(category=><article key={category.id} className={category.enabled?"manageCategory":"manageCategory disabled"}><div className="emojiBox">{category.emoji}</div><div><strong>{category.name}</strong><span>{category.enabled?"Disponible para generación":"Desactivada"}</span></div><Toggle checked={category.enabled} onChange={v=>setCategoryEnabled(category,v)} label={category.name}/>{!initialCategories.some(i=>i.name===category.name)&&<button className="iconDanger" onClick={()=>removeCategory(category)}><Trash2 size={18}/></button>}</article>)}</div></section></>}


      {tab==="profile"&&<><div className="pageIntro"><div><span className="overline">ADN EDITORIAL</span><h1>Huella de Efímero</h1><p>Convierte el histórico de la página en reglas medibles de tono, longitud, estructura y mezcla de categorías para orientar la generación.</p></div><button className="profileAnalyzeButton" onClick={analyzeEditorialMemory} disabled={!library.length||analyzingProfile}><Fingerprint size={18}/>{analyzingProfile?"Analizando…":editorialProfile?"Reanalizar memoria":"Crear huella editorial"}</button></div>{!editorialProfile?<section className="emptyState profileEmpty"><Fingerprint size={44}/><h2>La huella todavía no existe</h2><p>Importa publicaciones históricas en Biblioteca. Con ellas calcularemos patrones reales de Efímero.</p><button onClick={()=>setTab("library")}><Upload size={18}/> Ir a Biblioteca</button></section>:<><div className="profileSummary"><div className="profileHero"><span className="profileBadge"><Fingerprint size={16}/> PERFIL ACTIVO</span><h2>{editorialProfile.summary}</h2><p>{editorialProfile.generationInstruction}</p><div className="profileFreshness"><span>{editorialProfile.sampleSize} publicaciones analizadas</span><span>Actualizado {new Date(editorialProfile.analyzedAt).toLocaleString("es-MX")}</span>{editorialProfile.sampleSize!==(library.filter(x=>x.source==="historical"||x.source==="manual").length||library.filter(x=>x.source!=="reference").length)&&<b>La memoria propia cambió · conviene reanalizar</b>}</div></div><div className="profileToggleCard"><span>Aplicar al generador</span><strong>{useEditorialProfile?"Activada":"Desactivada"}</strong><Toggle checked={useEditorialProfile} onChange={toggleEditorialProfile} label="Huella editorial"/></div></div><div className="fingerprintMetrics"><ProfileMetric icon={<TypeIcon/>} label="Longitud media" value={`${editorialProfile.avgWords} palabras`} note={`${editorialProfile.avgChars} caracteres`}/><ProfileMetric icon={<MessageCircle/>} label="Publicaciones pregunta" value={pct(editorialProfile.questionRate)} note="interacción conversacional"/><ProfileMetric icon={<Smile/>} label="Uso de emojis" value={pct(editorialProfile.emojiRate)} note="presencia en el histórico"/><ProfileMetric icon={<Zap/>} label="Contenido corto" value={pct(editorialProfile.shortRate)} note="120 caracteres o menos"/></div><div className="profileColumns"><section className="toolPanel tonePanel"><div className="panelTitle"><div><Fingerprint size={20}/><div><h2>Mapa de tono</h2><p>Señales estimadas a partir de texto, categorías y estructuras repetidas.</p></div></div></div><ToneBar label="Reflexivo" value={editorialProfile.tone.reflective}/><ToneBar label="Emocional" value={editorialProfile.tone.emotional}/><ToneBar label="Conversacional" value={editorialProfile.tone.conversational}/><ToneBar label="Humor ligero" value={editorialProfile.tone.humorous}/></section><section className="toolPanel distributionPanel"><div className="panelTitle"><div><Layers3 size={20}/><div><h2>Mezcla editorial</h2><p>Cuando la huella está activa, esta proporción guía la rotación de categorías.</p></div></div></div>{editorialProfile.topCategories.map(c=><DistributionBar key={c.name} name={c.name} count={c.count} share={c.share}/>)}</section></div><div className="profileColumns"><section className="toolPanel"><div className="panelTitle"><div><Check size={20}/><div><h2>Patrones a conservar</h2><p>Reglas que pasan automáticamente al contexto del generador.</p></div></div></div><div className="ruleList">{editorialProfile.rules.map((r,i)=><div key={i} className="ruleItem positive"><span>{i+1}</span><p>{r}</p></div>)}</div></section><section className="toolPanel"><div className="panelTitle"><div><X size={20}/><div><h2>Evitar</h2><p>Guardrails para que la salida no se sienta genérica o artificial.</p></div></div></div><div className="ruleList">{editorialProfile.avoid.map((r,i)=><div key={i} className="ruleItem negative"><span>×</span><p>{r}</p></div>)}</div></section></div><section className="toolPanel languagePanel"><div className="languageGroup"><span>Palabras frecuentes</span><div className="wordCloud">{editorialProfile.topWords.map(w=><b key={w}>{w}</b>)}</div></div><div className="languageGroup"><span>Inicios recurrentes</span><div className="wordCloud hooks">{editorialProfile.hooks.map(h=><b key={h}>“{h}…”</b>)}</div></div></section></>}</>}


      {tab==="factory"&&<TextFactory library={library} editorialProfile={editorialProfile} onSaveItems={saveFactoryItems} onOpenLibrary={()=>setTab("library")}/>}

      {tab==="learning"&&<PerformanceLearning library={library} onOpenFactory={()=>setTab("factory")}/>}

      {tab==="experiments"&&<CopyExperiments library={library} onSaveItems={saveFactoryItems}/>}

      {tab==="audience"&&<AudienceVoice onSaveItems={saveFactoryItems}/>}

      {tab==="executive"&&<ExecutiveDashboard library={library} schedule={schedule} onOpenFactory={()=>setTab("factory")} onOpenLearning={()=>setTab("learning")}/>}

      {tab==="autopilot"&&<AutopilotPanel library={library} editorialProfile={editorialProfile} onQueue={(items:any[])=>{setSchedule(current=>[...current,...items] as ScheduleItem[]);setTab("calendar")}}/>}

      {tab==="images"&&<ImageStudio library={library} onQueue={(item:any)=>{setSchedule(current=>[...current,item] as ScheduleItem[]);setTab("calendar")}}/>}

      {tab==="meta"&&<MetaPanel existingPostIds={library.map(x=>x.platformPostId).filter(Boolean) as string[]} onImported={(items:any[])=>setLibrary(current=>{const ids=new Set(current.map(x=>x.platformPostId).filter(Boolean));const fresh=items.filter(x=>!ids.has(x.platformPostId));return [...fresh,...current]})}/>}

      {tab==="analytics"&&<FacebookAnalytics library={library} toolStats={{calendars:history.length,scheduled:schedule.length,library:library.length,duplicates}} onOpenMeta={()=>setTab("meta")}/>}

      {tab==="queue"&&<TextQueue items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])} onOpenCalendar={()=>setTab("calendar")}/>}

      {tab==="fatigue"&&<FatigueRadar library={library} schedule={schedule}/>}

      {tab==="compliance"&&<ComplianceCenter items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])}/>}

      {tab==="operations"&&<OperationsCenter schedule={schedule} library={library}/>}
    </main>
  </div>
}

function buildSlots(startTime:string,endTime:string,frequency:number,skipRanges:SkipRange[]){const start=timeToMinutes(startTime),end=timeToMinutes(endTime);if(end<start||frequency<=0)return[];const slots:number[]=[];for(let minute=start;minute<=end;minute+=frequency){if(!skipRanges.some(r=>minute>=timeToMinutes(r.start)&&minute<=timeToMinutes(r.end)))slots.push(minute)}return slots}
function SidebarGroup({label,collapsed,children}:{label:string;collapsed:boolean;children:any}){return <section className="sidebarGroup"><div className="sidebarGroupLabel" aria-hidden={collapsed}>{label}</div><div className="sidebarGroupItems">{children}</div></section>}

function Nav({active,onClick,icon:Icon,label}:{active:boolean;onClick:()=>void;icon:any;label:string}){return <button title={label} className={active?"navItem active":"navItem"} onClick={onClick}><Icon size={17}/><span>{label}</span></button>}
function SectionHeader({step,title,note}:{step:string;title:string;note:string}){return <div className="sectionHeader"><span>{step}</span><div><h2>{title}</h2><p>{note}</p></div></div>}
function OptionCard({active,onClick,icon,title,subtitle}:{active:boolean;onClick:()=>void;icon:React.ReactNode;title:string;subtitle:string}){return <button className={active?"optionCard active":"optionCard"} onClick={onClick}><div className="optionIcon">{icon}</div><strong>{title}</strong><span>{subtitle}</span>{active&&<i><Check size={13}/></i>}</button>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Divider(){return <div className="divider"/>}
function EmptyState({onClick}:{onClick:()=>void}){return <section className="emptyState"><CalendarDays size={38}/><h2>Crea tu primer calendario</h2><p>Elige horarios, frecuencia, categorías y número de días.</p><button onClick={onClick}><WandSparkles size={18}/> Abrir generador</button></section>}
function StatCard({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <article className="statCard"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function ProfileMetric({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}){return <article className="profileMetric"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function ToneBar({label,value}:{label:string;value:number}){return <div className="toneRow"><div><span>{label}</span><strong>{pct(value)}</strong></div><div className="toneTrack"><i style={{width:pct(value)}}/></div></div>}
function DistributionBar({name,count,share}:{name:string;count:number;share:number}){return <div className="distributionRow"><div><span>{name}</span><strong>{count}</strong></div><div className="distributionTrack"><i style={{width:pct(share)}}/></div><small>{pct(share)} de la memoria</small></div>}
function LibraryMetric({label,value,icon}:{label:string;value:number;icon:React.ReactNode}){return <article className="libraryMetric"><div>{icon}</div><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></article>}
function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){return <button type="button" role="switch" aria-checked={checked} aria-label={`Activar ${label}`} className={checked?"toggleControl on":"toggleControl"} onClick={()=>onChange(!checked)}><span className="toggleKnob"/><span className="toggleText">{checked?"ON":"OFF"}</span></button>}
