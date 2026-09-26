"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Flame, Gauge, Repeat2, Save, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LibraryItem={id:string;text:string;category:string;createdAt:string;publishedAt?:string;source?:string};
type ScheduleItem={id:string;text:string;category:string;date:string;status:string};
type Props={library:LibraryItem[];schedule:ScheduleItem[]};
const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const opening=(s:string)=>norm(s).split(" ").slice(0,3).join(" ");

export default function FatigueRadar({library,schedule}:Props){
  const [saved,setSaved]=useState(false);
  const analysis=useMemo(()=>{
    const recent=[...library].sort((a,b)=>new Date(b.publishedAt||b.createdAt).getTime()-new Date(a.publishedAt||a.createdAt).getTime()).slice(0,180);
    const upcoming=schedule.filter(x=>x.status!=="Publicado"&&x.status!=="Error").slice(0,120);
    const all=[...recent.map(x=>({text:x.text,category:x.category,kind:"histórico"})),...upcoming.map(x=>({text:x.text,category:x.category,kind:"cola"}))].filter(x=>x.text.trim());
    const hookMap=new Map<string,number>();const catMap=new Map<string,number>();const exact=new Map<string,number>();
    all.forEach(x=>{const h=opening(x.text);if(h.split(" ").length>=2)hookMap.set(h,(hookMap.get(h)||0)+1);catMap.set(x.category,(catMap.get(x.category)||0)+1);const n=norm(x.text);exact.set(n,(exact.get(n)||0)+1)});
    const hooks=[...hookMap].filter(([,n])=>n>=3).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const categories=[...catMap].sort((a,b)=>b[1]-a[1]).slice(0,8);
    const duplicates=[...exact].filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const total=Math.max(all.length,1);const dominant=categories[0]?.[1]||0;const repeatedHooks=hooks.reduce((n,[,v])=>n+Math.max(0,v-2),0);const duplicateExtra=duplicates.reduce((n,[,v])=>n+v-1,0);
    const score=Math.min(100,Math.round((dominant/total)*35+(repeatedHooks/total)*220+(duplicateExtra/total)*300));
    const level=score>=65?"Alta":score>=35?"Media":"Baja";
    const recommendations:string[]=[];
    if(dominant/total>.38)recommendations.push(`Reduce temporalmente “${categories[0]?.[0]}”: representa ${Math.round((dominant/total)*100)}% de la muestra.`);
    if(hooks[0]?.[1]>=4)recommendations.push(`Evita abrir más copies con “${hooks[0][0]}…” durante los próximos días.`);
    if(duplicates.length)recommendations.push("Hay textos exactos repetidos. Bloquéalos antes de volver a programarlos.");
    if(!recommendations.length)recommendations.push("La mezcla actual se ve saludable. Mantén variedad de hooks y categorías.");
    return {sample:all.length,score,level,hooks,categories,duplicates,recommendations};
  },[library,schedule]);
  async function save(){if(!supabase)return;await supabase.from("efimero_fatigue_snapshots").insert({sample_size:analysis.sample,score:analysis.score,snapshot:analysis});setSaved(true);setTimeout(()=>setSaved(false),1800)}
  return <>
    <div className="pageIntro"><div><span className="overline">BLOQUE 18 · FATIGA EDITORIAL</span><h1>Detecta cuándo estás diciendo lo mismo</h1><p>Antes de producir más, Efímero mide saturación de categorías, hooks y copias repetidas entre histórico y cola.</p></div><button className="uiBtn uiBtnSecondary" onClick={save}><Save size={16}/>{saved?"Guardado":"Guardar snapshot"}</button></div>
    <section className="fatigueHero"><div className={`fatigueGauge ${analysis.level.toLowerCase()}`}><Gauge size={28}/><span>Fatiga {analysis.level}</span><strong>{analysis.score}/100</strong><small>{analysis.sample} textos evaluados</small></div><div className="fatigueAdvice"><span className="overline">QUÉ CAMBIAR AHORA</span>{analysis.recommendations.map((r,i)=><p key={i}><Sparkles size={15}/>{r}</p>)}</div></section>
    <div className="threePanelGrid"><Panel title="Hooks saturados" icon={<Repeat2 size={19}/>} rows={analysis.hooks.map(([k,v])=>[k,v])} empty="Sin aperturas repetidas relevantes."/><Panel title="Categorías dominantes" icon={<Flame size={19}/>} rows={analysis.categories.map(([k,v])=>[k,v])} empty="Sin datos suficientes."/><Panel title="Duplicados exactos" icon={<AlertTriangle size={19}/>} rows={analysis.duplicates.map(([k,v])=>[k.slice(0,52)+(k.length>52?"…":""),v])} empty="No encontramos duplicados exactos."/></div>
  </>;
}
function Panel({title,icon,rows,empty}:{title:string;icon:any;rows:any[];empty:string}){return <section className="toolPanel"><div className="panelTitle"><div>{icon}<div><h2>{title}</h2><p>Señales sobre la muestra activa.</p></div></div></div>{rows.length?<div className="rankList">{rows.map((r,i)=><div className="rankRow" key={`${r[0]}-${i}`}><span>{i+1}</span><p>{r[0]}</p><strong>{r[1]}×</strong></div>)}</div>:<div className="emptyInline">{empty}</div>}</section>}
