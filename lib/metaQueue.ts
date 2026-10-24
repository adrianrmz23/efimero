"use client";

import { useCallback, useEffect, useState } from "react";
import { localDateString, localTimeString } from "@/lib/scheduling";

// Publicación programada directamente en Facebook (incluye las que se mandaron en bulk).
export type MetaQueuePost = { id:string; date:string; time:string; text:string; epoch:number; localId:string|null; category?:string; format?:string };

export function useMetaQueue(pageId:string){
  const [posts,setPosts]=useState<MetaQueuePost[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!pageId){setPosts([]);return}
    setLoading(true);setError("");
    try{
      const r=await fetch(`/api/meta/scheduled?pageId=${encodeURIComponent(pageId)}`,{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"No fue posible consultar la cola de Facebook.");
      setPosts((d.posts||[]).filter((p:any)=>Number(p.scheduledPublishTime)>0).map((p:any)=>{
        const at=new Date(Number(p.scheduledPublishTime)*1000);
        return {id:String(p.id),date:localDateString(at),time:localTimeString(at),text:String(p.message||p.local?.text||""),epoch:Number(p.scheduledPublishTime),localId:p.local?.id?String(p.local.id):null,category:p.local?.category||undefined,format:p.local?.format||undefined};
      }));
    }catch(e:any){setError(e?.message||"No fue posible consultar la cola de Facebook.");setPosts([])}
    finally{setLoading(false)}
  },[pageId]);

  useEffect(()=>{void refresh()},[refresh]);
  return {posts,loading,error,refresh};
}

// Quita de la cola de Meta lo que la app ya muestra: por meta_post_id, por el id local
// o, si no empatan (las imágenes guardan el id de la foto), por fecha y hora exactas.
export function metaOnly(posts:MetaQueuePost[],items:{id:string;metaPostId?:string;date?:string;time?:string;status?:string}[]){
  const metaIds=new Set(items.map(x=>x.metaPostId).filter(Boolean));
  const ids=new Set(items.map(x=>x.id));
  const slots=new Set(items.filter(x=>x.metaPostId||x.status==="Programado").map(x=>`${x.date} ${x.time}`));
  return posts.filter(p=>!metaIds.has(p.id)&&!(p.localId&&ids.has(p.localId))&&!slots.has(`${p.date} ${p.time}`));
}
