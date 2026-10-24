"use client";

import { ChangeEvent, useRef, useState } from "react";
import {
  Archive, Activity, BarChart3, Bookmark, BrainCircuit, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, ClipboardCheck, Clock3, Copy, Database, Film,
  ExternalLink, FileText, Filter, Fingerprint, Flame, FlaskConical, Gauge, Image as ImageIcon, Layers3, LayoutDashboard, Library, Link2, Menu, MessageCircle, MessagesSquare, Plus, RefreshCw, RadioTower, ShieldCheck,
  Palette, Search, Settings2, Smile, Sparkles, Star, Trash2, TrendingUp, Type as TypeIcon, Upload, WandSparkles, X, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calcPerformance, detectCategory, extractReferencePattern, fingerprint, similarity, sourceEmoji, sourceLabel } from "@/lib/editorial";
import type { Category, LibraryFilter, LibraryItem } from "@/lib/editorial";

type Props = {
  library:LibraryItem[];
  setLibrary:(next:LibraryItem[]|((current:LibraryItem[])=>LibraryItem[]))=>void;
  categories:Category[];
  pageId:string;
  onReload:()=>Promise<void>|void;
};

// Biblioteca editorial: búsqueda, filtros, importación de histórico y referencias externas.
export default function LibraryView({library,setLibrary,categories,pageId:workspacePageId,onReload}:Props){
  const [librarySearch,setLibrarySearch]=useState("");
  const [libraryFilter,setLibraryFilter]=useState<LibraryFilter>("all");
  const [referenceText,setReferenceText]=useState("");
  const [referenceUrl,setReferenceUrl]=useState("");
  const [referenceNotes,setReferenceNotes]=useState("");
  const [referenceReactions,setReferenceReactions]=useState(0);
  const [referenceComments,setReferenceComments]=useState(0);
  const [referenceShares,setReferenceShares]=useState(0);
  const [referenceReach,setReferenceReach]=useState(0);
  const [importText,setImportText]=useState("");
  const [importCategory,setImportCategory]=useState("Auto-detectar");
  const fileRef=useRef<HTMLInputElement>(null);

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
    if(supabase){const rows=unique.map(text=>({text,category:importCategory==="Auto-detectar"?detectCategory(text):importCategory,format:"Texto",status:"historical",source:"historical",page_id:workspacePageId||null,fingerprint:fingerprint(text),performance_score:0,favorite:false}));for(let i=0;i<rows.length;i+=300)await supabase.from("efimero_content_library").insert(rows.slice(i,i+300));await onReload()}
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
      const {data}=await supabase.from("efimero_content_library").insert({text:item.text,category:item.category,format:"Texto",status:"reference",source:"reference",source_url:item.sourceUrl||null,notes:item.notes||null,reactions:item.reactions||0,comments:item.comments||0,shares:item.shares||0,reach:item.reach||0,performance_score:item.performanceScore||0,page_id:workspacePageId||null,favorite:false,fingerprint:fingerprint(item.text)}).select("id,created_at").single();
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

  return <div className="ins">
        <div className="pageIntro"><div><span className="overline">MEMORIA</span><h1>Biblioteca</h1><p>Todo lo que genera la app, el histórico propio y las referencias externas. Las referencias solo aportan patrones; la IA no las copia.</p></div></div>
        <section className="insKpis">
          <LibraryMetric label="Total" value={library.length}/>
          <LibraryMetric label="Generados" value={library.filter(x=>x.source==="generated").length}/>
          <LibraryMetric label="Histórico propio" value={library.filter(x=>x.source==="historical"||x.source==="manual").length}/>
          <LibraryMetric label="Referencias" value={library.filter(x=>x.source==="reference").length}/>
          <LibraryMetric label="Favoritos" value={library.filter(x=>x.favorite).length}/>
        </section>
        <div className="insLibLayout">
          <section className="insCard insFlush insLibMain">
            <div className="insLibToolbar">
              <div className="insSearch"><Search size={16}/><input type="search" aria-label="Buscar en la biblioteca" placeholder="Buscar por texto, categoría o patrón" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/></div>
              <div className="segmented compact insFilterTabs" role="group" aria-label="Filtrar biblioteca">{([['all','Todo'],['generated','Generados'],['historical','Propios'],['reference','Referencias'],['favorites','Favoritos'],['top','Mejor rendimiento']] as [LibraryFilter,string][]).map(([value,label])=><button key={value} type="button" className={libraryFilter===value?'active':''} aria-pressed={libraryFilter===value} onClick={()=>setLibraryFilter(value)}>{label}</button>)}</div>
            </div>
            {(()=>{const items=libraryVisibleItems();return <>
              <div className="insListMeta">{items.length.toLocaleString("es-MX")} {items.length===1?"resultado":"resultados"}</div>
              {items.length?<ul className="insLibList">{items.map(item=><li className="insLibRow" key={item.id}>
                <div className="insLibBody">
                  <div className="insLibMeta">
                    <span className={`statusPill tone-${item.source==="generated"?"accent":"neutral"}`}>{sourceLabel(item.source)}</span>
                    <span className="m">{item.category}</span>
                    {item.format&&<span className="m">{item.format}</span>}
                    {item.platform==="facebook"&&<span className="m">Facebook · {item.sourcePageName||"Efímero"}</span>}
                    {item.extractionMetadata?.method==="vision-ai"&&<span className="m">Visión IA</span>}
                    {(item.factoryScore||0)>0&&<span className="m">{Math.round(item.factoryScore||0)}% alineación</span>}
                    {(item.performanceScore||0)>0&&<span className="m insScore"><TrendingUp size={12}/> {item.performanceScore}</span>}
                  </div>
                  <p className="insLibText">{item.text}</p>
                  {item.source==="reference"&&<p className="insLibPattern"><b>Patrón</b>{item.notes||extractReferencePattern(item.text)}</p>}
                  <div className="insLibFoot">
                    <span>{new Date(item.publishedAt||item.createdAt).toLocaleDateString("es-MX")}</span>
                    {(item.reactions||item.comments||item.shares||item.reach)?<span>{(item.reactions||0).toLocaleString('es-MX')} reacciones · {(item.comments||0).toLocaleString('es-MX')} comentarios · {(item.shares||0).toLocaleString('es-MX')} compartidos{(item.reach||0)>0?` · ${(item.reach||0).toLocaleString('es-MX')} alcance`:""}</span>:null}
                    {item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={12}/> Origen</a>}
                  </div>
                </div>
                <div className="insLibActions">
                  <button type="button" className={item.favorite?"insIconBtn insFav active":"insIconBtn insFav"} onClick={()=>toggleFavorite(item)} aria-pressed={!!item.favorite} aria-label={item.favorite?"Quitar de favoritos":"Marcar como favorito"} title={item.favorite?"Quitar de favoritos":"Marcar como favorito"}><Star size={15}/></button>
                  <button type="button" className="insIconBtn" onClick={()=>navigator.clipboard?.writeText(item.text)} aria-label="Copiar texto" title="Copiar texto"><Copy size={15}/></button>
                  <button type="button" className="insIconBtn insDanger" onClick={()=>deleteLibraryItem(item)} aria-label="Eliminar" title="Eliminar"><Trash2 size={15}/></button>
                </div>
              </li>)}</ul>:<div className="insEmpty insEmptyLarge"><Library size={20}/><strong>No hay contenidos con este filtro</strong><span>Cambia el filtro o agrega nuevas piezas desde el panel lateral.</span></div>}
            </>})()}
          </section>
          <aside className="insLibSide">
            <details className="insDrawer">
              <summary><span className="insDrawerIcon"><Upload size={16}/></span><span className="insDrawerTitle"><strong>Importar histórico</strong><small>Pega textos o carga un TXT/CSV</small></span><ChevronRight size={16} className="insChevron"/></summary>
              <div className="insDrawerBody">
                <p className="insHint">Lo que importes aquí alimenta la Huella editorial.</p>
                <label className="insField"><span>Categoría</span><select value={importCategory} onChange={e=>setImportCategory(e.target.value)}><option>Auto-detectar</option>{categories.map(c=><option key={c.id}>{c.name}</option>)}</select></label>
                <label className="insField"><span>Publicaciones <small>una por línea</small></span><textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'A veces extrañar también es recordar quién eras.\n¿En qué momento dejamos de hablar con esa persona?'} /><small className="insCounter">{importText.split(/\r?\n/).filter(x=>x.trim().length>8).length} líneas detectadas</small></label>
                <input ref={fileRef} className="hiddenFile" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleFile}/>
                <div className="insDrawerActions"><button type="button" className="uiBtn uiBtnGhost" onClick={()=>fileRef.current?.click()}><FileText size={16}/> Cargar archivo</button><button type="button" className="uiBtn uiBtnSecondary" onClick={importHistorical} disabled={!importText.trim()}><Database size={16}/> Importar</button></div>
              </div>
            </details>
            <details className="insDrawer">
              <summary><span className="insDrawerIcon"><Link2 size={16}/></span><span className="insDrawerTitle"><strong>Guardar referencia</strong><small>Una publicación externa que te inspiró</small></span><ChevronRight size={16} className="insChevron"/></summary>
              <div className="insDrawerBody">
                <label className="insField"><span>Texto</span><textarea value={referenceText} onChange={e=>setReferenceText(e.target.value)} placeholder="Texto de la publicación de referencia"/></label>
                <label className="insField"><span>URL de origen <small>opcional</small></span><input value={referenceUrl} onChange={e=>setReferenceUrl(e.target.value)} placeholder="https://"/></label>
                <fieldset className="insFieldset"><legend>Métricas visibles <small>opcional</small></legend><div className="insMetricInputs"><label className="insField"><span>Reacciones</span><input type="number" min="0" value={referenceReactions} onChange={e=>setReferenceReactions(Number(e.target.value))}/></label><label className="insField"><span>Comentarios</span><input type="number" min="0" value={referenceComments} onChange={e=>setReferenceComments(Number(e.target.value))}/></label><label className="insField"><span>Compartidos</span><input type="number" min="0" value={referenceShares} onChange={e=>setReferenceShares(Number(e.target.value))}/></label><label className="insField"><span>Alcance</span><input type="number" min="0" value={referenceReach} onChange={e=>setReferenceReach(Number(e.target.value))}/></label></div></fieldset>
                <label className="insField"><span>Patrón a conservar <small>opcional</small></span><textarea className="insShort" value={referenceNotes} onChange={e=>setReferenceNotes(e.target.value)} placeholder="Si lo dejas vacío, la app lo genera."/></label>
                <button type="button" className="uiBtn uiBtnSecondary wide" onClick={addReference} disabled={!referenceText.trim()}><Bookmark size={16}/> Guardar referencia</button>
              </div>
            </details>
          </aside>
        </div>
      </div>;
}

function LibraryMetric({label,value}:{label:string;value:number}){return <div className="insKpi"><span>{label}</span><strong>{value.toLocaleString("es-MX")}</strong></div>}
