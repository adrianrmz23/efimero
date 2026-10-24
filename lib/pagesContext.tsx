"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { persistWorkingPage, resolveWorkingPageId, WORKING_PAGE_EVENT } from "@/lib/workingPage";

// Única fuente de las páginas de Facebook y de la página activa para toda la app.
export type MetaPage = { id:string; name:string; followers_count?:number|null; fan_count?:number|null; category?:string|null; picture?:string|null };
type PagesState = {
  pages:MetaPage[];
  activePageId:string;
  activePage?:MetaPage;
  loading:boolean;
  error:string;
  setActivePage:(pageId:string)=>Promise<void>;
  refresh:()=>Promise<void>;
};

const PagesContext = createContext<PagesState|null>(null);

function normalize(x:any):MetaPage{
  return {
    id:String(x.id||x.page_id),
    name:String(x.name||x.page_name||"Página"),
    followers_count:typeof x.followers_count==="number"?x.followers_count:null,
    fan_count:typeof x.fan_count==="number"?x.fan_count:null,
    category:x.category??null,
    picture:typeof x.picture==="string"?x.picture:x.picture?.data?.url??null,
  };
}

export function PagesProvider({children}:{children:React.ReactNode}){
  const [pages,setPages]=useState<MetaPage[]>([]);
  const [activePageId,setActivePageId]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/meta/pages",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"No fue posible cargar las páginas.");
      const list=(d.pages||[]).map(normalize);
      setPages(list);
      const resolved=resolveWorkingPageId(list,d.activePageId);
      setActivePageId(resolved);
      if(resolved)void persistWorkingPage(resolved);
    }catch(e:any){setError(e?.message||"No fue posible cargar las páginas.")}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void refresh()},[refresh]);
  // Componentes que todavía escuchan el evento (p. ej. Bulk de imágenes) se mantienen sincronizados.
  useEffect(()=>{
    const onWorkingPage=(event:Event)=>{const value=(event as CustomEvent<{pageId:string}>).detail?.pageId;if(typeof value==="string")setActivePageId(value)};
    window.addEventListener(WORKING_PAGE_EVENT,onWorkingPage);
    return()=>window.removeEventListener(WORKING_PAGE_EVENT,onWorkingPage);
  },[]);

  const setActivePage=useCallback(async(pageId:string)=>{setActivePageId(pageId);await persistWorkingPage(pageId)},[]);
  const value=useMemo(()=>({pages,activePageId,activePage:pages.find(p=>p.id===activePageId),loading,error,setActivePage,refresh}),[pages,activePageId,loading,error,setActivePage,refresh]);
  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>;
}

export function usePages(){
  const ctx=useContext(PagesContext);
  if(!ctx)throw new Error("usePages debe usarse dentro de <PagesProvider>.");
  return ctx;
}
