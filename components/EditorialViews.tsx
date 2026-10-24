"use client";

import { useState } from "react";
import {
  Archive, Activity, BarChart3, Bookmark, BrainCircuit, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, ClipboardCheck, Clock3, Copy, Database, Film,
  ExternalLink, FileText, Filter, Fingerprint, Flame, FlaskConical, Gauge, Image as ImageIcon, Layers3, LayoutDashboard, Library, Link2, Menu, MessageCircle, MessagesSquare, Plus, RefreshCw, RadioTower, ShieldCheck,
  Palette, Search, Settings2, Smile, Sparkles, Star, Trash2, TrendingUp, Type as TypeIcon, Upload, WandSparkles, X, Zap,
} from "lucide-react";
import { initialCategories, pct } from "@/lib/editorial";
import type { Category, EditorialProfile, LibraryItem } from "@/lib/editorial";

// Vistas de Categorías y Huella editorial; el estado vive en EfimeroApp porque lo usan los generadores.
export function CategoriesView({categories,onAdd,onToggle,onRemove}:{categories:Category[];onAdd:(name:string)=>Promise<void>|void;onToggle:(category:Category,enabled:boolean)=>void;onRemove:(category:Category)=>void}){
  const [newCategory,setNewCategory]=useState("");
  async function submit(){await onAdd(newCategory);setNewCategory("")}
  return <div className="ins">
        <div className="pageIntro"><div><span className="overline">VOZ DE LA PÁGINA</span><h1>Categorías</h1><p>Activa, desactiva o agrega las líneas editoriales que usa el generador.</p></div></div>
        <section className="insCard insFlush">
          <div className="insCardHead"><div><Layers3 size={16}/><div><h2>Líneas editoriales</h2><p>{categories.filter(c=>c.enabled).length} de {categories.length} activas</p></div></div></div>
          <div className="insAddRow"><input aria-label="Nueva categoría" value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nueva categoría, por ejemplo: Confesiones" onKeyDown={e=>e.key==="Enter"&&submit()}/><button type="button" className="uiBtn uiBtnSecondary" onClick={submit}><Plus size={16}/> Agregar</button></div>
          <ul className="insCatList">{categories.map(category=><li key={category.id} className={category.enabled?"insCatRow":"insCatRow off"}>
            <span className="insEmoji" aria-hidden="true">{category.emoji}</span>
            <div className="insCatText"><strong>{category.name}</strong><small>{category.enabled?"Disponible para generar":"Desactivada"}</small></div>
            <Toggle checked={category.enabled} onChange={v=>onToggle(category,v)} label={category.name}/>
            {!initialCategories.some(i=>i.name===category.name)?<button type="button" className="insIconBtn insDanger" onClick={()=>onRemove(category)} aria-label={`Eliminar ${category.name}`} title="Eliminar"><Trash2 size={15}/></button>:<span className="insIconSpacer" aria-hidden="true"/>}
          </li>)}</ul>
        </section>
      </div>;
}

