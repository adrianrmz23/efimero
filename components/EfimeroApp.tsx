"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Activity, BarChart3, Bookmark, BrainCircuit, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, ClipboardCheck, Clock3, Copy, Database, Film,
  ExternalLink, FileText, Filter, Fingerprint, Flame, FlaskConical, Gauge, Image as ImageIcon, Layers3, LayoutDashboard, Library, Link2, Menu, MessageCircle, MessagesSquare, Plus, RefreshCw, RadioTower, ShieldCheck,
  Palette, Search, Settings2, Smile, Sparkles, Star, Trash2, TrendingUp, Type as TypeIcon, Upload, WandSparkles, X, Zap,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import MetaPanel from "@/components/MetaPanel";
import FacebookAnalytics from "@/components/FacebookAnalytics";
import TextFactory from "@/components/TextFactory";
import EditorialCalendar from "@/components/EditorialCalendar";
import PerformanceLearning from "@/components/PerformanceLearning";
import CopyExperiments from "@/components/CopyExperiments";
import ExecutiveDashboard from "@/components/ExecutiveDashboard";
import TextQueue from "@/components/TextQueue";
import ComplianceCenter from "@/components/ComplianceCenter";
import PublishingScheduler from "@/components/PublishingScheduler";
import LearningLoop from "@/components/LearningLoop";
import EditorialDataset from "@/components/EditorialDataset";
import WeeklyReport from "@/components/WeeklyReport";
import InspirationRadar from "@/components/InspirationRadar";
import LearningAgent from "@/components/LearningAgent";
import AdsManager from "@/components/AdsManager";
import ReelStudio from "@/components/ReelStudio";
import ControlCenter from "@/components/ControlCenter";
import SystemHealth from "@/components/SystemHealth";
import QuickPostStudio from "@/components/QuickPostStudio";
import PrayerReelGenerator from "@/components/PrayerReelGenerator";
import SinglePostScheduler from "@/components/SinglePostScheduler";
import BulkImageScheduler from "@/components/BulkImageScheduler";
import BulkTextScheduler from "@/components/BulkTextScheduler";
import MetaScheduledQueue from "@/components/MetaScheduledQueue";
import ReelManager from "@/components/ReelManager";
import NicheLab from "@/components/NicheLab";
import CreativeStudio from "@/components/CreativeStudio";
import type { SheetRow } from "@/lib/spreadsheetImport";
import type { CreativeQueueItem } from "@/lib/creativeStudio";
import { initialCategories, pad, timeToMinutes, toISODate, addDays, normalize, similarity, fingerprint, clamp, pct, emojiPattern, stopWords, buildEditorialProfile, detectCategory, calcPerformance, sourceLabel, sourceEmoji, extractReferencePattern } from "@/lib/editorial";
import type { Category, LibrarySource, LibraryFilter, LibraryItem, ProfileCategory, ToneScores, EditorialProfile } from "@/lib/editorial";
import HomeDashboard from "@/components/HomeDashboard";
import LibraryView from "@/components/LibraryView";
import { CategoriesView, ProfileView } from "@/components/EditorialViews";
import CommandPalette from "@/components/CommandPalette";
import { navGroups, sectionForTab, settingsSection, type NavSection } from "@/lib/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import { useConfirm, useToast } from "@/components/ui/DialogProvider";
import { PagesProvider, usePages } from "@/lib/pagesContext";

type Tab = "home" | "health" | "niches" | "creativeStudio" | "creator" | "publisher" | "bulkTexts" | "bulkImages" | "metaQueue" | "reels" | "calendar" | "library" | "categories" | "profile" | "factory" | "learning" | "experiments" | "executive" | "meta" | "analytics" | "queue" | "compliance" | "scheduler" | "loop" | "dataset" | "weekly" | "radar" | "learningAgent" | "ads" | "reelStudio" | "control";
type ScheduleItem = { id:string; date:string; time:string; category:string; text:string; format:"Texto"|"Imagen"; status:"Borrador"|"Revisión"|"Aprobado"|"Programado"|"Publicado"|"Error"; similarity?:number; imageDataUrl?:string; imageUrl?:string; pageId?:string; pageName?:string; metaPostId?:string; compliance?:any; publishError?:string; autopilot?:boolean };
type CalendarSnapshot = { id:string; createdAt:string; days:number; posts:number; startDate:string; pageId?:string };
type SyncState = "local"|"loading"|"synced"|"error";
export default function EfimeroApp(){
  return <PagesProvider><EfimeroShell/></PagesProvider>;
}

