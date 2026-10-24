"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Loader2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/components/ui/DialogProvider";

type Item = { id:string; date:string; time:string; category:string; text:string; status:string; compliance?:any; pageName?:string; metaPostId?:string };
// Lo que ya está en la cola de Facebook se cancela desde el Calendario, no se borra aquí.
const inMeta=(x:Item)=>Boolean(x.metaPostId)&&x.status==="Programado";
type Props = { items:Item[]; onChange:(items:Item[])=>void; onOpenCalendar:()=>void };

const statusOrder=["Borrador","Revisión","Aprobado","Programado","Publicado","Error"];
const statusTone:Record<string,string>={Borrador:"neutral",Revisión:"warning",Aprobado:"success",Programado:"accent",Publicado:"muted",Error:"danger"};

export default function TextQueue({items,onChange,onOpenCalendar}:Props){
  const [filter,setFilter]=useState("Pendientes");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const confirm=useConfirm();
  const stats=useMemo(()=>({pending:items.filter(x=>x.status==="Borrador"||x.status==="Revisión").length,approved:items.filter(x=>x.status==="Aprobado").length,scheduled:items.filter(x=>x.status==="Programado").length,blocked:items.filter(x=>x.compliance?.status&&x.compliance.status!=="pass").length}),[items]);
  const visible=useMemo(()=>items.filter(x=>filter==="Todos"?true:filter==="Pendientes"?(x.status==="Borrador"||x.status==="Revisión"):x.status===filter).slice(0,120),[items,filter]);

  async function persist(next:Item){
    if(!supabase)return;
    await supabase.from("efimero_scheduled_posts").update({status:next.status,compliance_data:next.compliance||null}).eq("id",next.id);
  }
  async function patch(id:string,changes:Partial<Item>){
    const next=items.map(x=>x.id===id?{...x,...changes}:x);onChange(next);
    const changed=next.find(x=>x.id===id);if(changed)await persist(changed);
  }
  async function reviewOne(item:Item){
    const r=await fetch("/api/compliance/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:item.text})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"No fue posible revisar el texto.");
    const compliance=data.items?.[0]||data.review||data;
    await patch(item.id,{compliance,status:compliance.status==="pass"?"Revisión":"Borrador"});
    return compliance;
  }
  async function reviewPending(){
    const targets=items.filter(x=>(x.status==="Borrador"||x.status==="Revisión")&&!x.compliance).slice(0,30);if(!targets.length){setMessage("No hay textos pendientes sin revisar.");return}
    setBusy(true);setMessage("");let pass=0;
    try{for(const item of targets){const result=await reviewOne(item);if(result.status==="pass")pass++}setMessage(`${targets.length} textos revisados · ${pass} pasaron Compliance.`)}catch(e:any){setMessage(e?.message||"La revisión se interrumpió.")}finally{setBusy(false)}
  }
  async function approvePass(){
    const ids=new Set(items.filter(x=>(x.status==="Borrador"||x.status==="Revisión")&&x.compliance?.status==="pass").map(x=>x.id));
    if(!ids.size){setMessage("No hay textos con Compliance PASS pendientes de aprobación.");return}
    const next=items.map(x=>ids.has(x.id)?{...x,status:"Aprobado"}:x);onChange(next);
    const db=supabase;if(db)await Promise.all([...ids].map(id=>db.from("efimero_scheduled_posts").update({status:"Aprobado"}).eq("id",id)));
    setMessage(`${ids.size} textos aprobados.`);
  }

  // Borra de Efímero (Supabase y este navegador). No toca Facebook.
  async function removeItems(targets:Item[]){
    const removable=targets.filter(x=>!inMeta(x));if(!removable.length)return;
    const one=removable.length===1;
    if(!await confirm({title:one?"¿Eliminar este texto?":`¿Eliminar ${removable.length} textos?`,description:one?`${removable[0].date} · ${removable[0].time} · ${removable[0].category}
Se eliminará de Efímero. No afecta a Facebook.`:"Se eliminarán de Efímero. No afecta a nada que ya esté programado en Facebook.",confirmLabel:"Eliminar",tone:"danger"}))return;
    const ids=new Set(removable.map(x=>x.id));
    setBusy(true);
    try{
      if(supabase){const {error}=await supabase.from("efimero_scheduled_posts").delete().in("id",[...ids]);if(error)throw error;}
      onChange(items.filter(x=>!ids.has(x.id)));
      setMessage(one?"Texto eliminado.":`${ids.size} textos eliminados.`);
    }catch(e:any){setMessage(e?.message||"No se pudieron eliminar.")}finally{setBusy(false)}
  }

  const filters=["Pendientes","Aprobado","Programado","Publicado","Error","Todos"];
  const filterLabel:Record<string,string>={Pendientes:"Pendientes",Aprobado:"Aprobados",Programado:"Programados",Publicado:"Publicados",Error:"Con error",Todos:"Todos"};
  const filterCount=(value:string)=>value==="Todos"?items.length:value==="Pendientes"?stats.pending:items.filter(x=>x.status===value).length;

  return <>
    <div className="pageIntro"><div><span className="overline">BANDEJA EDITORIAL</span><h1>Bandeja de revisión</h1><p>Revisa Compliance y aprueba los textos antes de programarlos. Desde aquí no se publica nada.</p></div><button type="button" className="uiBtn uiBtnSecondary" onClick={onOpenCalendar}><CalendarDays size={16}/> Abrir calendario</button></div>

    <div className="calStats" role="list" aria-label="Resumen de la bandeja">
      <Metric label="Pendientes" value={stats.pending}/>
      <Metric label="Aprobados" value={stats.approved}/>
      <Metric label="Programados" value={stats.scheduled}/>
      <Metric label="Con alerta" value={stats.blocked} danger={stats.blocked>0}/>
    </div>

    <section className="calPanel" aria-labelledby="calQueueTitle">
      <div className="calPanelHead">
        <div><h2 id="calQueueTitle">Textos</h2><p>Se muestran hasta 120 textos para mantener la revisión ligera.</p></div>
        <div className="calPanelActions">
          {(filter==="Error"||filter==="Pendientes")&&visible.length>0&&<button type="button" className="uiBtn uiBtnGhost" onClick={()=>void removeItems(visible)} disabled={busy}><Trash2 size={16}/> Eliminar {filter==="Error"?"los con error":"pendientes"} ({visible.length})</button>}
          <button type="button" className="uiBtn uiBtnSecondary" onClick={reviewPending} disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>} Revisar pendientes</button>
          <button type="button" className="uiBtn uiBtnPrimary" onClick={approvePass}><CheckCircle2 size={16}/> Aprobar los que pasan</button>
        </div>
      </div>

      <div className="calFilterBar">
        <div className="segmented compact calSegmented" role="tablist" aria-label="Filtrar por estado">
          {filters.map(x=><button type="button" role="tab" aria-selected={filter===x} key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{filterLabel[x]}<span className="calSegCount">{filterCount(x)}</span></button>)}
        </div>
      </div>

      {message&&<div className="quickNotice calNotice" role="status"><Sparkles size={16}/><span>{message}</span></div>}

      <div className="calRows">
        {visible.length?visible.map(item=>{
          const c=item.compliance;
          return <article className="calRow calQueueRow" key={item.id}>
            <div className="calRowStatus"><span className={`statusPill tone-${statusTone[item.status]||"neutral"}`}>{item.status}</span></div>
            <div className="calRowMain">
              <div className="calRowMeta"><span>{item.date} · {item.time}</span><span>{item.category}</span>{item.pageName&&<span>{item.pageName}</span>}</div>
              <p className="calRowText">{item.text}</p>
              <div className={`calCompliance ${c?.status==="pass"?"ok":c?.status?"warn":""}`}>{c?.status==="pass"?<><CheckCircle2 size={14}/> Compliance PASS</>:c?.status?<><AlertTriangle size={14}/> Compliance: {c.status}</>:<><ShieldCheck size={14}/> Sin revisar</>}</div>
            </div>
            <div className="calRowActions">
              {!c&&<button type="button" className="uiIconBtn" title="Revisar Compliance" aria-label="Revisar Compliance" onClick={()=>reviewOne(item)}><ShieldCheck size={16}/></button>}
              {c?.status==="pass"&&item.status!=="Aprobado"&&<button type="button" className="uiBtn uiBtnSecondary calRowApprove" onClick={()=>patch(item.id,{status:"Aprobado"})}><CheckCircle2 size={16}/> Aprobar</button>}
              {!inMeta(item)&&<button type="button" className="uiIconBtn" title="Eliminar" aria-label="Eliminar texto" onClick={()=>void removeItems([item])} disabled={busy}><Trash2 size={16}/></button>}
              {statusOrder.includes(item.status)&&<select className="calRowSelect" aria-label="Cambiar estado" value={item.status} onChange={e=>patch(item.id,{status:e.target.value})}>{statusOrder.map(s=><option key={s}>{s}</option>)}</select>}
            </div>
          </article>;
        }):<div className="calRowsEmpty"><ClipboardCheck size={20}/><strong>No hay textos en este filtro</strong><span>Cambia el filtro o genera contenido nuevo.</span></div>}
      </div>
    </section>
  </>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className={danger?"calStat danger":"calStat"} role="listitem"><span>{label}</span><strong>{value}</strong></div>}