export function ProfileView({library,profile,analyzing,active,onAnalyze,onToggle,onOpenLibrary}:{library:LibraryItem[];profile:EditorialProfile|null;analyzing:boolean;active:boolean;onAnalyze:()=>void;onToggle:(value:boolean)=>void;onOpenLibrary:()=>void}){
  return <div className="ins">
        <div className="pageIntro"><div><span className="overline">ADN EDITORIAL</span><h1>Huella editorial</h1><p>Convierte el histórico de la página en reglas medibles de tono, longitud, estructura y mezcla de categorías para orientar la generación.</p></div><button className="uiBtn uiBtnPrimary" onClick={onAnalyze} disabled={!library.length||analyzing}><Fingerprint size={16}/> {analyzing?"Analizando…":profile?"Reanalizar memoria":"Crear huella editorial"}</button></div>
        {!profile?<section className="insCard"><div className="insEmpty insEmptyLarge"><Fingerprint size={22}/><strong>Aún no hay huella editorial</strong><span>Importa publicaciones históricas en Biblioteca y crea la huella para calcular los patrones reales de la página.</span><button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenLibrary}><Upload size={16}/> Ir a Biblioteca</button></div></section>:<>
          <section className="insCard insProfileHero">
            <div className="insProfileSummary">
              <div className="insTags"><span className="statusPill tone-accent">Perfil activo</span>{profile.sampleSize!==(library.filter(x=>x.source==="historical"||x.source==="manual").length||library.filter(x=>x.source!=="reference").length)&&<span className="statusPill tone-warning">La memoria cambió · conviene reanalizar</span>}</div>
              <h2>{profile.summary}</h2>
              <p>{profile.generationInstruction}</p>
              <small>{profile.sampleSize} publicaciones analizadas · Actualizado {new Date(profile.analyzedAt).toLocaleString("es-MX")}</small>
            </div>
            <div className="insProfileSwitch"><div><strong>Aplicar al generador</strong><small>{active?"Activada":"Desactivada"}</small></div><Toggle checked={active} onChange={onToggle} label="Huella editorial"/></div>
          </section>
          <section className="insKpis">
            <ProfileMetric label="Longitud media" value={`${profile.avgWords} palabras`} note={`${profile.avgChars} caracteres`}/>
            <ProfileMetric label="Preguntas" value={pct(profile.questionRate)} note="Publicaciones conversacionales"/>
            <ProfileMetric label="Uso de emojis" value={pct(profile.emojiRate)} note="Presencia en el histórico"/>
            <ProfileMetric label="Contenido corto" value={pct(profile.shortRate)} note="120 caracteres o menos"/>
          </section>
          <div className="insGrid2">
            <section className="insCard"><div className="insCardHead"><div><Fingerprint size={16}/><div><h2>Tono</h2><p>Estimado a partir de texto, categorías y estructuras repetidas.</p></div></div></div><div className="insBars"><ToneBar label="Reflexivo" value={profile.tone.reflective}/><ToneBar label="Emocional" value={profile.tone.emotional}/><ToneBar label="Conversacional" value={profile.tone.conversational}/><ToneBar label="Humor ligero" value={profile.tone.humorous}/></div></section>
            <section className="insCard"><div className="insCardHead"><div><Layers3 size={16}/><div><h2>Mezcla editorial</h2><p>Con la huella activa, guía la rotación de categorías.</p></div></div></div><div className="insBars">{profile.topCategories.map(c=><DistributionBar key={c.name} name={c.name} count={c.count} share={c.share}/>)}</div></section>
          </div>
          <div className="insGrid2">
            <section className="insCard"><div className="insCardHead"><div><Check size={16}/><div><h2>Conservar</h2><p>Pasan automáticamente al contexto del generador.</p></div></div></div><ol className="insSteps">{profile.rules.map((r,i)=><li key={i}><span>{i+1}</span><p>{r}</p></li>)}</ol></section>
            <section className="insCard"><div className="insCardHead"><div><X size={16}/><div><h2>Evitar</h2><p>Para que el resultado no suene genérico ni artificial.</p></div></div></div><ul className="insSteps insAvoid">{profile.avoid.map((r,i)=><li key={i}><span><X size={12}/></span><p>{r}</p></li>)}</ul></section>
          </div>
          <section className="insCard insLanguage">
            <div><h3>Palabras frecuentes</h3><div className="insChips">{profile.topWords.map(w=><span key={w}>{w}</span>)}</div></div>
            <div><h3>Inicios recurrentes</h3><div className="insChips">{profile.hooks.map(h=><span key={h}>“{h}…”</span>)}</div></div>
          </section>
        </>}
      </div>;
}

function ProfileMetric({label,value,note}:{label:string;value:string;note:string}){return <div className="insKpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function ToneBar({label,value}:{label:string;value:number}){return <div className="insBar"><div className="insBarLabel"><span>{label}</span></div><div className="insBarTrack"><i style={{width:pct(value)}}/></div><strong>{pct(value)}</strong></div>}
function DistributionBar({name,count,share}:{name:string;count:number;share:number}){return <div className="insBar"><div className="insBarLabel"><span>{name}</span><small>{count} {count===1?"publicación":"publicaciones"}</small></div><div className="insBarTrack"><i style={{width:pct(share)}}/></div><strong>{pct(share)}</strong></div>}
function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){return <button type="button" role="switch" aria-checked={checked} aria-label={`Activar ${label}`} className={checked?"toggleControl on":"toggleControl"} onClick={()=>onChange(!checked)}><span className="toggleKnob"/><span className="toggleText">{checked?"ON":"OFF"}</span></button>}