function EfimeroShell(){
  const [tab,setTab]=useState<Tab>("home");
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [creativeHandoff,setCreativeHandoff]=useState<CreativeQueueItem[]>([]);
  const [studioRows,setStudioRows]=useState<{rows:SheetRow[];source:string;nonce:number}|null>(null);
  const [publisherPrefill,setPublisherPrefill]=useState<{text:string;category:string;nonce:number}|null>(null);
  useEffect(()=>{
    const section=new URLSearchParams(window.location.search).get("section") as Tab|null;
    const allowed:Tab[]=["home","health","niches","creativeStudio","creator","publisher","bulkTexts","bulkImages","metaQueue","reels","calendar","library","categories","profile","factory","learning","experiments","executive","meta","analytics","queue","compliance","scheduler","loop","dataset","weekly","radar","learningAgent","ads","reelStudio","control"];
    if(section&&allowed.includes(section))setTab(section);
  },[]);
  // Refleja la sección en la URL para poder recargar o compartir el enlace.
  useEffect(()=>{
    const url=new URL(window.location.href);
    if(tab==="home")url.searchParams.delete("section");else url.searchParams.set("section",tab);
    window.history.replaceState(null,"",url);
  },[tab]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setPaletteOpen(v=>!v)}};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);
  const [mobileNav,setMobileNav]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  // Páginas y página activa vienen del contexto compartido.
  const {pages:workspacePages,activePageId:workspacePageId,setActivePage}=usePages();
  const confirm=useConfirm();const toast=useToast();
  const [categories,setCategories]=useState<Category[]>(initialCategories);
  const [selectedCategories,setSelectedCategories]=useState(initialCategories.map(x=>x.name));
  const [allSchedule,setAllSchedule]=useState<ScheduleItem[]>([]);
  const [allLibrary,setAllLibrary]=useState<LibraryItem[]>([]);
  // Los datos no etiquetados del ZIP anterior permanecen intactos, sin repartirse a otras páginas.
  const schedule=useMemo(()=>allSchedule.filter(item=>!workspacePageId?!item.pageId:item.pageId===workspacePageId),[allSchedule,workspacePageId]);
  const library=useMemo(()=>allLibrary.filter(item=>!workspacePageId?!(item.pageId||item.sourcePageId):(item.pageId||item.sourcePageId)===workspacePageId),[allLibrary,workspacePageId]);
  function setSchedule(next:ScheduleItem[]|((current:ScheduleItem[])=>ScheduleItem[])){
    setAllSchedule(all=>{
      const visible=all.filter(item=>!workspacePageId?!item.pageId:item.pageId===workspacePageId);
      const replacement=typeof next==="function"?next(visible):next;
      const others=all.filter(item=>workspacePageId?item.pageId!==workspacePageId:!!item.pageId);
      return [...others,...replacement.map(item=>({...item,pageId:workspacePageId||undefined,pageName:workspacePages.find(p=>p.id===workspacePageId)?.name||item.pageName}))];
    });
  }
  function setLibrary(next:LibraryItem[]|((current:LibraryItem[])=>LibraryItem[])){
    setAllLibrary(all=>{
      const visible=all.filter(item=>!workspacePageId?!(item.pageId||item.sourcePageId):(item.pageId||item.sourcePageId)===workspacePageId);
      const replacement=typeof next==="function"?next(visible):next;
      const others=all.filter(item=>workspacePageId?(item.pageId||item.sourcePageId)!==workspacePageId:!!(item.pageId||item.sourcePageId));
      return [...others,...replacement.map(item=>({...item,pageId:item.pageId||workspacePageId||undefined}))];
    });
  }
  const [allHistory,setAllHistory]=useState<CalendarSnapshot[]>([]);
  const history=useMemo(()=>allHistory.filter(item=>!workspacePageId?!item.pageId:item.pageId===workspacePageId),[allHistory,workspacePageId]);
  function setHistory(next:CalendarSnapshot[]|((current:CalendarSnapshot[])=>CalendarSnapshot[])){
    setAllHistory(all=>{
      const visible=all.filter(item=>!workspacePageId?!item.pageId:item.pageId===workspacePageId);
      const replacement=typeof next==="function"?next(visible):next;
      return [...all.filter(item=>workspacePageId?item.pageId!==workspacePageId:!!item.pageId),...replacement.map(item=>({...item,pageId:workspacePageId||undefined}))];
    });
  }
  const [autoArchiveGenerated,setAutoArchiveGenerated]=useState(true);
  const [syncState,setSyncState]=useState<SyncState>(isSupabaseConfigured?"loading":"local");
  const [editorialProfile,setEditorialProfile]=useState<EditorialProfile|null>(null);
  const [useEditorialProfile,setUseEditorialProfile]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [analyzingProfile,setAnalyzingProfile]=useState(false);

  useEffect(()=>{ void hydrate(); },[]);
  useEffect(()=>{
    if(!hydrated)return;
    const onVisible=()=>{if(document.visibilityState==="visible")void syncScheduleFromSupabase().then(()=>setSyncState("synced")).catch(()=>setSyncState("error"))};
    document.addEventListener("visibilitychange",onVisible);
    return()=>document.removeEventListener("visibilitychange",onVisible);
  },[hydrated]);
  useEffect(()=>{ if(hydrated){try{localStorage.setItem("efimero-b12",JSON.stringify({categories,library:allLibrary,history:allHistory,schedule:allSchedule,editorialProfile,useEditorialProfile,autoArchiveGenerated}));}catch{console.warn("No fue posible persistir todo el calendario localmente; las imágenes grandes pueden exceder el límite del navegador.");}} },[hydrated,categories,allLibrary,allHistory,allSchedule,editorialProfile,useEditorialProfile,autoArchiveGenerated]);

  // Supabase es la fuente de verdad de lo programado; localStorage solo es una caché para pintar rápido.
  // Gana Supabase en cada id y se conservan las piezas que solo existen en este navegador (borradores sin guardar).
  const validStatuses=new Set(["Borrador","Revisión","Aprobado","Programado","Publicado","Error"]);
  const scheduledRowToItem=((x:any)=>{const raw=String(x.status||"draft");const mapped:any=validStatuses.has(raw)?raw:raw==="approved"?"Aprobado":raw==="scheduled"?"Programado":raw==="published"?"Publicado":raw==="error"?"Error":"Borrador";const at=String(x.publish_at||"");return {id:x.id,date:at.slice(0,10),time:at.slice(11,16)||"12:00",category:x.category,text:x.text,format:x.format||"Texto",status:mapped,similarity:Number(x.similarity_score||0),pageId:x.page_id||undefined,pageName:x.page_name||undefined,metaPostId:x.meta_post_id||undefined,compliance:x.compliance_data||undefined,imageUrl:x.image_url||undefined,publishError:x.publish_error||undefined,autopilot:Boolean(x.autopilot)} as ScheduleItem;});
  async function syncScheduleFromSupabase(){
    if(!supabase)return;
    const since=new Date(Date.now()-45*86400000).toISOString();
    const {data:scheduled,error}=await supabase.from("efimero_scheduled_posts").select("*").gte("publish_at",since.slice(0,19)).order("publish_at",{ascending:true}).limit(3000);
    if(error)throw error;
    const remote:ScheduleItem[]=(scheduled||[]).map(scheduledRowToItem);
    const remoteIds=new Set(remote.map(x=>x.id));
    const remoteMeta=new Set(remote.map(x=>x.metaPostId).filter(Boolean));
    setAllSchedule(current=>[...remote.map(r=>{const local=current.find(x=>x.id===r.id);return local?.imageDataUrl&&!r.imageUrl?{...r,imageDataUrl:local.imageDataUrl}:r}),...current.filter(x=>!remoteIds.has(x.id)&&!(x.metaPostId&&remoteMeta.has(x.metaPostId)))]);
  }
  async function hydrate(){
    // Solo se usa la clave actual; las de versiones anteriores se migran una vez y se borran.
    const legacyKeys=["efimero-b8","efimero-b7","efimero-b6","efimero-b5","efimero-b4","efimero-b3","efimero-b2"];
    const local=localStorage.getItem("efimero-b12")||legacyKeys.map(k=>localStorage.getItem(k)).find(Boolean)||null;
    try{legacyKeys.forEach(k=>localStorage.removeItem(k))}catch{}
    if(local){try{const p=JSON.parse(local);if(p.categories)setCategories(p.categories);if(p.library)setAllLibrary(p.library);if(p.history)setAllHistory(p.history);if(p.schedule)setAllSchedule(p.schedule);if(typeof p.autoArchiveGenerated==="boolean")setAutoArchiveGenerated(p.autoArchiveGenerated);if(p.editorialProfile){setEditorialProfile(p.editorialProfile);if(typeof p.useEditorialProfile!=="boolean")setUseEditorialProfile(true)}if(typeof p.useEditorialProfile==="boolean")setUseEditorialProfile(p.useEditorialProfile)}catch{}}
    if(!supabase){setSyncState("local");setHydrated(true);return}
    try{
      const [{data:cats,error:catErr},{data:lib,error:libErr},{data:cals,error:calErr}] = await Promise.all([
        supabase.from("efimero_categories").select("id,name,emoji,enabled").order("created_at"),
        supabase.from("efimero_content_library").select("*").order("created_at",{ascending:false}).limit(5000),
        supabase.from("efimero_calendars").select("id,start_date,days,created_at,settings,page_id").order("created_at",{ascending:false}).limit(12),
      ]);
      if(catErr||libErr||calErr) throw catErr||libErr||calErr;
      if(cats?.length){setCategories(cats);setSelectedCategories(cats.filter(c=>c.enabled).map(c=>c.name));}
      else await seedCategories();
      if(lib) setAllLibrary(lib.map((x:any)=>({id:x.id,text:x.text,category:x.category,format:x.format,createdAt:x.created_at,source:(x.source|| (x.status==="historical"?"historical":"manual")) as LibrarySource,sourceUrl:x.source_url||undefined,notes:x.notes||undefined,reactions:Number(x.reactions||0),comments:Number(x.comments||0),shares:Number(x.shares||0),reach:Number(x.reach||0),publishedAt:x.published_at||undefined,performanceScore:Number(x.performance_score||0),favorite:Boolean(x.favorite),generationBatch:x.generation_batch||undefined,platform:x.platform||undefined,platformPostId:x.platform_post_id||undefined,sourcePageId:x.source_page_id||undefined,sourcePageName:x.source_page_name||undefined,pageId:x.page_id||undefined,sourceImageUrl:x.source_image_url||undefined,extractionMetadata:x.extraction_metadata||undefined,factoryScore:Number(x.factory_score||0)})));
      if(cals) setAllHistory(cals.map((x:any)=>({id:x.id,createdAt:x.created_at,days:x.days,posts:Number(x.settings?.posts||0),startDate:x.start_date,pageId:x.page_id||undefined})));
      await syncScheduleFromSupabase();
      // El perfil activo se carga por página mediante efecto, no desde el perfil global.
      setSyncState("synced");setHydrated(true);
    }catch(e){console.error(e);setSyncState("error");setHydrated(true)}
  }

  useEffect(()=>{
    if(!hydrated)return;
    let current=true;
    setEditorialProfile(null);setUseEditorialProfile(false);
    if(supabase){
      const query=supabase.from("efimero_editorial_profiles").select("profile").eq("is_active",true).order("created_at",{ascending:false}).limit(1);
      (workspacePageId?query.eq("page_id",workspacePageId):query.is("page_id",null)).then(({data})=>{
        if(current&&data?.[0]?.profile){setEditorialProfile(data[0].profile as EditorialProfile);setUseEditorialProfile(true)}
      });
    }
    return()=>{current=false};
  },[workspacePageId,hydrated]);

  async function seedCategories(){
    if(!supabase)return;
    const payload=initialCategories.map(({name,emoji,enabled})=>({name,emoji,enabled}));
    const {data}=await supabase.from("efimero_categories").upsert(payload,{onConflict:"name"}).select("id,name,emoji,enabled");
    if(data?.length){setCategories(data);setSelectedCategories(data.map(x=>x.name))}
  }

  const today=toISODate(new Date());
  const duplicates=useMemo(()=>schedule.filter(p=>(p.similarity||0)>=.84).length,[schedule]);





  async function saveToLibrary(item:ScheduleItem,favorite=false){
    if(library.some(e=>similarity(e.text,item.text)>.94))return;
    const localItem:LibraryItem={id:crypto.randomUUID(),text:item.text,category:item.category,format:item.format,createdAt:new Date().toISOString(),source:"generated",favorite,pageId:workspacePageId||undefined};
    setLibrary(c=>[localItem,...c]);
    if(supabase){const {data}=await supabase.from("efimero_content_library").insert({text:item.text,category:item.category,format:item.format,status:"saved",source:"generated",fingerprint:fingerprint(item.text),performance_score:0,favorite,page_id:workspacePageId||null}).select("id,created_at").single();if(data)setLibrary(c=>c.map(x=>x.id===localItem.id?{...x,id:data.id,createdAt:data.created_at}:x))}
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
      text:item.text,category:item.category,format:item.format,status:item.source==="historical"?"historical":item.source==="reference"?"reference":"generated",source:item.source||"generated",
      source_url:item.sourceUrl||null,notes:item.notes||null,reactions:item.reactions||0,comments:item.comments||0,shares:item.shares||0,reach:item.reach||0,
      published_at:item.publishedAt||null,performance_score:item.performanceScore||0,favorite:Boolean(item.favorite),generation_batch:item.generationBatch||null,
      platform:item.platform||null,platform_post_id:item.platformPostId||null,page_id:item.pageId||item.sourcePageId||workspacePageId||null,source_page_id:item.sourcePageId||null,source_page_name:item.sourcePageName||null,
      last_synced_at:item.platformPostId?new Date().toISOString():null,fingerprint:fingerprint(item.text),source_image_url:item.sourceImageUrl||null,
      extraction_metadata:item.extractionMetadata||null,factory_score:item.factoryScore||0
    }));
    const withPost=rows.filter(x=>x.platform_post_id);
    const withoutPost=rows.filter(x=>!x.platform_post_id);
    if(withPost.length){const {error}=await supabase.from("efimero_content_library").upsert(withPost,{onConflict:"platform_post_id"});if(error)throw error;}
    if(withoutPost.length){const {error}=await supabase.from("efimero_content_library").insert(withoutPost);if(error)throw error;}
    setSyncState("synced");
  }


  async function addCategory(newCategory:string){
    const name=newCategory.trim();if(!name||categories.some(x=>x.name.toLowerCase()===name.toLowerCase()))return;
    const local={id:crypto.randomUUID(),name,emoji:"✦",enabled:true};setCategories(c=>[...c,local]);setSelectedCategories(c=>[...c,name]);
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


  async function analyzeEditorialMemory(){
    if(!library.length)return null;
    setAnalyzingProfile(true);
    try{
      const ownedForProfile=library.filter(x=>x.source!=="reference");
      const profile=buildEditorialProfile(ownedForProfile);
      setEditorialProfile(profile);setUseEditorialProfile(true);
      if(supabase){
        const query=supabase.from("efimero_editorial_profiles").update({is_active:false}).eq("is_active",true);
        await (workspacePageId?query.eq("page_id",workspacePageId):query.is("page_id",null));
        await supabase.from("efimero_editorial_profiles").insert({name:"Perfil editorial principal",page_id:workspacePageId||null,sample_size:profile.sampleSize,profile,is_active:true});
      }
      return profile;
    }finally{setAnalyzingProfile(false)}
  }

  async function toggleEditorialProfile(value:boolean){
    if(value&&!editorialProfile){const created=await analyzeEditorialMemory();if(!created)return;}
    setUseEditorialProfile(value);
  }

  const syncLabel=syncState==="synced"?"Supabase sincronizado":syncState==="loading"?"Conectando…":syncState==="error"?"Supabase con error":"Modo local";
  const workspacePage=workspacePages.find(p=>p.id===workspacePageId);
  const unassignedLibraryCount=allLibrary.filter(p=>!p.pageId&&!p.sourcePageId).length;
  const unassignedScheduleCount=allSchedule.filter(p=>!p.pageId).length;
  async function assignLegacyToPage(){
    if(!workspacePageId||(!unassignedLibraryCount&&!unassignedScheduleCount))return;
    if(!await confirm({title:`Asignar a ${workspacePage?.name||"esta página"}`,description:`${unassignedLibraryCount} textos y ${unassignedScheduleCount} publicaciones sin página pasarán a ${workspacePage?.name||"esta página"}. No se publica nada.`,confirmLabel:"Asignar"}))return;
    if(supabase){
      const [{error:a},{error:b}]=await Promise.all([
        supabase.from("efimero_content_library").update({page_id:workspacePageId}).is("page_id",null).is("source_page_id",null),
        supabase.from("efimero_scheduled_posts").update({page_id:workspacePageId,page_name:workspacePage?.name||null}).is("page_id",null),
      ]);
      if(a||b){toast(`No se pudieron asignar los datos en Supabase: ${a?.message||b?.message}`,"error");return;}
    }
    setAllLibrary(all=>all.map(x=>!x.pageId&&!x.sourcePageId?{...x,pageId:workspacePageId}:x));
    setAllSchedule(all=>all.map(x=>!x.pageId?{...x,pageId:workspacePageId,pageName:workspacePage?.name}:x));
  }
  async function changeWorkspacePage(value:string){await setActivePage(value)}
  const activeSection=sectionForTab(tab);
  function goToSection(section:NavSection){setTab(section.tabs[0].tab as Tab);setMobileNav(false)}

  return <div className={sidebarCollapsed?"appShell sidebarIsCollapsed":"appShell"}>
    {mobileNav&&<button className="sidebarBackdrop" aria-label="Cerrar menú" onClick={()=>setMobileNav(false)}/>}
    <aside className={`${sidebarCollapsed?"appSidebar collapsed":"appSidebar"} ${mobileNav?"mobileOpen":""}`}>
      <div className="sidebarHeader">
        <div className="brandWrap sidebarBrand"><div className="brandGlyph">E</div><div className="sidebarBrandText"><strong>Efímero</strong><span>Content engine</span></div></div>
        <button className="sidebarCollapseButton desktopSidebarControl" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expandir menú":"Contraer menú"} aria-label={sidebarCollapsed?"Expandir menú":"Contraer menú"}>
          {sidebarCollapsed?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}
        </button>
        <button className="sidebarCollapseButton mobileSidebarClose" onClick={()=>setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button>
      </div>

      <label className="pageSwitcher" title="Cambiar página activa">
        <span className="pageAvatar">{(workspacePage?.name||"?").trim().charAt(0).toUpperCase()}</span>
        <span className="pageSwitcherText"><strong>{workspacePage?.name||(workspacePages.length?"Elige una página":"Sin páginas")}</strong><small>{workspacePages.length?"Página activa":"Conecta Facebook en Ajustes"}</small></span>
        <ChevronsUpDown size={15} className="pageSwitcherIcon"/>
        <select aria-label="Página activa" value={workspacePageId} onChange={e=>void changeWorkspacePage(e.target.value)} disabled={!workspacePages.length}><option value="">{workspacePages.length?"Selecciona una página":"Conecta Facebook primero"}</option>{workspacePages.map(page=><option value={page.id} key={page.id}>{formatPageLabel(page)}</option>)}</select>
      </label>

      <button className="sidebarSearch" onClick={()=>{setPaletteOpen(true);setMobileNav(false)}} title="Buscar (Ctrl K)"><Search size={16}/><span>Buscar</span><kbd>Ctrl K</kbd></button>

      <nav className="sidebarScroll" aria-label="Navegación principal">
        {navGroups.map((group,index)=><SidebarGroup key={group.label||index} label={group.label} collapsed={sidebarCollapsed}>
          {group.sections.map(section=><Nav key={section.id} active={activeSection.id===section.id} onClick={()=>goToSection(section)} icon={section.icon} label={section.label}/>)}
        </SidebarGroup>)}
      </nav>

      <div className="sidebarFooter">
        <Nav active={activeSection.id===settingsSection.id} onClick={()=>goToSection(settingsSection)} icon={settingsSection.icon} label={settingsSection.label}/>
        <div className={`sidebarSync ${syncState}`} title={syncLabel}>
          <span className="liveDot"/>
          <div className="sidebarSyncText"><strong>{syncLabel}</strong><span>Efímero v1.9</span></div>
        </div>
        <LogoutButton/>
      </div>
    </aside>

    <header className="mobileTopbar">
      <button className="mobileMenuButton" onClick={()=>setMobileNav(true)} aria-label="Abrir menú"><Menu size={21}/></button>
      <div className="mobileTitle"><strong>{activeSection.label}</strong><span>{workspacePage?.name||"Sin página activa"}</span></div>
      <button className="mobileMenuButton" onClick={()=>setPaletteOpen(true)} aria-label="Buscar"><Search size={19}/></button>
    </header>

    <CommandPalette open={paletteOpen} onClose={()=>setPaletteOpen(false)} onNavigate={next=>{setTab(next as Tab);setMobileNav(false)}}/>

    <main className={`content contentWithSidebar ${tab==="calendar"?"calendarWide":""}`}>
      {!!workspacePageId&&(unassignedLibraryCount>0||unassignedScheduleCount>0)&&<div className="legacyNotice"><span>Hay {unassignedLibraryCount} textos y {unassignedScheduleCount} entradas de calendario anteriores sin página asignada. No se mezclan con las páginas nuevas.</span><button onClick={()=>void assignLegacyToPage()}>Asignar a {workspacePage?.name}</button></div>}
      {activeSection.tabs.length>1&&<div className="sectionTabs" role="tablist" aria-label={activeSection.label}>
        {activeSection.tabs.map(t=><button key={t.tab} role="tab" aria-selected={tab===t.tab} className={tab===t.tab?"active":""} onClick={()=>setTab(t.tab as Tab)}>{t.label}</button>)}
      </div>}
      {activeSection.id===settingsSection.id&&tab!=="control"&&<button className="backLink" onClick={()=>setTab("control")}><ChevronLeft size={15}/> Centro de control</button>}
      {tab==="home"&&<HomeDashboard schedule={schedule} pageName={workspacePage?.name} pageId={workspacePageId} onNavigate={next=>setTab(next as Tab)} onOpenSearch={()=>setPaletteOpen(true)}/>}
      {tab==="niches"&&<NicheLab pages={workspacePages} activePageId={workspacePageId} onChoosePage={value=>void changeWorkspacePage(value)}/>}
      {tab==="creativeStudio"&&<CreativeStudio pages={workspacePages} pageId={workspacePageId} onChoosePage={value=>void changeWorkspacePage(value)} onSendToBulk={items=>{setCreativeHandoff(items);setTab("bulkImages")}} incoming={studioRows}/>}
      {tab==="creator"&&<>
        <QuickPostStudio categories={categories} library={library} editorialProfile={useEditorialProfile?editorialProfile:null} onSaveItems={saveFactoryItems} onSchedule={({text,category})=>{setPublisherPrefill({text,category,nonce:Date.now()});setTab("publisher")}}/>
        <PrayerReelGenerator/>
      </>}

      {tab==="publisher"&&<SinglePostScheduler categories={categories} prefill={publisherPrefill} onAdd={(item:any)=>setSchedule(current=>{const without=current.filter(x=>x.id!==item.id);return [item,...without] as ScheduleItem[]})} onSaveFavorite={(item:any)=>saveFactoryItems([item])}/>}

      {tab==="bulkTexts"&&<BulkTextScheduler onAddMany={(items:any[])=>setSchedule(current=>{const byId=new Map(current.map(x=>[x.id,x]));for(const item of items)byId.set(item.id,item as ScheduleItem);return Array.from(byId.values()) as ScheduleItem[]})}/>}

      {tab==="bulkImages"&&<BulkImageScheduler importedCreatives={creativeHandoff} onImported={()=>setCreativeHandoff([])} onAddMany={(items:any[])=>setSchedule(current=>{const byId=new Map(current.map(x=>[x.id,x]));for(const item of items)byId.set(item.id,item as ScheduleItem);return Array.from(byId.values()) as ScheduleItem[]})}/>}

      {tab==="metaQueue"&&<MetaScheduledQueue onCancelled={(metaIds)=>setSchedule(current=>current.filter(item=>!item.metaPostId||!metaIds.includes(item.metaPostId)))}/>}
      {tab==="reels"&&<ReelManager/>}

      {tab==="calendar"&&<EditorialCalendar items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])} onOpenCreator={()=>setTab("creator")} onSaveToLibrary={saveToLibrary}/>}

      {tab==="library"&&<LibraryView library={library} setLibrary={setLibrary} categories={categories} pageId={workspacePageId} onReload={hydrate}/>}
      {tab==="categories"&&<CategoriesView categories={categories} onAdd={addCategory} onToggle={setCategoryEnabled} onRemove={removeCategory}/>}
      {tab==="profile"&&<ProfileView library={library} profile={editorialProfile} analyzing={analyzingProfile} active={useEditorialProfile} onAnalyze={analyzeEditorialMemory} onToggle={toggleEditorialProfile} onOpenLibrary={()=>setTab("library")}/>}
      {tab==="factory"&&<TextFactory library={library} editorialProfile={editorialProfile} onSaveItems={saveFactoryItems} onOpenLibrary={()=>setTab("library")}/>}

      {tab==="learning"&&<PerformanceLearning library={library} onOpenFactory={()=>setTab("factory")}/>}

      {tab==="experiments"&&<CopyExperiments library={library} onSaveItems={saveFactoryItems}/>}

      {tab==="executive"&&<ExecutiveDashboard library={library} schedule={schedule} onOpenFactory={()=>setTab("factory")} onOpenLearning={()=>setTab("learning")}/>}

      {tab==="meta"&&<MetaPanel existingPostIds={library.map(x=>x.platformPostId).filter(Boolean) as string[]} onImported={(items:any[])=>setLibrary(current=>{const ids=new Set(current.map(x=>x.platformPostId).filter(Boolean));const fresh=items.filter(x=>!ids.has(x.platformPostId));return [...fresh,...current]})}/>}

      {tab==="analytics"&&<FacebookAnalytics library={library} toolStats={{calendars:history.length,scheduled:schedule.length,library:library.length,duplicates}} onOpenMeta={()=>setTab("meta")}/>}

      {tab==="queue"&&<TextQueue items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])} onOpenCalendar={()=>setTab("calendar")}/>}

      {tab==="compliance"&&<ComplianceCenter items={schedule} onChange={(items:any[])=>setSchedule(items as ScheduleItem[])}/>}

      {tab==="scheduler"&&<PublishingScheduler/>}

      {tab==="loop"&&<LearningLoop/>}

      {tab==="dataset"&&<EditorialDataset/>}

      {tab==="weekly"&&<WeeklyReport/>}

      {tab==="radar"&&<InspirationRadar library={library} onSaveItems={saveFactoryItems} onOpenLearningAgent={()=>setTab("learningAgent")}/>}

      {tab==="learningAgent"&&<LearningAgent onSaveItems={saveFactoryItems} onQueue={(items:any[])=>{setSchedule(current=>[...current,...items] as ScheduleItem[]);setTab("queue")}} onOpenRadar={()=>setTab("radar")} onSendToStudio={rows=>{setStudioRows({rows,source:"Learning Agent",nonce:Date.now()});setTab("creativeStudio")}}/>}

      {tab==="health"&&<SystemHealth schedule={schedule} library={library}/>}
      {tab==="ads"&&<AdsManager/>}
      {tab==="reelStudio"&&<ReelStudio/>}
      {tab==="control"&&<ControlCenter onNavigate={(next)=>setTab(next as Tab)}/>}

    </main>
  </div>
}

function SidebarGroup({label,collapsed,children}:{label?:string;collapsed:boolean;children:any}){return <section className="sidebarGroup">{label&&<div className="sidebarGroupLabel" aria-hidden={collapsed}>{label}</div>}<div className="sidebarGroupItems">{children}</div></section>}

function Nav({active,onClick,icon:Icon,label}:{active:boolean;onClick:()=>void;icon:any;label:string}){return <button title={label} className={active?"navItem active":"navItem"} onClick={onClick}><Icon size={17}/><span>{label}</span></button>}
function LibraryMetric({label,value}:{label:string;value:number}){return <div className="insKpi"><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
