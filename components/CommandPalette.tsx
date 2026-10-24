"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { navGroups, settingsSection } from "@/lib/navigation";
import { controlGroups } from "@/components/ControlCenter";

type Entry = { tab:string; label:string; group:string; keywords:string };
type Props = { open:boolean; onClose:()=>void; onNavigate:(tab:string)=>void };

const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");

const entries:Entry[]=(()=>{
  const seen=new Set<string>();
  const list:Entry[]=[];
  for(const section of [...navGroups.flatMap(g=>g.sections),settingsSection])for(const t of section.tabs){
    if(seen.has(t.tab))continue;seen.add(t.tab);
    list.push({tab:t.tab,label:section.tabs.length>1?`${section.label} · ${t.label}`:t.label,group:section.id==="settings"?"Ajustes":"Ir a",keywords:normalize(`${section.label} ${t.label}`)});
  }
  for(const group of controlGroups)for(const tool of group.tools){
    if(seen.has(tool.tab))continue;seen.add(tool.tab);
    list.push({tab:tool.tab,label:tool.title,group:group.title,keywords:normalize(`${tool.title} ${tool.description} ${group.title}`)});
  }
  return list;
})();

export default function CommandPalette({open,onClose,onNavigate}:Props){
  const [query,setQuery]=useState("");
  const [cursor,setCursor]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  const results=useMemo(()=>{const q=normalize(query.trim());return q?entries.filter(e=>q.split(/\s+/).every(w=>e.keywords.includes(w))):entries},[query]);

  useEffect(()=>{if(open){setQuery("");setCursor(0);requestAnimationFrame(()=>inputRef.current?.focus())}},[open]);
  useEffect(()=>{setCursor(0)},[query]);
  if(!open)return null;

  function choose(entry?:Entry){if(!entry)return;onNavigate(entry.tab);onClose()}
  function onKeyDown(e:React.KeyboardEvent){
    if(e.key==="ArrowDown"){e.preventDefault();setCursor(c=>Math.min(results.length-1,c+1))}
    else if(e.key==="ArrowUp"){e.preventDefault();setCursor(c=>Math.max(0,c-1))}
    else if(e.key==="Enter"){e.preventDefault();choose(results[cursor])}
    else if(e.key==="Escape"){e.preventDefault();onClose()}
  }

  let lastGroup="";
  return <div className="paletteBackdrop" onMouseDown={onClose}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar en Efímero" onMouseDown={e=>e.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="paletteSearch"><Search size={17}/><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pantallas y herramientas" aria-label="Buscar"/><kbd>Esc</kbd></div>
      <div className="paletteList" role="listbox">
        {results.map((entry,index)=>{const header=entry.group!==lastGroup?entry.group:"";lastGroup=entry.group;return <div key={entry.tab}>
          {header&&<div className="paletteGroup">{header}</div>}
          <button role="option" aria-selected={index===cursor} className={index===cursor?"paletteItem active":"paletteItem"} onMouseEnter={()=>setCursor(index)} onClick={()=>choose(entry)}><span>{entry.label}</span>{index===cursor&&<CornerDownLeft size={14}/>}</button>
        </div>})}
        {!results.length&&<div className="paletteEmpty">Sin resultados para “{query}”.</div>}
      </div>
    </div>
  </div>;
}
